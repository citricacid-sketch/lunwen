/**
 * ERDiagram/EntityList.tsx — 实体与关系清单
 *
 * 展示后端从图表中解析出的结构化数据：
 *   - 实体卡片：名称 + 属性列表（字段名、类型、主键标记）
 *   - 关系列表：from → to : type (cardinality)
 *
 * 主要用于 ER 图，部分图表类型可能无此数据。
 */
import type { Entity, Relationship } from '../../types'

interface Props {
  entities: Entity[]
  relationships: Relationship[]
}

export function EntityList({ entities, relationships }: Props) {
  if (entities.length === 0 && relationships.length === 0) return null

  return (
    <div className="space-y-4">
      {/* 实体卡片 */}
      {entities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">实体清单</h4>
          <div className="grid gap-2">
            {entities.map((entity) => (
              <div
                key={entity.name}
                className="bg-white border border-gray-200 rounded-lg p-3"
              >
                <h5 className="text-sm font-semibold text-gray-800 mb-1">{entity.name}</h5>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {entity.attributes.map((attr) => (
                    <div key={attr.name} className="flex gap-2">
                      <span className="font-mono">{attr.name}</span>
                      <span className="text-gray-400">{attr.type}</span>
                      {attr.key && (
                        <span className="text-blue-600 font-medium">[{attr.key}]</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关系列表 */}
      {relationships.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">关系清单</h4>
          <div className="space-y-1">
            {relationships.map((rel, i) => (
              <div key={i} className="text-xs text-gray-600 bg-white border border-gray-100 rounded px-3 py-1.5">
                <span className="font-medium">{rel.from}</span>
                <span className="text-gray-400"> → </span>
                <span className="font-medium">{rel.to}</span>
                <span className="text-gray-400"> : {rel.type}</span>
                <span className="text-gray-400 ml-2">({rel.cardinality})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
