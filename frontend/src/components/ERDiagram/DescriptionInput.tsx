/**
 * ERDiagram/DescriptionInput.tsx — 图表生成输入表单
 *
 * 参数：
 *   - 图表类型选择（8 种，按钮组）
 *   - 场景描述（textarea + 文件上传）
 *
 * 每种图表类型都有对应的示例文本，点击「使用示例」一键填充。
 */
import { useState, type FormEvent } from 'react'
import { GitBranch } from 'lucide-react'
import type { DiagramType } from '../../types'
import { DIAGRAM_TYPE_LABELS } from '../../types'

interface Props {
  onSubmit: (description: string, diagramType: DiagramType) => void
  isLoading: boolean
  diagramType: DiagramType
  onDiagramTypeChange: (type: DiagramType) => void
}

/** 每种图表类型的示例描述，帮助用户快速上手 */
const EXAMPLES: Record<DiagramType, string> = {
  er: '学生可以选修多门课程，每门课程可以被多个学生选修。每个学生有学号、姓名、专业和入学日期。每门课程有课程号、课程名和学分。选修关系需要记录成绩和选课日期。',
  flowchart: '用户登录系统：首先输入用户名和密码，系统验证信息。如果验证通过则进入主页，如果验证失败则提示错误并允许重试，最多重试3次后锁定账户。',
  sequence: '用户通过手机App向服务器发起登录请求，服务器查询数据库验证用户信息，数据库返回验证结果，服务器生成token返回给App，App将token存储到本地。',
  class: '一个图书馆管理系统包含以下类：Book类有title、author、isbn属性和borrow()、return()方法。Member类有name、memberId属性和borrowBook()方法。Librarian继承自Member，增加了manageInventory()方法。',
  state: '一个订单的状态流转：从"待支付"开始，用户支付后进入"已支付"，商家确认后进入"已确认"，发货后进入"已发货"，用户确认收货后进入"已完成"。任何状态都可以进入"已取消"。',
  gantt: '一个软件开发项目计划：需求分析从1月1日开始，持续2周。系统设计在第3周开始，持续3周。编码实现在第5周开始，持续6周。测试在第10周开始，持续2周。部署在第12周进行。',
  architecture: '系统架构包含：前端React应用部署在CDN上，后端使用Nginx作为反向代理，API服务使用Node.js集群，数据存储使用PostgreSQL主从复制和Redis缓存。',
  table: '一张"开发环境配置"表，包含工具/环境和说明两列。Python 3.10是编程语言运行环境，PyCharm 2024是集成开发环境，Jupyter Notebook是交互式开发与数据分析平台。',
}

const DIAGRAM_TYPES: DiagramType[] = ['er', 'flowchart', 'sequence', 'class', 'state', 'gantt', 'architecture', 'table']

export function DescriptionInput({ onSubmit, isLoading, diagramType, onDiagramTypeChange }: Props) {
  const [description, setDescription] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (description.trim() && !isLoading) {
      onSubmit(description.trim(), diagramType)
    }
  }

  const handleUseExample = () => {
    setDescription(EXAMPLES[diagramType] || EXAMPLES.er)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 图表类型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">图表类型</label>
        <div className="flex flex-wrap gap-1.5">
          {DIAGRAM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onDiagramTypeChange(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                diagramType === type
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {DIAGRAM_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* 场景描述输入 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">场景描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`用自然语言描述你想生成的${DIAGRAM_TYPE_LABELS[diagramType]}场景...`}
          rows={6}
          maxLength={50000}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-y focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
        />
        <div className="flex justify-between mt-1">
          <button
            type="button"
            onClick={handleUseExample}
            className="text-xs text-emerald-600 hover:text-emerald-800"
          >
            使用示例
          </button>
          <span className="text-xs text-gray-400">{description.length} / 50000 字符</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!description.trim() || isLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <GitBranch size={16} />
          {isLoading ? '生成中...' : `生成 ${DIAGRAM_TYPE_LABELS[diagramType]}`}
        </button>

        {isLoading && (
          <button
            type="button"
            onClick={() => onSubmit('__abort__', diagramType)}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            取消
          </button>
        )}
      </div>
    </form>
  )
}
