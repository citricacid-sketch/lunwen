export type DiagramType =
  | 'er'
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'gantt'
  | 'architecture'
  | 'table'

export interface RewriteRequest {
  text: string
  style: 'formal' | 'concise' | 'expanded'
}

export interface RewriteIterateRequest {
  original_text: string
  current_text: string
  instruction: string
  style: 'formal' | 'concise' | 'expanded'
}

export interface RewriteDoneData {
  original_length: number
  rewritten_length: number
  style: string
  is_iteration: boolean
}

export interface DiagramRequest {
  description: string
  diagram_type: DiagramType
}

export interface EntityAttribute {
  name: string
  type: string
  key: string | null
}

export interface Entity {
  name: string
  attributes: EntityAttribute[]
}

export interface Relationship {
  from: string
  to: string
  type: string
  cardinality: string
}

export interface DiagramDoneData {
  html_code: string
  diagram_type: string
  entities: Entity[]
  relationships: Relationship[]
}

export interface StreamError {
  message: string
  code: string
}

export interface HealthResponse {
  status: string
  provider: string
  model: string
  llm_available: boolean
}

export interface HistoryEntry {
  id: string
  type: 'rewrite' | 'diagram'
  timestamp: number
  input: {
    text: string
    style?: string
    diagramType?: string
  }
  result: {
    output: string
    meta?: Record<string, unknown>
  }
  iterationOf?: string
  label?: string
}

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  er: 'ER 图',
  flowchart: '流程图',
  sequence: '时序图',
  class: '类图',
  state: '状态图',
  gantt: '甘特图',
  architecture: '架构图',
  table: '表格插图',
}
