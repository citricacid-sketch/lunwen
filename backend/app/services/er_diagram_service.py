import re
import json
import logging
from typing import AsyncIterator
from app.config import get_llm_provider
from app.prompts.diagram import build_diagram_prompt

logger = logging.getLogger(__name__)


class DiagramService:
    async def generate(self, description: str, diagram_type: str = "er") -> dict:
        provider = get_llm_provider()
        system_prompt = build_diagram_prompt(diagram_type)
        raw_output = await provider.generate(system_prompt, description)
        return self._parse_output(raw_output, diagram_type)

    async def generate_stream(
        self, description: str, diagram_type: str = "er"
    ) -> AsyncIterator[str]:
        provider = get_llm_provider()
        system_prompt = build_diagram_prompt(diagram_type)
        async for chunk in provider.generate_stream(system_prompt, description):
            yield chunk

    def _parse_output(self, raw: str, diagram_type: str) -> dict:
        html_code = self._extract_html(raw)

        entities = []
        relationships = []

        if diagram_type == "er":
            json_match = re.search(r"```json\s*(.*?)```", raw, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(1))
                    entities = parsed.get("entities", [])
                    relationships = parsed.get("relationships", [])
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse ER JSON: {e}")

        return {
            "html_code": html_code,
            "diagram_type": diagram_type,
            "entities": entities,
            "relationships": relationships,
        }

    def _extract_html(self, raw: str) -> str:
        # Try to extract from ```html code block
        html_match = re.search(r"```html\s*(.*?)```", raw, re.DOTALL)
        if html_match:
            return html_match.group(1).strip()

        # Try to extract anything between <style> and </html>
        html_match = re.search(r"(<style>.*?</html>)", raw, re.DOTALL)
        if html_match:
            return html_match.group(1).strip()

        # Try to extract from generic code block
        code_match = re.search(r"```\s*(.*?)```", raw, re.DOTALL)
        if code_match:
            candidate = code_match.group(1).strip()
            if candidate.startswith("<") and "style" in candidate.lower():
                return candidate

        # Fallback: return raw output
        return raw.strip()
