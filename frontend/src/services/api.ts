const BASE = '/api'

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('lunwen_token')
  if (token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }
  return { 'Content-Type': 'application/json' }
}

// ── Auth API ──

export const AuthApi = {
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

// ── SSE Streaming ──

type SSEHandlers = Record<string, (data: Record<string, unknown>) => void>

async function parseSSEStreamCore(
  response: Response,
  handlers: SSEHandlers,
  onError: (err: { message: string; code: string }) => void,
  signal: AbortSignal,
) {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done || signal.aborted) {
        await reader.cancel()
        return
      }
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let event = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const handler = handlers[event]
            if (handler) handler(data)
          } catch {
            // skip parse errors in SSE stream
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onError({ message: (err as Error).message, code: 'NETWORK_ERROR' })
    }
  }
}

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

// ── Agent rewrite (auth required) ──

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

// ── History API (auth required) ──

export const HistoryApi = {
  async list(type?: string) {
    const url = type ? `${BASE}/history?type=${type}` : `${BASE}/history`
    const res = await fetch(url, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('获取历史失败')
    return res.json()
  },

  async save(data: { type: string; mode?: string; original_text?: string; result_text?: string; quality_report?: Record<string, unknown>; label?: string }) {
    const res = await fetch(`${BASE}/history`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('保存失败')
    return res.json()
  },

  async delete(id: number) {
    const res = await fetch(`${BASE}/history/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除失败')
    return res.json()
  },
}

// ── RAG API (auth required) ──

export const RagApi = {
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

  async list() {
    const res = await fetch(`${BASE}/rag/documents`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('获取文献列表失败')
    return res.json()
  },

  async delete(id: number) {
    const res = await fetch(`${BASE}/rag/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除失败')
    return res.json()
  },
}

// ── Config API (auth required) ──

export const ConfigApi = {
  async get() {
    const res = await fetch(`${BASE}/config`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('获取配置失败')
    return res.json()
  },

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

  async deleteProfile(id: number) {
    const res = await fetch(`${BASE}/config/profile/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('删除失败')
    return res.json()
  },

  async activateProfile(id: number) {
    const res = await fetch(`${BASE}/config/activate/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('激活失败')
    return res.json()
  },

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
