# CLAUDE.md — Lunwen 智能学术写作平台

## 会话启动

**每次对话开始时，先连接 Obsidian vault：**
- 读取 `D:/DATA/Obs/claude/synthesis/Synthesis Index.md` 了解已有经验
- 读取本文件了解项目规范

## 项目定位

多用户 Web 系统。本科论文写作辅助，8 种写作模式 + 7 种图表生成 + 多 Agent 协作。

## 技术栈

- 前端: React 19 + TypeScript 6 + Vite 8 + Tailwind 4
- 后端: FastAPI + SQLAlchemy 2.0 async + MySQL 8.0
- 部署: Docker Compose (MySQL + FastAPI)

## 开发规范

### 自我审查
每次代码改动后必须自查再汇报：
- 前端: `npx tsc --noEmit`
- 后端: `uv run python -c "from app.main import app"`
- UI 改动: 肉眼扫一遍确认无重复元素/冗余代码

### 知识归档
重要决策做完即记，两层都要写：
- **Obsidian vault**: `D:/DATA/Obs/claude/synthesis/` 写笔记，更新 `Synthesis Index.md`
- **Claude memory**: 决策/偏好写入 `memory/` 目录

### 技术决策（已确定，不要重复讨论）
- Agent 用**手写编排**，不用 LangChain
- 向量存储用 **sklearn 自建**，不用 ChromaDB
- Embedding 三级降级: API → sentence-transformers(可选) → HashingVectorizer
- 数据库用 **MySQL + SQLAlchemy async**
- 引用保护用**占位符掩码 → LLM 处理 → 还原**模式

## 启动方式

详见 [README.md](README.md#快速开始)。

```bash
# 开发模式
docker compose up -d db                     # 起 MySQL (localhost:3307)
cd backend && uv sync && uv run uvicorn app.main:app --reload
cd frontend && npm install && npm run dev   # http://localhost:5173

# 生产模式
docker compose up -d                        # http://localhost:8000

# 打包 EXE
build_exe.bat                               # 生成 dist/论文整改工具.exe
```
