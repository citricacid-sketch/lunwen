/**
 * types/index.ts — 全局类型定义
 *
 * 本文件定义了前端所有页面和组件共享的 TypeScript 类型。
 * 按领域分组：润色相关 → 图表相关 → 通用流式响应 → 历史记录
 */

/** 支持的图表类型（8 种） */
export type DiagramType =
  | 'er'           // 实体关系图
  | 'flowchart'    // 流程图
  | 'sequence'     // 时序图
  | 'class'        // 类图
  | 'state'        // 状态图
  | 'gantt'        // 甘特图
  | 'architecture' // 架构图
  | 'table'        // 表格插图

// ── 润色相关 ──

/** 润色完成后的统计信息，来自后端 SSE done 事件 */
export interface RewriteDoneData {
  original_length: number
  rewritten_length: number
  mode: string
  style: string
  is_iteration: boolean
}

/** 用户信息 */
export interface User {
  user_id: number
  username: string
  email: string | null
  role: string
}

/** 聊天消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

// ── 图表相关 ──

/** 实体属性（ER 图） */
export interface EntityAttribute {
  name: string
  type: string
  key: string | null   // 主键/外键标记
}

/** 实体定义（ER 图） */
export interface Entity {
  name: string
  attributes: EntityAttribute[]
}

/** 实体间关系（ER 图） */
export interface Relationship {
  from: string
  to: string
  type: string          // 关系类型：一对一/一对多/多对多
  cardinality: string   // 基数描述
}

/** 图表生成完成后的数据，来自后端 SSE done 事件 */
export interface DiagramDoneData {
  html_code: string
  diagram_type: string
  entities: Entity[]
  relationships: Relationship[]
}

// ── 历史记录 ──

/**
 * 历史记录条目
 *
 * 同时服务于「论文写作」和「图表生成」两个模块，
 * 通过 type 字段区分，input/result 结构随 type 不同而不同。
 */
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
  /** 指向父条目的 ID，表示这是一次迭代修改 */
  iterationOf?: string
  /** 列表展示用的简短标签 */
  label?: string
}

/** 图表类型 → 中文显示名映射 */
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
