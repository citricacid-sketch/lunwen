"""Review agent — checks rewritten text quality.

Performs two layers of review:
  1. Rule-based checks (fast, free): citation integrity, forbidden words, format
  2. LLM review (semantic): meaning preservation, academic tone, coherence

Returns a score and list of issues. Pass/fail threshold: score >= 70.
"""

import logging
from dataclasses import dataclass, field
from typing import List

from app.agents.base import BaseAgent
from app.preprocessing.forbidden_words import scan, compute_score
from app.preprocessing.citation_guard import CitationGuard

logger = logging.getLogger(__name__)

PASS_THRESHOLD = 70


@dataclass
class Issue:
    severity: str  # "critical", "major", "minor"
    category: str  # "citation", "forbidden_word", "format", "semantic", "tone", "coherence"
    description: str
    location: str = ""  # snippet of text where issue found


@dataclass
class ReviewResult:
    passed: bool
    score: float  # 0-100
    issues: List[Issue] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "score": self.score,
            "issues": [
                {"severity": i.severity, "category": i.category,
                 "description": i.description, "location": i.location}
                for i in self.issues
            ],
            "summary": self.summary,
        }


REVIEW_SYSTEM_PROMPT = """你是一名严格的学术论文质量审查专家。你需要审查一篇经过改写后的论文章节，从以下维度评估：

1. 语义保持度（40分）：原文的核心观点、论证逻辑、学术判断是否完整保留？有没有遗漏或曲解？
2. 学术规范性（30分）：是否符合学术写作规范？有没有列表化表达、口语化残留、引导语/收尾语？
3. 语言流畅度（20分）：句子衔接是否自然？行文是否流畅？
4. 引用完整性（10分）：引用标记是否与原文一致（数量相同、位置合理）？

评分标准：
- 90-100：优秀，无需修改
- 80-89：良好，有少量小问题
- 70-79：合格，存在需要改进的问题
- 60-69：不合格，有较严重的问题
- <60：严重不合格，需要重写

请以JSON格式输出你的审查结果：
```json
{
  "semantic_score": 0-40,
  "academic_score": 0-30,
  "fluency_score": 0-20,
  "citation_score": 0-10,
  "total_score": 0-100,
  "passed": true/false,
  "issues": [
    {"severity": "critical/major/minor", "category": "...", "description": "...", "location": "..."}
  ],
  "summary": "一句话总结审查结果"
}
```

只输出JSON，不要其他文字。"""


