/**
 * services/api.ts — 后端通信层
 *
 * 本文件封装了所有与 FastAPI 后端的 HTTP 通信，包括：
 *   - 认证 API（登录/注册）
 *   - SSE 流式 API（润色/图表/Agent 写作）
 *   - 文件上传/下载
 *   - 历史记录 CRUD
 *   - RAG 知识库管理
 *   - LLM 配置管理
 *
 * === SSE 流式通信模式 ===
 * 后端使用 Server-Sent Events (SSE) 推送流式数据，格式为：
 *   event: delta\n
 *   data: {"content": "..."}\n\n
 *
 * 核心解析逻辑集中在 parseSSEStreamCore()，所有流式 API 共用。
 * 上层 hook（useStreamRewrite / useStreamDiagram）通过回调接收增量数据。
 *
 * === 认证 ===
 * getAuthHeaders() 从 localStorage 读取 token 并附加到请求头。
 * 需要登录的 API 必须调用此函数获取 headers。
 */

const BASE = '/api'

/**
 * 获取带认证信息的请求头。
 * 从 localStorage 读取 lunwen_token，如果存在则附加 Bearer token。
 * 注意：直接读 localStorage 而非通过 AuthContext，因为此函数可能在
 * React 组件树外被调用。
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('lunwen_token')
  if (token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }
  return { 'Content-Type': 'application/json' }
}

// ═══════════════════════════════════════════════════════════════════════
// Auth API — 注册/登录（无需认证）
// ═══════════════════════════════════════════════════════════════════════

export const AuthApi = {
  /**
   * 注册新用户
   * @returns { token, username, user_id, role }
   */
  async register(username: string, password: string, email?: string) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '注册失败' }))
      throw new Error(err.detail || '注册失败')
    }
    return res.json()
  },

  /**
   * 登录
   * @returns { token, username, user_id, role }
   */
  async login(username: string, password: string) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '登录失败' }))
      throw new Error(err.detail || '登录失败')
    }
    return res.json()
  },
}

// ═══════════════════════════════════════════════════════════════════════
// SSE 流式解析核心
// ═══════════════════════════════════════════════════════════════════════

/** SSE 事件类型 → 处理函数的映射 */
type SSEHandlers = Record<string, (data: Record<string, unknown>) => void>

/**
 * SSE 流解析引擎
 *
 * 使用 ReadableStream 逐块读取响应体，按 SSE 协议解析：
 *   event: <事件名>\n
 *   data: <JSON>\n\n
 *
 * 解析出的事件分发给 handlers 中对应的回调函数。
 *
 * 为什么不用 EventSource API？
 *   EventSource 不支持 POST 请求和自定义 headers，
 *   而我们的流式 API 需要 POST 传递请求体。
 *
 * @param response - fetch 返回的 Response 对象（body 必须是 ReadableStream）
 * @param handlers - 事件处理映射，key 为事件名（delta/done/error/status 等）
 * @param onError   - 网络层错误回调
 * @param signal    - AbortSignal，用于取消流
 */
