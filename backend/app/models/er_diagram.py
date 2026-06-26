from pydantic import BaseModel, Field
from typing import Literal


DiagramType = Literal[
    "er", "flowchart", "sequence", "class", "state", "gantt", "architecture", "table"
]


class DiagramRequest(BaseModel):
    description: str = Field(
        ..., min_length=1, max_length=50000, description="描述图表的自然语言段落"
    )
    diagram_type: DiagramType = Field(
        default="er", description="图表类型"
    )


class EntityAttribute(BaseModel):
    name: str
    type: str
    key: str | None = None


class Entity(BaseModel):
    name: str
    attributes: list[EntityAttribute]


class Relationship(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    type: str
    cardinality: str


class DiagramResponse(BaseModel):
    html_code: str
    diagram_type: str
    entities: list[Entity] = []
    relationships: list[Relationship] = []


class DiagramStreamDoneData(BaseModel):
    html_code: str
    diagram_type: str
    entities: list[Entity] = []
    relationships: list[Relationship] = []


class ERDiagramRequest(BaseModel):
    description: str = Field(
        ..., min_length=1, max_length=50000, description="描述实体和关系的自然语言段落"
    )


ERDiagramResponse = DiagramResponse
ERDiagramStreamDoneData = DiagramStreamDoneData
