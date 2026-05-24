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
