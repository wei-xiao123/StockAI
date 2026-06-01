# AI股票分析助手

一个面向 A 股场景的 AI 股票分析助手，提供多周期 K 线概览、结构化 AI 研判、登录口令校验、会话隔离和历史记录追溯。

在线访问地址：`https://stockai-wxiao.onrender.com`

## 功能概览

- 6 位 A 股代码查询
- 日 K、周 K、月 K 多周期图表和均线展示
- 基于 SiliconFlow `deepseek-ai/DeepSeek-V4-Flash` 的结构化 AI 分析
- 访问口令登录与后端会话校验
- 基于 Supabase 的历史记录保存与按用户隔离查询
- 前后端同域部署，生产环境只暴露一个站点域名

## 操作说明

1. 打开线上地址
2. 输入访问口令 `wxiao`
3. 在首页输入 6 位股票代码
4. 点击查询并运行 AI 分析
5. 可以在历史记录页查看当前会话的数据

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

云服务模式
- 使用 SiliconFlow 生成 AI 分析
- 使用 Supabase 保存和查询历史记录
- 使用 AkShare 拉取真实行情

## Prompt 约束设计

本项目在 AI 分析链路中，使用三层约束来尽量保证大模型只返回合法 JSON，不输出额外解释、Markdown 或无关文本。

### 1. System Prompt

来源文件：

- [backend/app/services/analysis.py](/E:/work/StockAI/backend/app/services/analysis.py:175)

对应代码：

```python
{
    "role": "system",
    "content": "你是一个严格输出 JSON 的 A 股分析助手。只返回合法 JSON，不要输出其他内容。",
}
```

作用：

- 先在系统层面限定模型角色
- 明确禁止输出 JSON 之外的自然语言
- 作为最外层的行为约束

### 2. User Prompt

来源文件：

- [backend/app/services/analysis.py](/E:/work/StockAI/backend/app/services/analysis.py:128)

对应代码：

```python
return f"""
你是一个只基于给定行情数据输出结构化结论的 A 股分析助手。
不要输出 Markdown，不要输出解释，不要补充任何 schema 外字段。
你必须只返回符合 schema 的 JSON。

输出要求：
- summary: 2 到 4 句中文总结，聚焦当前走势、动量和风险，不要出现“无法保证”之类套话。
- sentiment: 只能是 bullish / neutral / bearish 之一。
- risk_level: 只能是 low / medium / high 之一。
- key_drivers: 必须正好 3 条，每条一句简洁中文。
- risk_factors: 必须 2 到 3 条，每条一句简洁中文。
- 只能依据提供的数据做判断，不要杜撰新闻、财报、政策或基本面。

股票信息：
- 股票代码: {overview.symbol}
- 股票名称: {overview.stock_name}
- 市场: {overview.market}
- 最新交易日: {overview.latest_trade_date}

最新报价：
- 开盘: {overview.quote.open}
- 最高: {overview.quote.high}
- 最低: {overview.quote.low}
- 收盘: {overview.quote.close}
- 涨跌幅: {overview.quote.change_percent}%
- 成交量: {overview.quote.volume}
- 成交额: {overview.quote.amount}

图表摘要：
- 时间区间: {chart_summary.date_range}
- 最新收盘: {chart_summary.latest_close}
- 最新涨跌幅: {chart_summary.latest_change_percent}%
- 趋势备注: {chart_summary.trend_note}

最近 10 个交易日样本：
{json.dumps(latest_points, ensure_ascii=False, indent=2)}
""".strip()
```

作用：

- 明确返回字段和枚举范围
- 限制中文输出风格和条目数量
- 限制分析依据只能来自传入行情数据
- 降低模型“自由发挥”导致的 JSON 漂移

### 3. 接口级约束

来源文件：

- [backend/app/services/analysis.py](/E:/work/StockAI/backend/app/services/analysis.py:170)

对应代码：

```json
{
  "model": "deepseek-ai/DeepSeek-V4-Flash",
  "messages": [
    {
      "role": "system",
      "content": "你是一个严格输出 JSON 的 A 股分析助手。只返回合法 JSON，不要输出其他内容。"
    },
    {
      "role": "user",
      "content": "build_analysis_prompt(...) 生成的完整用户提示词"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 512,
  "response_format": {
    "type": "json_object"
  }
}
```

作用：

- 从模型接口层面要求返回 `json_object`
- 配合 `system prompt` 和 `user prompt` 形成三重保险
- 即使模型偶尔偏离，也会在后端再走 Pydantic JSON 校验

## JSON 结果校验

项目不仅要求模型“尽量按 JSON 返回”，还会在后端做结构校验。

相关文件：

- [backend/app/services/analysis.py](/E:/work/StockAI/backend/app/services/analysis.py:209)
- [backend/app/schemas/analysis.py](/E:/work/StockAI/backend/app/schemas/analysis.py)

校验逻辑包括：

- 解析返回内容是否为合法 JSON
- 校验字段是否符合 `AnalysisOutput` schema
- 非法内容触发重试
- 若仍失败，则按配置决定是否回退到本地分析

## Debug 记录

### 1. Render 部署阶段前端构建失败

问题现象：

- Render 首次部署时，前端静态资源没有正确打包进最终镜像，导致单服务部署链路不完整。

定位与修复：

- 将前端构建独立放在 `Dockerfile` 的 `frontend-builder` 阶段
- 先复制 `frontend/package.json` 和 `frontend/package-lock.json`，执行 `npm install`
- 再复制完整前端源码并执行 `npm run build`
- 最后把 `/app/frontend/dist` 复制到运行时镜像中

对应文件：

- [Dockerfile](/E:/work/StockAI/Dockerfile)

关键代码：

```dockerfile
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
```

结果：

- Render 可以稳定完成前端构建
- FastAPI 运行镜像中能拿到完整 `frontend/dist`
- 单域名部署链路恢复正常

### 2. 前端路由刷新后出现 404

问题现象：

- 在生产环境中，用户直接刷新 `/history` 这类前端路由时，请求会打到服务端
- 如果后端只提供 API 而不做 SPA fallback，就会返回 404

定位与修复：

- 在 FastAPI 中挂载前端静态资源目录
- 对 `/assets` 做静态文件托管
- 对非 `/api/*` 的路径统一回退到 `index.html`
- 这样 React Router 就能在浏览器刷新后重新接管页面

对应文件：

- [backend/app/main.py](/E:/work/StockAI/backend/app/main.py)

关键代码：

```python
if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        requested_path = FRONTEND_DIST_DIR / full_path
        if full_path and requested_path.is_file():
            return FileResponse(requested_path)

        index_path = FRONTEND_DIST_DIR / "index.html"
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(index_path)
```

结果：

- 直接访问或刷新 `/history` 不再 404
- 单服务部署下的前端路由可正常工作
- 不需要额外再挂一层静态站点或前端反向代理

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

ACCESS_PASSWORD=wxiao
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
