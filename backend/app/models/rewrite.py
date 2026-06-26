from pydantic import BaseModel, Field


RewriteMode = str
RewriteStyle = str


class RewriteRequest(BaseModel):
    text: str = Field(
        ..., min_length=1, max_length=50000, description="需要处理的原始文本"
    )
    mode: str = Field(
        default="rewrite",
        pattern="^(rewrite|deweight|abstract|restructure|grammar|intro_conclusion|literature_review|reference)$",
        description="处理模式",
    )
    style: str = Field(
        default="formal",
        pattern="^(formal|concise|expanded)$",
        description="润色风格（仅 mode=rewrite 时有效）",
    )
    language: str = Field(
        default="zh",
        pattern="^(zh|en)$",
        description="摘要语言（仅 mode=abstract 时有效）",
    )
    intro_or_conclusion: str = Field(
        default="intro",
        pattern="^(intro|conclusion)$",
        description="引言或结论（仅 mode=intro_conclusion 时有效）",
    )


class RewriteIterateRequest(BaseModel):
    original_text: str = Field(
        ..., min_length=1, max_length=50000, description="原始论文段落"
    )
    current_text: str = Field(
        ..., min_length=1, max_length=50000, description="当前处理结果"
    )
    instruction: str = Field(
        ..., min_length=1, max_length=5000, description="用户追加的修改指令"
    )
    mode: str = Field(default="rewrite")
    style: str = Field(default="formal")


class RewriteResponse(BaseModel):
    original: str
    rewritten: str
    mode: str
    style: str = ""


class StreamDoneData(BaseModel):
    original_length: int
    rewritten_length: int
    mode: str
    style: str = ""
    is_iteration: bool = False


class StreamErrorData(BaseModel):
    message: str
    code: str


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
