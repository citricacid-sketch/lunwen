"""
图表生成提示词 — 要求 LLM 输出纯 HTML+CSS 的论文插图。
图片宽度自适应容器，不设固定像素宽度。
"""

CSS_RULES = """【CSS 技术规范】
- 外层容器: width: fit-content; min-width: 40%; max-width: 100%; margin: 0 auto; padding: 16px 20px; box-sizing: border-box;
- 字体: font-family: "SimSun", "宋体", "Microsoft YaHei", sans-serif; font-size: 13px; color: #000;
- 背景: background: #fff;
- 边框统一: border: 1.5px solid #000
- 图片内部元素使用百分比宽度或 flex 自适应，不要写死固定像素宽度
- 表格使用 width: 100%; border-collapse: collapse; 表头加浅灰底色 #f0f0f0
- 箭头使用 CSS border 三角形: width: 0; height: 0; border: 6px solid transparent; border-left: 10px solid #000;
- 连接线使用伪元素或独立 border 元素
- 布局使用 flexbox: display: flex; flex-wrap: wrap; gap: 16px; justify-content: center;
- 不要使用 box-shadow、渐变、颜色（只用黑白+浅灰）
- 所有 CSS 写在 <style> 标签内"""

OUTPUT_RULE = """【输出规则】
只输出 HTML 片段：以 <style> 标签开头，紧跟 body 内容。不要输出 <!DOCTYPE>、<html>、<head>、<body> 包装标签。不要解释，不要 Markdown 代码块。"""


def _make_system_prompt(type_guidance: str) -> str:
    return f"""你是一个论文插图生成器。根据用户描述，生成简洁规范的 HTML 插图。

【规则】
1. 白底黑字黑框（1-2px 细线）
2. 宽度按内容自适应（width: fit-content），不强行撑满，不写死 px 宽度
3. 字号 12-13px，padding 8-16px，gap 12-20px，紧凑克制
4. 不外链资源、不用图片
5. CSS 全写在 <style> 内

{CSS_RULES}

{type_guidance}

{OUTPUT_RULE}"""


ER_GUIDANCE = """【ER 图结构】
- 每实体一个紧凑 <table>，表头加粗居中显示实体名
- 表体列：属性名 | 类型 | 键(PK/FK)
- 多表 flex wrap 横向排列，表间用 ::after 竖线+基数标注连接"""

FLOWCHART_GUIDANCE = """【流程图结构】
- 步骤节点用 <div> + border 矩形，纵向排列
- 判断用菱形（四边 border 技巧），分叉出"是/否"
- 节点间用 ▼ 或 CSS 三角箭头连接
- 节点 padding: 8px 16px，字号 12px"""

SEQUENCE_GUIDANCE = """【时序图结构】
- 参与者矩形横向排列，下方 border-left: 1.5px dashed #000 画生命线
- 消息用横线+箭头+标签，间距紧凑（margin 10-16px）"""

CLASS_GUIDANCE = """【类图结构】
- 每个类用三行 <table>：类名(加粗) | 属性 | 方法
- 多类 flex 排列，间距 20px
- 关系用连线+空心三角箭头"""

STATE_GUIDANCE = """【状态图结构】
- 状态用 <div> + border + border-radius: 4px
- 初始态：小黑圆（12px, border-radius: 50%, background: #000）
- 终止态：border: 2px double #000
- 状态间用箭头连线+小字事件标签"""

GANTT_GUIDANCE = """【甘特图结构】
- <table> 布局：首列任务名，后续列时间刻度（字号 10px）
- 任务条用 <td> 内黑色 <div>（height: 18px），宽度百分比表示工期"""

ARCHITECTURE_GUIDANCE = """【架构图结构】
- 嵌套 <div> 分层（前端→后端→数据层），每层 flex 横向排组件
- 层间 border-top: 1.5px dashed #000 分隔
- 组件间箭头连线表示数据流"""

TABLE_GUIDANCE = """【表格插图结构】
- 用 <table> 实现，包含表序标题（如"表 3-1 xxx"）+ 说明文字
- 表格使用 width: 100%; border-collapse: collapse; border: 1.5px solid #000
- 表头 <th> 加浅灰底色 #f0f0f0，加粗居中
- 表体 <td> 有边框，偶数行可加 #fafafa 底色增强可读性
- 标题居中，字号 14px 加粗；说明文字居中，字号 11px
- 表格内容字号 11-12px，padding 6-10px，紧凑排版"""

DIAGRAM_PROMPTS = {
    "er": _make_system_prompt(ER_GUIDANCE),
    "flowchart": _make_system_prompt(FLOWCHART_GUIDANCE),
    "sequence": _make_system_prompt(SEQUENCE_GUIDANCE),
    "class": _make_system_prompt(CLASS_GUIDANCE),
    "state": _make_system_prompt(STATE_GUIDANCE),
    "gantt": _make_system_prompt(GANTT_GUIDANCE),
    "architecture": _make_system_prompt(ARCHITECTURE_GUIDANCE),
    "table": _make_system_prompt(TABLE_GUIDANCE),
}

DIAGRAM_TYPES = {
    "er": "ER 图",
    "flowchart": "流程图",
    "sequence": "时序图",
    "class": "类图",
    "state": "状态图",
    "gantt": "甘特图",
    "architecture": "架构图",
    "table": "表格插图",
}


def build_diagram_prompt(diagram_type: str) -> str:
    return DIAGRAM_PROMPTS.get(diagram_type, DIAGRAM_PROMPTS["er"])
