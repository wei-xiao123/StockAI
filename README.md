# AI股票分析助手

一个面向 A 股场景的 AI 股票分析助手，提供多周期 K 线概览、结构化 AI 研判、登录口令校验、会话隔离和历史记录追溯。

线上地址：`https://stockai-wxiao.onrender.com`


## 功能概览

- 6 位 A 股代码查询
- 日 K、周 K、月 K 多周期图表和均线展示
- 基于 SiliconFlow `deepseek-ai/DeepSeek-V4-Flash` 的结构化 AI 分析
- 访问口令登录与后端会话校验
- 基于 Supabase 的历史记录保存与按用户隔离查询
- 前后端同域部署，生产环境只暴露一个站点域名

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind CSS + ECharts
- 后端：FastAPI + Pydantic + Pandas + AkShare
- AI：SiliconFlow API
- 存储：Supabase
- 部署：Render Docker Web Service

## 项目结构

```text
StockAI/
├─ frontend/              # React 前端
├─ backend/               # FastAPI 后端
├─ supabase/init.sql      # Supabase 初始化脚本
├─ docs/project-spec.md   # 项目规格说明
├─ Dockerfile             # 单服务部署镜像
└─ render.yaml            # Render Blueprint
```

## 运行模式

项目支持两种模式：

1. 真实云服务模式
   - 使用 SiliconFlow 生成 AI 分析
   - 使用 Supabase 保存和查询历史记录
   - 使用 AkShare 拉取真实行情
2. 本地 fallback 模式
   - 未配置云服务时，可退回本地分析和本地演示行情
   - 便于本地开发和演示联调

## 本地开发

### 1. 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

默认地址：

- API: `http://127.0.0.1:8000`
- 健康检查: `http://127.0.0.1:8000/api/health`

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：

- 前端：`http://localhost:5174`

本地开发时，Vite 会自动把 `/api/*` 代理到 `http://127.0.0.1:8000`。

## 环境变量

后端读取 [backend/.env.example](/E:/work/StockAI/backend/.env.example) 作为模板。实际运行时使用 `backend/.env`。

核心变量如下：

```env
APP_ENV=development
API_PREFIX=/api
FRONTEND_ORIGIN=http://localhost:5174,http://127.0.0.1:5174

ACCESS_PASSWORD=rongxi
SESSION_SIGNING_SECRET=replace-with-at-least-16-characters
SESSION_COOKIE_SAMESITE=lax

SILICONFLOW_API_KEY=
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

ENABLE_LOCAL_ANALYSIS_FALLBACK=true
ENABLE_LOCAL_MARKET_DATA_FALLBACK=true
```

说明：

- `ACCESS_PASSWORD`：访问口令
- `SESSION_SIGNING_SECRET`：会话签名密钥
- `SILICONFLOW_*`：AI 分析配置
- `SUPABASE_*`：历史记录存储配置
- `ENABLE_LOCAL_ANALYSIS_FALLBACK`：未接入 AI 时是否允许本地规则分析
- `ENABLE_LOCAL_MARKET_DATA_FALLBACK`：外部行情不可用时是否允许本地演示行情

## Supabase 初始化

首次接入 Supabase 时，执行：

- [supabase/init.sql](/E:/work/StockAI/supabase/init.sql)

执行完成后，后端即可保存分析记录，并按用户会话隔离历史数据。

## 核心接口

认证：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

行情：

- `GET /api/stocks/{symbol}/overview`

分析：

- `POST /api/analyses`
- `GET /api/analyses`
- `GET /api/analyses/{analysis_id}`

系统：

- `GET /api/health`

## 本地验收建议

在本地启动前后端后，可按下面顺序验证：

1. 打开 `http://localhost:5174`
2. 输入访问口令登录
3. 查询股票代码，例如 `600519`
4. 检查日 K、周 K、月 K 是否正常渲染
5. 点击“运行 AI 分析”
6. 检查分析结果是否展示
7. 打开历史记录页，确认该会话下的数据可见
