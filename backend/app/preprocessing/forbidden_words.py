"""Forbidden expression detection for Chinese academic writing.

Checks for:
  - List-form connectors (首先/其次/第一/第二 etc.)
  - Colloquial degree adverbs (很多/非常/特别/比较 etc.)
  - Subjective expressions (我觉得/我们认为 etc.)
  - Internet slang and emotional language
  - Guide/conclusion boilerplate
"""

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class ForbiddenMatch:
    word: str
    category: str
    suggestion: str
    position: int  # char index in text
    context: str   # surrounding text snippet


# ── Category: List-form connectors ──
_LIST_PATTERNS = [
    (r'首先', '首先', '列表化连接词', '使用"在……层面""从……角度"等自然过渡替代'),
    (r'其次', '其次', '列表化连接词', '与"首先"配套使用时可保留，单独出现时替换为"此外/另外"'),
    (r'再次', '再次', '列表化连接词', '替换为"进一步地/此外/另外"'),
    (r'最后', '最后', '列表化连接词', '替换为"最终/综上所述"或在句尾自然收束'),
    (r'第一[，,、]', '第一,', '列表化连接词', '使用段落自然过渡替代编号'),
    (r'第二[，,、]', '第二,', '列表化连接词', '使用段落自然过渡替代编号'),
    (r'第三[，,、]', '第三,', '列表化连接词', '使用段落自然过渡替代编号'),
    (r'一方面', '一方面', '列表化连接词', '使用"在……维度上/从……来看"替代'),
    (r'另一方面', '另一方面', '列表化连接词', '替换为"同时/此外/与此相对"'),
]

# ── Category: Colloquial degree adverbs ──
_COLLOQUIAL_PATTERNS = [
    (r'很多(?!研究|学者|文献|方面|领域|因素|案例|数据)', '很多', '口语程度词', '使用"大量/众多/诸多/广泛"替代'),
    (r'非常(?!重要|必要|关键|显著|明显)', '非常', '口语程度词', '使用"极为/十分/颇为/相当"替代'),
    (r'特别(?!是|指|在|的)', '特别', '口语程度词', '使用"尤其/尤为/格外"替代'),
    (r'比较(?!研究|分析|而言|之下)', '比较', '口语程度词', '使用"较为/相对/一定程度上"替代'),
    (r'挺好看|挺不错|挺好的|挺多|挺少', '挺', '口语程度词', '替换为"较为/相当"'),
    (r'蛮好|蛮多|蛮不错', '蛮', '口语程度词', '替换为"较为/相当"'),
    (r'很(?!多|少|大|小|高|低|强|弱|重要|关键)', '很', '口语程度词', '使用"极为/较为/颇为"替代'),
]

# ── Category: Subjective expressions ──
_SUBJECTIVE_PATTERNS = [
    (r'我觉得', '我觉得', '主观表达', '使用"本文认为/本研究认为"或直接陈述观点'),
    (r'我们认为', '我们认为', '主观表达', '使用"本研究认为/学界普遍认为"'),
    (r'大家都知道', '大家都知道', '主观表达', '使用"众所周知/学界共识是"'),
    (r'我们不难看出', '我们不难看出', '主观表达', '使用"由此可见/这表明/不难发现"'),
    (r'笔者', '笔者', '主观表达', '使用"本文/本研究"或直接客观陈述'),
]

# ── Category: Guide/conclusion boilerplate ──
_BOILERPLATE_PATTERNS = [
    (r'^以下是.{0,20}$', '以下是...', '引导语', '删除引导语，直接输出正文'),
    (r'^修改后(的)?文本(如下)?[：:]', '修改后文本如下', '引导语', '删除引导语，直接输出修改后文本'),
    (r'^本文认为.{0,10}$', '本文认为...', '引导语', '直接陈述观点，无需"本文认为"包装'),
    (r'^以上是.{0,20}$', '以上是...', '收尾语', '删除收尾语'),
    (r'希望对.{0,20}帮助', '希望对您有帮助', '收尾语', '删除收尾语'),
    (r'完毕$', '完毕', '收尾语', '删除'),
]

# ── Category: Internet slang ──
_SLANG_PATTERNS = [
    (r'牛逼|牛掰|牛X', '网络用语', '网络用语', '替换为"出色/优异/突出"'),
    (r'绝绝子|无语子', '网络用语', '网络用语', '删除，重新组织表达'),
    (r'真的会谢|栓Q|大冤种', '网络用语', '网络用语', '删除，重新组织表达'),
    (r'yyds|YYDS|awsl|AWSL', '网络用语', '网络用语', '删除，重新组织表达'),
    (r'内卷|躺平|摆烂|佛系|破防|社恐|社牛', '网络流行语', '网络流行语', '使用正式学术表达替代'),
    (r'get到|hold住|pick了|pick一下', '中英混杂', '中英混杂', '替换为中文正式表达'),
]

ALL_PATTERNS = (
    _LIST_PATTERNS
    + _COLLOQUIAL_PATTERNS
    + _SUBJECTIVE_PATTERNS
    + _BOILERPLATE_PATTERNS
    + _SLANG_PATTERNS
)


def scan(text: str) -> List[ForbiddenMatch]:
    """Scan text for forbidden expressions.

    Returns list of matches, sorted by position in text.
    """
    matches: List[ForbiddenMatch] = []

    for pattern_str, word, category, suggestion in ALL_PATTERNS:
        for m in re.finditer(pattern_str, text, re.IGNORECASE | re.MULTILINE):
            pos = m.start()
            # Get surrounding context (20 chars before and after)
            ctx_start = max(0, pos - 20)
            ctx_end = min(len(text), pos + len(m.group()) + 20)
            context = text[ctx_start:ctx_end]
            matches.append(ForbiddenMatch(
                word=m.group(),
                category=category,
                suggestion=suggestion,
                position=pos,
                context=context,
            ))

    # Sort by position
    matches.sort(key=lambda x: x.position)
    return matches


def compute_score(text: str) -> float:
    """Compute a quality score based on forbidden word density.

    Returns 0-100, where 100 is clean (no forbidden expressions found).
    """
    matches = scan(text)
    if not text.strip():
        return 100.0

    text_len = len(text)
    # Each match contributes a penalty, weighted by category severity
    severity_weights = {
        '列表化连接词': 3.0,
        '口语程度词': 2.0,
        '主观表达': 3.0,
        '引导语': 5.0,
        '收尾语': 5.0,
        '网络用语': 8.0,
        '网络流行语': 5.0,
        '中英混杂': 4.0,
    }

    total_penalty = sum(
        severity_weights.get(m.category, 2.0) for m in matches
    )
    # Normalize by text length (per 100 chars)
    density = total_penalty / (text_len / 100 + 1)
    score = max(0.0, 100.0 - density * 2)
    return round(score, 1)