class ReviewAgent(BaseAgent):
    """Reviews rewritten text using rules + LLM."""

    def __init__(self, provider, name: str = "review"):
        super().__init__(provider, name)

    def rule_check(self, original_text: str, rewritten_text: str, original_citations: list) -> List[Issue]:
        """Fast rule-based checks before LLM review."""
        issues: List[Issue] = []

        # 1. Citation integrity check
        guard = CitationGuard()
        _, rw_citations = guard.extract(rewritten_text)
        if len(rw_citations) != len(original_citations):
            issues.append(Issue(
                severity="critical",
                category="citation",
                description=f"引用数量不匹配：原文 {len(original_citations)} 个，改写后 {len(rw_citations)} 个",
            ))

        # 2. Forbidden words re-scan
        matches = scan(rewritten_text)
        for m in matches[:5]:  # Limit to top 5
            issues.append(Issue(
                severity="major" if m.category in ("列表化连接词", "引导语", "收尾语") else "minor",
                category="forbidden_word",
                description=f"「{m.word}」({m.category}) — {m.suggestion}",
                location=m.context,
            ))

        # 3. Basic format checks
        import re
        # Check for bullet points
        if re.search(r'^[•\-\*]\s', rewritten_text, re.MULTILINE):
            issues.append(Issue(
                severity="critical", category="format",
                description="输出包含项目符号，违反了格式铁律",
            ))
        # Check for numbered list markers
        if re.search(r'(?<!\w)[①②③④⑤⑥⑦⑧⑨⑩]', rewritten_text):
            issues.append(Issue(
                severity="critical", category="format",
                description="输出包含编号符号（①②③），违反了格式铁律",
            ))

        return issues

    def _build_review_message(
        self,
        original_text: str,
        rewritten_text: str,
        original_citations: list,
        rule_issues: List[Issue],
    ) -> str:
        parts = []
        parts.append("## 原文\n" + original_text[:2000])
        parts.append("\n## 改写稿\n" + rewritten_text[:3000])

        if original_citations:
            parts.append(f"\n## 原文引用标记\n{', '.join(original_citations)}")

        if rule_issues:
            parts.append("\n## 规则层已检测到的问题")
            for issue in rule_issues:
                parts.append(f"- [{issue.severity}] {issue.description}")

        parts.append("\n请对改写稿进行综合审查，输出JSON。")
        return "\n".join(parts)

    async def review(
        self,
        original_text: str,
        rewritten_text: str,
        original_citations: list,
    ) -> ReviewResult:
        """Full review: rules + LLM."""

        # Layer 1: Rule-based checks
        rule_issues = self.rule_check(original_text, rewritten_text, original_citations)

        # Compute rule-based score deduction
        severity_deduction = {"critical": 15, "major": 8, "minor": 3}
        rule_deduction = sum(severity_deduction.get(i.severity, 5) for i in rule_issues)
        rule_score = max(0, 100 - rule_deduction)

        # Layer 2: LLM review for semantic quality
        llm_issues: List[Issue] = []
        llm_score = 85.0  # default

        try:
            user_msg = self._build_review_message(
                original_text, rewritten_text, original_citations, rule_issues,
            )
            result = await self.generate(REVIEW_SYSTEM_PROMPT, user_msg)

            # Parse JSON from LLM response
            import json
            # Extract JSON block
            json_match = result.strip()
            if "```json" in json_match:
                json_match = json_match.split("```json")[1].split("```")[0]
            elif "```" in json_match:
                json_match = json_match.split("```")[1].split("```")[0]
            parsed = json.loads(json_match)

            llm_score = float(parsed.get("total_score", 85))
            for item in parsed.get("issues", []):
                llm_issues.append(Issue(
                    severity=item.get("severity", "minor"),
                    category=item.get("category", "semantic"),
                    description=item.get("description", ""),
                    location=item.get("location", ""),
                ))
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning("LLM review JSON parsing failed, using rule-only result: %s", e)
            llm_score = rule_score

        # Merge scores (weighted: 40% rule, 60% LLM)
        all_issues = rule_issues + llm_issues
        final_score = round(rule_score * 0.4 + llm_score * 0.6, 1)
        passed = final_score >= PASS_THRESHOLD

        # Build summary
        critical_count = sum(1 for i in all_issues if i.severity == "critical")
        major_count = sum(1 for i in all_issues if i.severity == "major")
        if not all_issues:
            summary = "审查通过，未发现问题。"
        elif critical_count > 0:
            summary = f"发现 {critical_count} 个严重问题、{major_count} 个重要问题，需要修改。"
        else:
            summary = f"发现 {len(all_issues)} 个问题（无严重问题），建议优化。"

        return ReviewResult(
            passed=passed,
            score=final_score,
            issues=all_issues,
            summary=summary,
        )

    def build_feedback(self, result: ReviewResult) -> str:
        """Build actionable feedback for the rewrite agent from review results."""
        if result.passed and not result.issues:
            return ""

        lines = ["请根据以下审查意见修改你的输出："]
        for issue in result.issues:
            icon = {"critical": "❌", "major": "⚠️", "minor": "💡"}.get(issue.severity, "-")
            lines.append(f"{icon} [{issue.category}] {issue.description}")
            if issue.location:
                lines.append(f"   位置: ...{issue.location}...")
        lines.append(f"\n总评分: {result.score}/100")
        return "\n".join(lines)