async function parseSSEStreamCore(
  response: Response,
  handlers: SSEHandlers,
  onError: (err: { message: string; code: string }) => void,
  signal: AbortSignal,
) {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''  // 缓冲区：处理跨 chunk 的不完整行

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done || signal.aborted) {
        await reader.cancel()
        return
      }
      buffer += decoder.decode(value, { stream: true })

      // 按行分割，最后一行可能不完整，留在 buffer 中下次处理
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let event = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim()   // 提取事件名
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const handler = handlers[event]
            if (handler) handler(data)
          } catch {
            // 忽略 JSON 解析错误（部分 chunk 可能截断）
          }
        }
      }
    }
  } catch (err) {
    // AbortError 是主动取消，不需要报错
    if ((err as Error).name !== 'AbortError') {
      onError({ message: (err as Error).message, code: 'NETWORK_ERROR' })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 流式 API — 润色/图表/Agent
// ═══════════════════════════════════════════════════════════════════════

/**
 * 启动文本润色 SSE 流
 *
 * 后端事件类型：
 *   - delta: 增量文本片段 → onDelta
 *   - done:  完成信号 + 统计信息 → onDone
 *   - error: 服务端错误 → onError
 *
 * @returns AbortController，调用 .abort() 可取消流
 */
export function streamRewrite(
  body: { text: string; mode: string; style: string; language?: string },
  onDelta: (content: string) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (err: { message: string; code: string }) => void,
): AbortController {
  const controller = new AbortController()
  fetch(`${BASE}/rewrite/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Unknown error' }))
      onError({ message: err.detail || '请求失败', code: 'HTTP_ERROR' })
      return
    }
    parseSSEStreamCore(response, {
      delta: (data) => onDelta(data.content as string),
      done: onDone,
      error: onError,
    }, onError, controller.signal)
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onError({ message: err.message, code: 'NETWORK_ERROR' })
    }
  })
  return controller
}

/**
 * 文件上传并提取文本
 *
 * 接受 .docx / .pdf / .txt 文件，后端解析后返回纯文本。
 * 使用 FormData 而非 JSON，因为需要传输二进制文件。
 *
 * @param file    - 用户选择的文件
 * @param onError - 错误回调（支持多次调用，如 toast.error）
 * @returns 成功返回 { text, filename }，失败返回 null
 */
export async function uploadAndExtractText(
  file: File,
  onError: (msg: string) => void,
): Promise<{ text: string; filename: string } | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetch(`${BASE}/upload/extract-text`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
      onError(err.detail || '文件上传失败')
      return null
    }
    return await res.json()
  } catch (err) {
    onError((err as Error).message || '网络错误')
    return null
  }
}

/**
 * 导出 Word 文档（.docx）
 *
 * 将润色后的文本发送到后端，后端返回 Blob，
 * 前端通过创建临时 URL 触发浏览器下载。
 */
export async function downloadDocx(text: string): Promise<void> {
  const formData = new FormData()
  formData.append('text', text)
  const res = await fetch(`${BASE}/export/docx`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    throw new Error('导出失败')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '润色结果.docx'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 迭代润色 SSE 流
 *
 * 与 streamRewrite 的区别：
 *   - 额外传递 current_text（上一轮结果）和 instruction（用户指令）
 *   - 后端在已有结果基础上做增量修改，而非从头生成
 */
export function streamRewriteIterate(
  body: { original_text: string; current_text: string; instruction: string; style: string },
  onDelta: (content: string) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (err: { message: string; code: string }) => void,
): AbortController {
  const controller = new AbortController()
  fetch(`${BASE}/rewrite/iterate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Unknown error' }))
      onError({ message: err.detail || '请求失败', code: 'HTTP_ERROR' })
      return
    }
    parseSSEStreamCore(response, {
      delta: (data) => onDelta(data.content as string),
      done: onDone,
      error: onError,
    }, onError, controller.signal)
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onError({ message: err.message, code: 'NETWORK_ERROR' })
    }
  })
  return controller
}

/**
 * 图表生成 SSE 流
 *
 * 结构与 streamRewrite 相同，仅后端端点和 body 字段不同。
 */
export function streamDiagram(
  body: { description: string; diagram_type: string },
  onDelta: (content: string) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (err: { message: string; code: string }) => void,
): AbortController {
  const controller = new AbortController()
  fetch(`${BASE}/diagram/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Unknown error' }))
      onError({ message: err.detail || '请求失败', code: 'HTTP_ERROR' })
      return
    }
    parseSSEStreamCore(response, {
      delta: (data) => onDelta(data.content as string),
      done: onDone,
      error: onError,
    }, onError, controller.signal)
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onError({ message: err.message, code: 'NETWORK_ERROR' })
    }
  })
  return controller
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`)
  return res.json()
}

// ═══════════════════════════════════════════════════════════════════════
// Agent 流式写作（认证必需）
// ═══════════════════════════════════════════════════════════════════════

/**
 * 多 Agent 协作写作 SSE 流
 *
 * 这是最复杂的流式 API。后端有多个 Agent 串联工作：
 *   预处理(preprocess) → RAG检索(rag) → 写作 → 审稿(review)
 *
 * 事件类型比基础流式多：
 *   - status:      阶段状态变更 → onStatus(stage, message)
 *   - preprocess:  预处理完成 → onPreprocess
 *   - rag:         RAG 检索完成 → onRag
 *   - review:      审稿意见 → onReview
 *   - delta/done/error: 与基础流式相同
 *
 * 需要认证（getAuthHeaders），因为 Agent 功能消耗较多资源。
 */
