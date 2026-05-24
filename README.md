# StockAI

AI 股票分析面板项目。

项目规范见 [docs/project-spec.md](docs/project-spec.md)。

## 目录

- `frontend/`: React + TypeScript + Vite 前端
- `backend/`: FastAPI 后端
- `supabase/init.sql`: Supabase 初始化 SQL

## 本地启动

### 前端

```bash
cd frontend
npm install
npm run dev
```

说明：
- 本地开发默认不需要填写 `VITE_API_BASE_URL`
- 留空时前端会直接使用相对路径 `/api/*`，通过 Vite 代理转发到本地后端
- 只有在你明确需要绕过代理时，才设置成完整后端地址

### 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

说明：
- 后端会稳定读取 `backend/.env`，不依赖你从哪个目录启动命令
- 即使你不配置 `SILICONFLOW_API_KEY`，项目也能本地使用：
  - AI 分析会自动退回到本地规则分析
  - 行情接口在外部数据源不可用时会自动返回本地演示数据
- 如果你不配置 `SUPABASE_*`：
  - AI 分析结果仍会返回给前端
  - 历史记录保存与历史记录查询接口会不可用

### 后端测试

```bash
cd backend
python -m unittest discover -s tests -v
```

## 本地可用模式

默认只在未接入 Supabase 的情况下支持下面这条本地链路：

1. 启动后端 `uvicorn app.main:app --reload`
2. 启动前端 `npm run dev`
3. 打开 `http://localhost:5174`
4. 输入任意 6 位股票代码，例如 `600519`
5. 查看概览图表
6. 点击“运行 AI 分析”
7. 在当前页面查看 AI 分析结果

本地 fallback 说明：
- `SiliconFlow` 未配置时，分析结果由后端本地规则引擎生成
- `Supabase` 未配置时，分析结果不会保存，历史记录页接口不可用
- `AkShare` 不可用时，概览页会展示本地演示行情

如果你之后要切回真实云服务，只需要在 `backend/.env` 中填写：
- `SESSION_SIGNING_SECRET`
- `SILICONFLOW_API_KEY`
- `SILICONFLOW_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

前端开发服务器默认运行在 `http://localhost:5174`，并通过 Vite 代理将 `/api/*` 转发到 `http://127.0.0.1:8000`。

## Render 部署准备

仓库根目录已经提供 `render.yaml`，用于在 Render 上创建单个 Docker Web Service：

- `stockai-wxiao`：FastAPI + 前端静态产物同域部署

部署前需要准备：

1. 在 Render 中连接当前 GitHub 仓库，并以根目录 `render.yaml` 作为 Blueprint。
2. 首次创建 Blueprint 时，按提示填写所有 `sync: false` 的环境变量：
   - `ACCESS_PASSWORD`
   - `SILICONFLOW_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 后端会自动生成 `SESSION_SIGNING_SECRET`。
4. 当前 Blueprint 会将前端打包进同一个 Docker 服务中：
   - 用户只访问一个域名：`https://stockai-wxiao.onrender.com`
   - 前端页面和 `/api/*` 接口由同一个 Render 服务提供
5. 后端生产环境默认使用：
   - `SESSION_COOKIE_SAMESITE=lax`

注意：

- Render Blueprint 中 `sync: false` 的变量只会在首次创建时提示输入，后续更新 Blueprint 时不会再次提示。
- 当前 FastAPI 已内置前端静态文件托管和 SPA fallback，直接访问 `/history` 不会因为前端路由导致 404。
- 当前部署模式不再需要单独的 Render Static Site，也不再依赖前端域名反向代理 `/api`。
