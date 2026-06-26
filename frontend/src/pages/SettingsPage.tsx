import { useState, useEffect } from 'react'
import { Save, Wifi, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react'
import { getAuthHeaders } from '../services/api'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', desc: 'GPT-4o, GPT-4o-mini 等' },
  { id: 'deepseek', label: 'DeepSeek', desc: 'deepseek-chat, reasoner' },
  { id: 'qwen', label: '通义千问', desc: 'qwen-turbo, plus, max' },
  { id: 'zhipu', label: '智谱 GLM', desc: 'glm-4, glm-4-flash' },
  { id: 'moonshot', label: 'Moonshot', desc: 'moonshot-v1 系列' },
  { id: 'siliconflow', label: 'SiliconFlow', desc: '聚合多种开源模型' },
  { id: 'custom', label: '自定义', desc: '任意兼容 OpenAI 协议的 API' },
]

interface Profile {
  id: string
  name: string
  provider: string
  model: string
  base_url: string
  api_key: string
  is_active: boolean
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [presets, setPresets] = useState<Record<string, { base_url: string; models: string[] }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  // Form state
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = () => {
    fetch('/api/config', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data.profiles || [])
        if (data.presets) setPresets(data.presets)
      })
      .catch((e) => { console.error('Failed to load config:', e) })
  }

  useEffect(() => {
    const preset = presets[provider]
    if (preset) {
      setBaseUrl(preset.base_url || '')
      if (preset.models && preset.models.length > 0) {
        setModel(preset.models[0])
      } else {
        setModel('')
      }
    }
  }, [provider])

  const startNew = () => {
    setEditingId(null)
    setName('')
    setProvider('openai')
    setBaseUrl('')
    setApiKey('')
    setModel('')
    setTestResult('idle')
  }

  const startEdit = (p: Profile) => {
    setEditingId(p.id)
    setName(p.name)
    setProvider(p.provider)
    setBaseUrl(p.base_url)
    setApiKey('')  // don't reveal full key
    setModel(p.model)
    setTestResult('idle')
  }

  const activateProfile = (id: string) => {
    fetch(`/api/config/activate/${id}`, { method: 'POST', headers: getAuthHeaders() })
      .then(() => loadProfiles())
      .catch((e) => { console.error('Failed to activate profile:', e) })
  }

  const deleteProfile = (id: string) => {
    if (!confirm('确定删除此配置？')) return
    fetch(`/api/config/profile/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      .then(() => {
        if (editingId === id) startNew()
        loadProfiles()
      })
      .catch((e) => { console.error('Failed to delete profile:', e) })
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult('idle')
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          api_key: apiKey,
          base_url: baseUrl,
          model,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTestResult('ok')
        setTestMessage('连接成功')
      } else {
        setTestResult('fail')
        setTestMessage(data.detail || '连接失败')
      }
    } catch (e) {
      setTestResult('fail')
      setTestMessage(String(e))
    } finally {
      setTesting(false)
    }
  }

  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    if (!editingId && !apiKey) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/config/profile', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: editingId || '',
          name: name.trim(),
          provider,
          api_key: apiKey,
          base_url: baseUrl,
          model,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '保存失败' }))
        setSaveError(err.detail || '保存失败')
        return
      }
      loadProfiles()
      startNew()
      setSaveError('')
    } catch (e) {
      setSaveError('网络错误，请确认后端服务已启动')
    } finally {
      setSaving(false)
    }
  }

  const activeProfile = profiles.find((p) => p.is_active)

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">模型配置</h2>
        <p className="text-sm text-gray-500 mt-1">
          管理多个模型配置，点击即可切换。当前使用：
          <span className="text-indigo-600 font-medium ml-1">
            {activeProfile ? `${activeProfile.name} (${activeProfile.model})` : '未配置'}
          </span>
        </p>
      </div>

      {/* Saved profiles */}
      {profiles.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">已保存的配置</label>
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                p.is_active ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  {p.name}
                  {p.is_active && (
                    <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">当前</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {p.provider} / {p.model}
                </div>
              </div>
              {!p.is_active && (
                <button
                  onClick={() => activateProfile(p.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1"
                >
                  启用
                </button>
              )}
              <button
                onClick={() => startEdit(p)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                编辑
              </button>
              <button
                onClick={() => deleteProfile(p.id)}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="border-t pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            {editingId ? '编辑配置' : '新增配置'}
          </h3>
          {editingId && (
            <button onClick={startNew} className="text-xs text-indigo-600 hover:text-indigo-800">
              + 新建
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">配置名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：我的DeepSeek、学校提供的API"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">服务提供商</label>
          <div className="grid grid-cols-2 gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`text-left p-2 rounded-lg border text-xs transition-colors ${
                  provider === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-800">{p.label}</div>
                <div className="text-gray-400">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">API 地址</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={editingId ? '留空则不修改' : 'sk-...'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">模型名称</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={!apiKey || testing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
            测试连接
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || (!editingId && !apiKey) || saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存配置
          </button>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-50 text-red-700">
            <XCircle size={16} />
            {saveError}
          </div>
        )}

        {testResult !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {testMessage}
          </div>
        )}
      </div>
    </div>
  )
}