export function streamAgentRewrite(
  body: { text: string; mode: string; style: string; use_rag?: boolean; enable_review?: boolean },
  onDelta: (content: string) => void,
  onStatus: (stage: string, message: string) => void,
  onPreprocess: (data: Record<string, unknown>) => void,
  onRag: (data: Record<string, unknown>) => void,
  onReview: (data: Record<string, unknown>) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (err: { message: string; code: string }) => void,
): AbortController {
  const controller = new AbortController()
  fetch(`${BASE}/rewrite/agent/stream`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '请求失败' }))
      onError({ message: err.detail || '请求失败', code: 'HTTP_ERROR' })
      return
    }
    parseSSEStreamCore(response, {
      delta: (data) => onDelta(data.content as string),
      status: (data) => onStatus(data.stage as string, data.message as string),
      preprocess: onPreprocess,
      rag: onRag,
      review: onReview,
      done: onDone,
      error: onError,
    }, onError, controller.signal)
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onError({ message: err.message, code: 'NETWORK_ERROR' })
    }
  })
  return controller
}

// ═══════════════════════════════════════════════════════════════════════
// History API（认证必需）
// ═══════════════════════════════════════════════════════════════════════

export const HistoryApi = {
  /** 获取历史记录列表，可选按 type 过滤 */
  async list(type?: string) {
    const url = type ? `${BASE}/history?type=${type}` : `${BASE}/history`
    const res = await fetch(url, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('获取历史失败')
    return res.json()
  },

  /** 保存一条历史记录 */
  async save(data: {
    type: string
    mode?: string
    original_text?: string
    result_text?: string
    quality_report?: Record<string, unknown>
    label?: string
  }) {
    const res = await fetch(`${BASE}/history`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('保存失败')
    return res.json()
  },

  /** 删除一条历史记录 */
  async delete(id: number) {
    const res = await fetch(`${BASE}/history/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除失败')
    return res.json()
  },
}

// ═══════════════════════════════════════════════════════════════════════
// RAG API（认证必需）
// ═══════════════════════════════════════════════════════════════════════

export const RagApi = {
  /** 上传文献到知识库 */
  async upload(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const token = localStorage.getItem('lunwen_token')
    const res = await fetch(`${BASE}/rag/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '上传失败' }))
      throw new Error(err.detail || '上传失败')
    }
    return res.json()
  },

  /** 获取已上传文献列表 */
  async list() {
    const res = await fetch(`${BASE}/rag/documents`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('获取文献列表失败')
    return res.json()
  },

  /** 删除文献 */
  async delete(id: number) {
    const res = await fetch(`${BASE}/rag/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除失败')
    return res.json()
  },
}

// ═══════════════════════════════════════════════════════════════════════
// Config API（认证必需）
// ═══════════════════════════════════════════════════════════════════════

export const ConfigApi = {
  /** 获取 LLM 配置列表和 provider 预设 */
  async get() {
    const res = await fetch(`${BASE}/config`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('获取配置失败')
    return res.json()
  },

  /** 保存/更新模型配置 */
  async saveProfile(data: Record<string, unknown>) {
    const res = await fetch(`${BASE}/config/profile`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '保存失败' }))
      throw new Error(err.detail || '保存失败')
    }
    return res.json()
  },

  /** 删除模型配置 */
  async deleteProfile(id: number) {
    const res = await fetch(`${BASE}/config/profile/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除失败')
    return res.json()
  },

  /** 激活某个配置为当前使用 */
  async activateProfile(id: number) {
    const res = await fetch(`${BASE}/config/activate/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('激活失败')
    return res.json()
  },

  /** 测试 API 连接 */
  async test(data: Record<string, unknown>) {
    const res = await fetch(`${BASE}/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '测试失败' }))
      throw new Error(err.detail || '测试失败')
    }
    return res.json()
  },
}
