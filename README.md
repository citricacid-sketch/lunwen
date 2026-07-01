# 智能学术写作平台

面向本科生的 AI 学术论文写作辅助工具。8 种写作处理模式 + 7 种图表生成 + 多 Agent 协作，兼容任意 OpenAI 协议的大语言模型。

---

## 快速开始

### 环境要求

| 工具 | 版本 | 安装方式 |
|------|------|---------|
| Python | >= 3.12 | https://www.python.org/downloads/ |
| Node.js | >= 20 | https://nodejs.org/ |
| uv | 最新版 | `pip install uv` |
| Docker Desktop | 最新版 | 仅数据库模式需要 |

### 方式一：开发模式

**1. 启动 MySQL**

```bash
docker compose up -d db
```

MySQL 暴露在 `localhost:3307`，避免与本机 3306 冲突。

**2. 配置环境变量**

```bash
cd backend
cp .env.example .env   # 按需编辑，至少填入 OPENAI_API_KEY
```

**3. 启动后端**

```bash
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**4. 启动前端**（新终端）

```bash
cd frontend
npm install
npm run dev
```

**5. 访问** `http://localhost:5173`，首次使用进入「设置」配置 API Key。

### 方式二：Docker 一键部署

```bash
export MYSQL_ROOT_PASSWORD=your-password
export JWT_SECRET=your-jwt-secret
docker compose up -d
# http://localhost:8000
```

---

## 功能说明

### 论文写作（`/rewrite`）— 7 种模式

| 模式 | 说明 |
|------|------|
| **学术润色** | 口语化 → 正式学术表达。三种风格：正式学术化 / 简洁精炼 / 学术扩写 |
| **降重改写** | 句式变换、词汇替换、语序调整等多维策略降低重复率 |
| **摘要生成** | 正文 → 摘要 + 关键词。结构：背景 → 方法 → 发现 → 结论 |
| **结构优化** | 诊断段落逻辑问题：主题句明确性、论证顺序、支撑充分性、衔接流畅度 |
| **语法校对** | 精确修正语法错误，遵循"最小修改原则" |
| **引言/结论** | 根据正文内容提炼引言或结论，不编造数据 |
| **文献综述** | 按主题脉络组织文献，述评结合而非简单罗列 |

**操作流程**：
1. 选择功能模式 → 粘贴论文段落（最多 50000 字）
2. 点击「开始处理」→ 查看原文与结果并排对比
3. 工具栏：复制 / 下载 Word / 下载 TXT / 重试 / 清空
4. 支持文件上传（`.docx` / `.pdf` / `.txt`），上传后可用「撤消」恢复原文
5. **迭代追问**：展开结果下方的面板，输入指令继续优化（可无限迭代）
6. **历史记录**：右上角展开时间线，支持回档到任意版本（不重新调 API，即时恢复）

### 图表生成（`/er-diagram`）— 8 种类型

| 类型 | 适用场景 |
|------|---------|
| ER 图 | 数据库设计、实体关系建模 |
| 流程图 | 业务流程、算法逻辑 |
| 时序图 | 系统交互、API 调用链 |
| 类图 | 面向对象设计、类关系 |
| 状态图 | 状态流转、生命周期 |
| 甘特图 | 项目计划、进度安排 |
| 架构图 | 系统架构、组件关系 |
| 表格插图 | 配置对比、数据表格 |

每种类型提供示例文本，点击「使用示例」一键填充。图表/源码双模式切换，源码模式下可编辑 Mermaid 代码。

### 论文导师（`/chat`）

多轮对话助手。支持文件上传分析、Enter 发送、Shift+Enter 换行。

### 参考文献格式化（`/reference`）

任意格式 → GB/T 7714-2015 国家标准。支持 7 种文献类型（期刊/专著/学位论文/会议/专利/电子资源/标准），逐条复制或批量下载。

---

## 输出规范

在提示词层面强制以下规范，确保输出符合学术论文要求：

- 输出为连续自然段落，段落间空行分隔
- 不出现项目符号、编号列表、"首先其次"等列表化表达
- 不出现"修改后文本如下""本文认为"等提示语
- 不编造数据、实验结果、技术方案等原文没有的内容
- 不删除原文的学术观点或论证环节

---

## 配置模型

「设置」页面（`/settings`）：
1. 选择提供商 → 填入 API Key → 测试连接 → 保存
2. 支持 7 种预设（OpenAI / DeepSeek / 通义千问 / 智谱 GLM / Moonshot / SiliconFlow / 自定义）
3. API Key 加密存储，可创建多套配置一键切换

---

## 测试

```bash
# 后端 — pytest + SQLite（免 MySQL）
cd backend && uv run pytest tests/ -v

# 前端 — vitest + jsdom（免浏览器）
cd frontend && npm test
```

---

## 项目结构

```
lunwen/
├── backend/
│   ├── app/
│   │   ├── api/                 # 路由：auth / rewrite / diagram / config / utils
│   │   ├── services/            # 业务逻辑 + LLM 抽象层
│   │   ├── models/              # Pydantic 请求/响应模型
│   │   ├── db/                  # SQLAlchemy ORM + 会话
│   │   ├── auth/                # JWT + bcrypt
│   │   ├── prompts/             # 提示词模板
│   │   ├── rag/                 # RAG 检索增强
│   │   ├── agents/              # 多 Agent 编排
│   │   └── main.py              # FastAPI 入口
│   ├── tests/                   # pytest（conftest + auth + config + health）
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── pages/               # Login / Rewrite / ERDiagram / Chat / Reference / Settings
│       ├── components/          # Layout / Rewrite / ERDiagram / Chat / Shared
│       ├── hooks/               # useStreamRewrite / useStreamDiagram / useChat / useHistory
│       ├── contexts/            # AuthContext
│       ├── services/            # API 客户端 + SSE 流式解析
│       ├── types/               # 全局类型定义
│       └── utils/               # clipboard / download
├── docker-compose.yml
└── Dockerfile
```

---

## 常见问题

**Q: 支持哪些模型？** — 兼容 OpenAI Chat Completions 协议的模型均可，预设 7 种提供商。

**Q: 结果不满意怎么办？** — 用「追问迭代」在当前结果上继续调整，可无限迭代。

**Q: 历史记录存在哪里？** — 本地 localStorage，与浏览器绑定（不依赖后端）。

**Q: 提示词可以自定义吗？** — 编辑 `backend/app/prompts/` 目录下的文件，重启后端生效。

**Q: 参考了哪些规范？** — 阿里巴巴 Java 开发手册（嵩山版）+ f2e-spec 前端规约。
