import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BrainCircuit,
  Database,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Bot,
} from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { createAnalysis, fetchStockOverview } from '../lib/api'
import type { AnalysisResponse, RiskLevel, Sentiment } from '../types/api'

const presets = ['600519', '000001', '300750']
const LAST_SYMBOL_STORAGE_KEY = 'stockai:last-symbol'
const LAST_ANALYSIS_STORAGE_KEY = 'stockai:last-analysis'
const StockOverviewChart = lazy(() =>
  import('../components/market/stock-overview-chart').then((module) => ({
    default: module.StockOverviewChart,
  })),
)

const numberFormatter = new Intl.NumberFormat('zh-CN')
const priceFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const compactCurrencyFormatter = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

export function AnalysisPage() {
  const [symbolInput, setSymbolInput] = useState('')
  const [submittedSymbol, setSubmittedSymbol] = useState('')
  const [formError, setFormError] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analysisRequestIdRef = useRef(0)

  const overviewQuery = useQuery({
    queryKey: ['stock-overview', submittedSymbol],
    queryFn: () => fetchStockOverview(submittedSymbol),
    enabled: submittedSymbol.length === 6,
    retry: 1,
    staleTime: 60_000,
  })

  useEffect(() => {
    const savedSymbol = window.localStorage.getItem(LAST_SYMBOL_STORAGE_KEY)?.trim() ?? ''
    if (!/^\d{6}$/.test(savedSymbol)) {
      return
    }

    setSymbolInput(savedSymbol)
    setSubmittedSymbol(savedSymbol)

    const savedAnalysis = window.localStorage.getItem(LAST_ANALYSIS_STORAGE_KEY)
    if (!savedAnalysis) {
      return
    }

    try {
      const parsed = JSON.parse(savedAnalysis) as AnalysisResponse
      if (parsed.stock.symbol === savedSymbol) {
        setAnalysisResult(parsed)
      }
    } catch {
      window.localStorage.removeItem(LAST_ANALYSIS_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (submittedSymbol.length === 6) {
      window.localStorage.setItem(LAST_SYMBOL_STORAGE_KEY, submittedSymbol)
      return
    }

    window.localStorage.removeItem(LAST_SYMBOL_STORAGE_KEY)
  }, [submittedSymbol])

  useEffect(() => {
    if (!analysisResult) {
      window.localStorage.removeItem(LAST_ANALYSIS_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(LAST_ANALYSIS_STORAGE_KEY, JSON.stringify(analysisResult))
  }, [analysisResult])

  function submitSymbol(symbol: string) {
    const normalizedSymbol = symbol.trim()
    if (!/^\d{6}$/.test(normalizedSymbol)) {
      setFormError('请输入 6 位 A 股股票代码，例如 600519。')
      return
    }

    analysisRequestIdRef.current += 1
    setIsAnalyzing(false)
    setAnalysisResult(null)
    setAnalysisError('')
    setFormError('')
    setSubmittedSymbol(normalizedSymbol)
    setSymbolInput(normalizedSymbol)

    const savedAnalysis = window.localStorage.getItem(LAST_ANALYSIS_STORAGE_KEY)
    if (!savedAnalysis) {
      return
    }

    try {
      const parsed = JSON.parse(savedAnalysis) as AnalysisResponse
      if (parsed.stock.symbol === normalizedSymbol) {
        setAnalysisResult(parsed)
      } else {
        window.localStorage.removeItem(LAST_ANALYSIS_STORAGE_KEY)
      }
    } catch {
      window.localStorage.removeItem(LAST_ANALYSIS_STORAGE_KEY)
    }
  }

  async function handleRunAnalysis() {
    if (!overview) {
      return
    }

    const requestId = analysisRequestIdRef.current + 1
    analysisRequestIdRef.current = requestId
    setIsAnalyzing(true)
    setAnalysisError('')
    setAnalysisResult(null)

    try {
      const response = await createAnalysis({
        symbol: overview.symbol,
      })
      if (analysisRequestIdRef.current !== requestId) {
        return
      }

      setAnalysisResult(response)
    } catch (error) {
      if (analysisRequestIdRef.current !== requestId) {
        return
      }

      setAnalysisError(error instanceof Error ? error.message : 'AI 分析失败，请稍后重试。')
    } finally {
      if (analysisRequestIdRef.current === requestId) {
        setIsAnalyzing(false)
      }
    }
  }

  const overview = overviewQuery.data
  const analysisSentimentMeta = analysisResult
    ? getSentimentMeta(analysisResult.analysis.sentiment)
    : null
  const analysisRiskMeta = analysisResult
    ? getRiskMeta(analysisResult.analysis.risk_level)
    : null
  const analysisSaveMeta = analysisResult ? getSaveMeta(analysisResult.save_status) : null

  return (
    <>
      <Card className="overflow-hidden border-slate-200/70 bg-[linear-gradient(90deg,rgba(248,250,252,0.98),rgba(255,252,245,0.96),rgba(255,255,255,0.98))] shadow-[0_14px_44px_rgba(15,23,42,0.05)]">
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-600">
                Quant Engine v1.0
              </span>
            </div>
            <CardTitle className="max-w-xl text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-4xl">
              输入 A 股代码，<span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">解锁多周期技术图表</span>
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
              一键无缝切换日 K、周 K、月 K，多周期动态感知主力资金情绪变化。
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-[0.24em]">Market Scope</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1">日 K / 周 K / 月 K</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1">AI 研判</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1">结构化分析</span>
            </div>
          </div>

          <form
            className="rounded-[2rem] border border-slate-200/70 bg-white/90 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] backdrop-blur"
            onSubmit={(event) => {
              event.preventDefault()
              submitSymbol(symbolInput)
            }}
          >
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
              STOCK SYMBOL / 股票检索
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={symbolInput}
                onChange={(event) => {
                  setSymbolInput(event.target.value.replace(/\D/g, '').slice(0, 6))
                  if (formError) {
                    setFormError('')
                  }
                }}
                placeholder="请输入 6 位股票代码，例如 000001"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-32 text-sm font-semibold text-slate-800 shadow-inner outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                inputMode="numeric"
                autoComplete="off"
              />
              <Button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
              >
                查询概览
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">快捷示例</span>
              {presets.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => submitSymbol(symbol)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all hover:-translate-y-0.5 hover:shadow-sm ${presetButtonClassName(symbol)}`}
                >
                  {symbol}
                </button>
              ))}
            </div>
            {formError ? <p className="mt-3 text-sm text-rose-600">{formError}</p> : null}
            {overviewQuery.isError ? (
              <p className="mt-3 text-sm text-rose-600">{overviewQuery.error.message}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {overviewQuery.isLoading ? (
        <div className="grid gap-6">
          <Card className="animate-pulse">
            <CardContent className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="rounded-[1.25rem] bg-muted/80 p-5">
                  <div className="h-3 w-20 rounded-full bg-border" />
                  <div className="mt-4 h-9 w-24 rounded-full bg-border" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="animate-pulse">
            <CardContent>
              <div className="h-[520px] rounded-[1.5rem] bg-muted/80" />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!submittedSymbol && !overviewQuery.isLoading ? (
        <Card className="overflow-hidden border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
          <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_1fr] lg:items-stretch lg:p-8">
            <div className="flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
                  ⚡ 准备就绪 / Ready
                </Badge>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                  欢迎使用AI股票分析助手
                </h3>
                <p className="max-w-xl text-sm leading-7 text-slate-500">
                  当前系统已接入真实行情雷达。在上方输入合法的 6 位 A 股股票代码，
                  系统将自动联动多周期图表与大模型研判，生成结构化量化摘要。
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                <span className="animate-bounce">☝️</span>
                <span>在上方搜索框内输入代码，即刻开启 AI 智能研判</span>
              </div>
            </div>

            <div className="grid gap-3.5">
              {[
                {
                  icon: Sparkles,
                  iconClassName: 'bg-blue-50 text-blue-600',
                  title: '全周期 K 线自适应引擎',
                  desc: '一键调取日 K、周 K、月 K 与均线量价关系，免去前端二次计算。',
                },
                {
                  icon: BrainCircuit,
                  iconClassName: 'bg-indigo-50 text-indigo-600',
                  title: 'LLM 严格结构化语义分析',
                  desc: '基于大模型 JSON 结构，对波动率、情绪与趋势进行专业研判。',
                },
                {
                  icon: Database,
                  iconClassName: 'bg-emerald-50 text-emerald-600',
                  title: 'Supabase 高并发历史追溯',
                  desc: '分析记录自动写入云端数据库，支持无缝回看与历史检索。',
                },
              ].map(({ icon: Icon, iconClassName, title, desc }) => (
                <div
                  key={title}
                  className="group flex items-start rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md"
                >
                  <div className={`mr-3.5 rounded-xl p-2.5 transition-colors ${iconClassName}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black tracking-wide text-slate-800">{title}</h4>
                    <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {overview ? (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="overflow-hidden">
              <CardHeader className="gap-3 border-b border-border/70 pb-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{overview.market}</Badge>
                  <span className="font-mono text-sm text-muted-foreground">
                    {overview.symbol}
                  </span>
                </div>
                <CardTitle className="text-3xl">{overview.stock_name}</CardTitle>
                <CardDescription className="text-sm">
                  最新交易日 {overview.latest_trade_date}，已标准化为多周期图表数据。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
                <OverviewMetricCard
                  label="最新收盘"
                  prefix="¥"
                  value={priceFormatter.format(overview.quote.close)}
                  footerLeft={`昨收 ${priceFormatter.format(getPreviousClose(overview.quote.close, overview.quote.change_percent))}`}
                  footerRight={`今开 ${priceFormatter.format(overview.quote.open)}`}
                  tone={overview.quote.change_percent >= 0 ? 'up' : 'down'}
                />
                <OverviewMetricCard
                  label="涨跌幅"
                  value={`${overview.quote.change_percent >= 0 ? '+' : ''}${overview.quote.change_percent.toFixed(2)}`}
                  suffix="%"
                  footerLeft={`最高 ${priceFormatter.format(overview.quote.high)}`}
                  footerRight={`最低 ${priceFormatter.format(overview.quote.low)}`}
                  tone={overview.quote.change_percent >= 0 ? 'up' : 'down'}
                  emphasizeIcon
                />
                <OverviewMetricCard
                  label="成交量"
                  value={formatScaledValue(overview.quote.volume, 10_000).value}
                  suffix={formatScaledValue(overview.quote.volume, 10_000).unit}
                  footerLeft={`原始股数 ${numberFormatter.format(Math.round(overview.quote.volume))} 手`}
                  tone="neutral"
                />
                <OverviewMetricCard
                  label="成交额"
                  prefix="¥"
                  value={formatAmountValue(overview.quote.amount).value}
                  suffix={formatAmountValue(overview.quote.amount).unit}
                  footerLeft={`原始成交额 ${compactCurrencyFormatter.format(overview.quote.amount)}`}
                  tone="neutral"
                />
              </CardContent>
            </Card>

            <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,246,255,0.95))]">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>AI 分析入口</CardTitle>
                    <CardDescription>
                      点击运行后，AI 引擎将多维穿透盘面量价，联动大模型一键生成多空评级与深度逻辑研报。
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '分析中...' : '运行 AI 分析'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!analysisResult && !isAnalyzing ? (
                  <div className="grid gap-3 text-sm leading-7 text-muted-foreground">
                    <InfoRow
                      icon={Sparkles}
                      text="智能全盘扫描：结合日 K、周 K、月 K 及量价关系，捕捉潜在趋势拐点。"
                    />
                    <InfoRow
                      icon={BrainCircuit}
                      text="多维度情绪建模：提取市场核心情绪指标，量化评估多空力量对比。"
                    />
                    <InfoRow
                      icon={TriangleAlert}
                      text="风险量化评级：剖析异常波动与成交变化，提前提示破位或洗盘风险。"
                    />
                    <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm leading-7 text-muted-foreground">
                      风险提示：AI 生成结果基于历史公开数据建模，不构成任何实质性投资建议。
                    </div>
                  </div>
                ) : isAnalyzing ? (
                  <div className="grid gap-3">
                    {[0, 1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="animate-pulse rounded-2xl bg-white/80 px-4 py-4"
                      >
                        <div className="h-4 w-24 rounded-full bg-border" />
                        <div className="mt-3 h-3 w-5/6 rounded-full bg-border" />
                        <div className="mt-2 h-3 w-4/6 rounded-full bg-border" />
                      </div>
                    ))}
                    <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary">
                      AI 正在研判最新多周期行情，请稍候...
                    </div>
                  </div>
                ) : analysisResult ? (
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant={
                          analysisResult.analysis.sentiment === 'bullish'
                            ? 'danger'
                            : analysisResult.analysis.sentiment === 'bearish'
                              ? 'success'
                              : 'secondary'
                        }
                      >
                        {analysisResult.analysis.sentiment === 'bullish'
                          ? '📈 看多 (Bullish)'
                          : analysisResult.analysis.sentiment === 'bearish'
                            ? '📉 看空 (Bearish)'
                            : '⚖️ 中性 (Neutral)'}
                      </Badge>
                      <Badge
                        variant={
                          analysisResult.analysis.risk_level === 'high'
                            ? 'danger'
                            : analysisResult.analysis.risk_level === 'low'
                              ? 'success'
                              : 'secondary'
                        }
                      >
                        ⚠️ {analysisResult.analysis.risk_level}
                      </Badge>
                      <Badge variant={analysisResult.save_status === 'saved' ? 'success' : 'danger'}>
                        {analysisResult.save_status === 'saved' ? '已保存' : '未保存'}
                      </Badge>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Bot className="h-4 w-4 text-primary" />
                        AI 核心总结
                      </div>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {analysisResult.analysis.summary}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        风险评级
                      </div>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {analysisResult.analysis.risk_level}
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>多周期 K 线与均线</CardTitle>
                  <CardDescription>
                    支持日 K、周 K、月 K 视图切换。
                  </CardDescription>
                </div>
                <div className="rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
                  数据源: AkShare / 东方财富日线
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Suspense
                fallback={<div className="h-[520px] rounded-[1.5rem] bg-muted/80 animate-pulse" />}
              >
                <StockOverviewChart overview={overview} />
              </Suspense>
            </CardContent>
          </Card>

          {isAnalyzing ? (
            <Card className="overflow-hidden border-primary/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(232,244,255,0.95))]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge>AI 分析中</Badge>
                  <Badge variant="secondary">{overview.symbol}</Badge>
                </div>
                <CardTitle className="text-2xl">正在生成结构化分析结果</CardTitle>
                <CardDescription>
                  本模块由 DeepSeek 深度推理算法提供核心算力支持。系统正在对多维盘面指标进行流式清洗与策略逻辑校验，全自动拦截并修正异常扰动数据。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    label: '📊 盘面多周期均线研判 / MA Cross',
                    dotClassName: 'bg-blue-400/60',
                    titleWidth: 'w-3/4',
                    lineWidth: 'w-5/6',
                    shimmerClassName: 'animate-[shimmer_2s_infinite]',
                  },
                  {
                    label: '💰 主力资金与筹码穿透 / Capital Flow',
                    dotClassName: 'bg-indigo-400/60',
                    titleWidth: 'w-1/2',
                    lineWidth: 'w-4/5',
                    shimmerClassName: 'animate-[shimmer_2s_infinite_0.2s]',
                  },
                  {
                    label: '⚠️ 波动率与极端风险度量 / Volatility Risk',
                    dotClassName: 'bg-amber-400/60',
                    titleWidth: 'w-2/3',
                    lineWidth: 'w-11/12',
                    shimmerClassName: 'animate-[shimmer_2s_infinite_0.4s]',
                  },
                  {
                    label: '🎯 决策矩阵与综合多空评级 / Strategy Rating',
                    dotClassName: 'bg-emerald-400/60',
                    titleWidth: 'w-5/12',
                    lineWidth: 'w-3/4',
                    shimmerClassName: 'animate-[shimmer_2s_infinite_0.6s]',
                  },
                ].map(({ label, dotClassName, titleWidth, lineWidth, shimmerClassName }) => (
                  <div
                    key={label}
                    className="relative overflow-hidden rounded-[1.35rem] border border-slate-100 bg-white/65 p-5 shadow-sm"
                  >
                    <div
                      className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-100/50 to-transparent ${shimmerClassName}`}
                    />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                        {label}
                      </span>
                      <div className={`h-1.5 w-1.5 rounded-full animate-ping ${dotClassName}`} />
                    </div>
                    <div className="relative mt-4 space-y-2.5">
                      <div className={`h-6 rounded-lg bg-slate-100 ${titleWidth} animate-pulse`} />
                      <div className="h-3 w-full rounded-md bg-slate-100/80 animate-pulse" />
                      <div className={`h-3 rounded-md bg-slate-100/80 animate-pulse ${lineWidth}`} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {analysisError ? (
            <Card className="border-rose-200 bg-rose-50/70">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge variant="danger">AI 分析失败</Badge>
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                </div>
                <CardTitle>当前这次分析没有成功返回结果</CardTitle>
                <CardDescription className="text-rose-700">
                  {analysisError}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {analysisResult ? (
            <Card
              className={`overflow-hidden border shadow-[0_20px_60px_rgba(15,23,42,0.05)] ${analysisSentimentMeta?.cardClassName}`}
            >
              <CardHeader className="gap-5 border-b border-slate-200/80 pb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-bold tracking-[0.28em] text-white">
                      AI 智能研判
                    </Badge>
                    <Badge className={analysisSentimentMeta?.badgeClassName}>
                      {analysisSentimentMeta?.badgeLabel}
                    </Badge>
                    <Badge className={analysisRiskMeta?.badgeClassName}>
                      {analysisRiskMeta?.badgeLabel}
                    </Badge>
                    <Badge className={analysisSaveMeta?.badgeClassName}>
                      {analysisSaveMeta?.badgeLabel}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400">
                    ID:{' '}
                    <code className="rounded bg-slate-100 px-1.5 py-1 text-slate-600">
                      {formatRecordId(analysisResult.record_id)}
                    </code>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="max-w-3xl">
                    <CardTitle className="text-3xl tracking-tight">
                      {analysisResult.stock.stock_name} {analysisResult.stock.symbol}
                    </CardTitle>
                    <CardDescription className="mt-4 text-[1.05rem] leading-9 text-foreground/85">
                      {analysisResult.analysis.summary}
                    </CardDescription>
                  </div>
                  <div
                    className={`min-w-[280px] rounded-[1.4rem] border px-5 py-4 text-sm shadow-sm ${analysisSentimentMeta?.overviewClassName}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                      区间概览
                    </p>
                    <div className="mt-3">区间: {analysisResult.chart_summary.date_range}</div>
                    <div className="mt-2">
                      趋势: {analysisResult.chart_summary.trend_note}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <InsightPanel
                    title="关键驱动"
                    icon={BrainCircuit}
                    items={analysisResult.analysis.key_drivers}
                    iconClassName={analysisSentimentMeta?.iconClassName}
                    itemClassName={analysisSentimentMeta?.itemClassName}
                  />
                  <InsightPanel
                    title="潜在风险因素"
                    icon={ShieldAlert}
                    items={analysisResult.analysis.risk_factors}
                    iconClassName={analysisRiskMeta?.iconClassName}
                    itemClassName={analysisRiskMeta?.itemClassName}
                  />
                </div>
                <div className="grid gap-4">
                  <TrendSignalCard
                    sentimentMeta={analysisSentimentMeta}
                    riskLabel={analysisRiskMeta?.label ?? ''}
                  />
                  <PerformanceCard
                    latestChangePercent={analysisResult.chart_summary.latest_change_percent}
                    latestClose={analysisResult.chart_summary.latest_close}
                    sentiment={analysisResult.analysis.sentiment}
                  />
                  <SaveStatusCard
                    saveMeta={analysisSaveMeta}
                    recordId={analysisResult.record_id}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

        </>
      ) : null}
    </>
  )
}

type OverviewMetricCardProps = {
  label: string
  value: string
  prefix?: string
  suffix?: string
  footerLeft: string
  footerRight?: string
  tone?: 'up' | 'down' | 'neutral'
  emphasizeIcon?: boolean
}

function OverviewMetricCard({
  label,
  value,
  prefix,
  suffix,
  footerLeft,
  footerRight,
  tone = 'neutral',
  emphasizeIcon = false,
}: OverviewMetricCardProps) {
  const toneClassName =
    tone === 'up'
      ? 'border-rose-100 border-l-rose-500 bg-gradient-to-b from-rose-50/55 to-white'
      : tone === 'down'
        ? 'border-emerald-100 border-l-emerald-500 bg-gradient-to-b from-emerald-50/55 to-white'
        : 'border-slate-200 border-l-slate-400 bg-gradient-to-b from-slate-50/70 to-white'
  const valueClassName =
    tone === 'up'
      ? 'text-rose-600'
      : tone === 'down'
        ? 'text-emerald-600'
        : 'text-slate-900'
  const mutedAccentClassName =
    tone === 'up'
      ? 'text-rose-600'
      : tone === 'down'
        ? 'text-emerald-600'
        : 'text-slate-500'
  const SignalIcon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Activity

  return (
    <div
      className={`relative overflow-hidden rounded-[1.35rem] border border-l-4 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${toneClassName}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-end gap-1">
          {prefix ? (
            <span className={`pb-1 text-xs font-bold ${mutedAccentClassName}`}>{prefix}</span>
          ) : null}
          <span className={`text-[2rem] font-black leading-none tracking-tight ${valueClassName}`}>
            {value}
          </span>
          {suffix ? (
            <span className={`pb-1 text-xs font-bold ${mutedAccentClassName}`}>{suffix}</span>
          ) : null}
        </div>
        {emphasizeIcon ? (
          <div
            className={`rounded-full p-2 ${
              tone === 'up'
                ? 'bg-rose-100 text-rose-600'
                : tone === 'down'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <SignalIcon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/80 pt-3 text-[10px] text-slate-400">
        <span>{footerLeft}</span>
        {footerRight ? <span className={mutedAccentClassName}>{footerRight}</span> : null}
      </div>
    </div>
  )
}

type InfoRowProps = {
  icon: React.ComponentType<{ className?: string }>
  text: string
}

function InfoRow({ icon: Icon, text }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3">
      <div className="rounded-xl bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p>{text}</p>
    </div>
  )
}

type InsightPanelProps = {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: string[]
  iconClassName?: string
  itemClassName?: string
}

function InsightPanel({
  title,
  icon: Icon,
  items,
  iconClassName = 'bg-primary/10 text-primary',
  itemClassName = 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-50',
}: InsightPanelProps) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-xl p-2 ${iconClassName}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className={`rounded-xl border-l-4 px-4 py-3 text-sm leading-7 transition-colors ${itemClassName}`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

type SentimentMeta = {
  badgeLabel: string
  headline: string
  note: string
  badgeClassName: string
  cardClassName: string
  overviewClassName: string
  iconClassName: string
  itemClassName: string
  headlineClassName: string
  iconShellClassName: string
  progressBullClassName: string
  progressBearClassName: string
  bullPercent: number
  bearPercent: number
  SignalIcon: React.ComponentType<{ className?: string }>
}

type RiskMeta = {
  label: string
  badgeLabel: string
  badgeClassName: string
  iconClassName: string
  itemClassName: string
}

type SaveMeta = {
  badgeLabel: string
  badgeClassName: string
  panelClassName: string
  textClassName: string
}

type TrendSignalCardProps = {
  sentimentMeta: SentimentMeta | null
  riskLabel: string
}

function TrendSignalCard({ sentimentMeta, riskLabel }: TrendSignalCardProps) {
  if (!sentimentMeta) {
    return null
  }

  const SignalIcon = sentimentMeta.SignalIcon

  return (
    <div className={`rounded-[1.6rem] border p-5 shadow-sm ${sentimentMeta.overviewClassName}`}>
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
        市场趋势信号
      </p>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className={`text-3xl font-black tracking-tight ${sentimentMeta.headlineClassName}`}>
            {sentimentMeta.headline}
          </h3>
          <p className="mt-2 text-xs text-slate-500">{sentimentMeta.note}</p>
          <p className="mt-4 text-sm text-slate-600">风险等级: {riskLabel}</p>
        </div>
        <div className={`rounded-2xl p-3 ${sentimentMeta.iconShellClassName}`}>
          <SignalIcon className="h-7 w-7" />
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-1 flex justify-between text-[10px] text-slate-400">
          <span>多头力量 {sentimentMeta.bullPercent}%</span>
          <span>空头力量 {sentimentMeta.bearPercent}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={sentimentMeta.progressBullClassName}
            style={{ width: `${sentimentMeta.bullPercent}%` }}
          />
          <div
            className={sentimentMeta.progressBearClassName}
            style={{ width: `${sentimentMeta.bearPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

type PerformanceCardProps = {
  latestChangePercent: number
  latestClose: number
  sentiment: Sentiment
}

function PerformanceCard({
  latestChangePercent,
  latestClose,
  sentiment,
}: PerformanceCardProps) {
  const changeToneClassName =
    latestChangePercent >= 0 ? 'text-rose-600' : 'text-emerald-600'
  const accentClassName =
    sentiment === 'bullish'
      ? 'bg-rose-50 text-rose-600'
      : sentiment === 'bearish'
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-slate-100 text-slate-600'
  const SignalIcon =
    latestChangePercent > 0 ? TrendingUp : latestChangePercent < 0 ? TrendingDown : Activity

  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
        最新涨跌幅
      </p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className={`text-4xl font-black tracking-tight ${changeToneClassName}`}>
            {latestChangePercent >= 0 ? '+' : ''}
            {latestChangePercent.toFixed(2)}%
          </p>
          <p className="mt-2 text-sm text-slate-600">
            最新收盘 ¥ {priceFormatter.format(latestClose)}
          </p>
        </div>
        <div className={`rounded-2xl p-3 ${accentClassName}`}>
          <SignalIcon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

type SaveStatusCardProps = {
  saveMeta: SaveMeta | null
  recordId: string | null
}

function SaveStatusCard({ saveMeta, recordId }: SaveStatusCardProps) {
  if (!saveMeta) {
    return null
  }

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${saveMeta.panelClassName}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-2xl p-3 ${saveMeta.badgeClassName}`}>
          <Database className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            保存状态
          </p>
          <p className={`mt-1 text-lg font-bold ${saveMeta.textClassName}`}>
            {saveMeta.badgeLabel}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        {recordId
          ? `分析记录已写入数据库，记录 ID: ${recordId}`
          : '本次分析结果已返回页面，但数据库暂未保存成功。'}
      </p>
    </div>
  )
}

function getSentimentMeta(sentiment: Sentiment): SentimentMeta {
  switch (sentiment) {
    case 'bullish':
      return {
        badgeLabel: '📈 多头主导',
        headline: '多头主导',
        note: '均线系统向上发散，短期动能仍在增强。',
        badgeClassName:
          'rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-rose-700',
        cardClassName:
          'border-rose-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.95))]',
        overviewClassName: 'border-rose-100 bg-rose-50/70 text-slate-600',
        iconClassName: 'bg-rose-50 text-rose-600',
        itemClassName:
          'border-rose-300 bg-rose-50/55 text-slate-700 hover:bg-rose-50/80',
        headlineClassName: 'text-rose-600',
        iconShellClassName: 'bg-rose-100 text-rose-600',
        progressBullClassName: 'h-full bg-rose-500',
        progressBearClassName: 'h-full bg-emerald-400',
        bullPercent: 78,
        bearPercent: 22,
        SignalIcon: TrendingUp,
      }
    case 'bearish':
      return {
        badgeLabel: '📉 空头主导',
        headline: '空头主导',
        note: '均线系统压制，短期动能衰竭。',
        badgeClassName:
          'animate-pulse rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-emerald-700',
        cardClassName:
          'border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.92))]',
        overviewClassName: 'border-emerald-100 bg-emerald-50/75 text-slate-600',
        iconClassName: 'bg-emerald-50 text-emerald-600',
        itemClassName:
          'border-emerald-400 bg-emerald-50/55 text-slate-700 hover:bg-emerald-50/80',
        headlineClassName: 'text-emerald-600',
        iconShellClassName: 'bg-emerald-100 text-emerald-600',
        progressBullClassName: 'h-full bg-rose-400',
        progressBearClassName: 'h-full bg-emerald-500',
        bullPercent: 18,
        bearPercent: 82,
        SignalIcon: TrendingDown,
      }
    default:
      return {
        badgeLabel: '⚖️ 震荡拉锯',
        headline: '震荡拉锯',
        note: '多空暂未形成单边优势，等待方向确认。',
        badgeClassName:
          'rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-slate-700',
        cardClassName:
          'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]',
        overviewClassName: 'border-slate-200 bg-slate-50/80 text-slate-600',
        iconClassName: 'bg-slate-100 text-slate-700',
        itemClassName:
          'border-slate-300 bg-slate-50/80 text-slate-700 hover:bg-slate-100',
        headlineClassName: 'text-slate-700',
        iconShellClassName: 'bg-slate-200 text-slate-700',
        progressBullClassName: 'h-full bg-rose-400',
        progressBearClassName: 'h-full bg-emerald-500',
        bullPercent: 50,
        bearPercent: 50,
        SignalIcon: Activity,
      }
  }
}

function getRiskMeta(riskLevel: RiskLevel): RiskMeta {
  switch (riskLevel) {
    case 'low':
      return {
        label: '低风险',
        badgeLabel: '⚠️ 低风险',
        badgeClassName:
          'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-emerald-700',
        iconClassName: 'bg-emerald-50 text-emerald-600',
        itemClassName:
          'border-emerald-300 bg-emerald-50/45 text-slate-700 hover:bg-emerald-50/70',
      }
    case 'high':
      return {
        label: '高风险',
        badgeLabel: '⚠️ 高风险',
        badgeClassName:
          'rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-rose-700',
        iconClassName: 'bg-rose-50 text-rose-600',
        itemClassName:
          'border-rose-300 bg-rose-50/50 text-slate-700 hover:bg-rose-50/75',
      }
    default:
      return {
        label: '中风险',
        badgeLabel: '⚠️ 中风险',
        badgeClassName:
          'rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-amber-700',
        iconClassName: 'bg-amber-50 text-amber-600',
        itemClassName:
          'border-amber-300 bg-amber-50/45 text-slate-700 hover:bg-amber-50/70',
      }
  }
}

function getSaveMeta(saveStatus: AnalysisResponse['save_status']): SaveMeta {
  if (saveStatus === 'saved') {
    return {
      badgeLabel: '已保存',
      badgeClassName: 'bg-emerald-100 text-emerald-700',
      panelClassName: 'border-emerald-100 bg-emerald-50/45',
      textClassName: 'text-emerald-700',
    }
  }

  return {
    badgeLabel: '未保存',
    badgeClassName: 'bg-rose-100 text-rose-700',
    panelClassName: 'border-rose-100 bg-rose-50/45',
    textClassName: 'text-rose-700',
  }
}

function formatRecordId(recordId: string | null) {
  if (!recordId) {
    return 'pending'
  }

  return recordId.length > 12 ? `${recordId.slice(0, 8)}...` : recordId
}

function getPreviousClose(close: number, changePercent: number) {
  const ratio = 1 + changePercent / 100
  if (ratio === 0) {
    return close
  }

  return close / ratio
}

function formatScaledValue(value: number, scale: number) {
  const scaled = value / scale
  return {
    value: scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(2).replace(/\.?0+$/, ''),
    unit: scale === 10_000 ? '万手' : '',
  }
}

function formatAmountValue(value: number) {
  if (value >= 100_000_000) {
    return {
      value: (value / 100_000_000).toFixed(2).replace(/\.?0+$/, ''),
      unit: '亿',
    }
  }

  if (value >= 10_000) {
    return {
      value: (value / 10_000).toFixed(2).replace(/\.?0+$/, ''),
      unit: '万',
    }
  }

  return {
    value: priceFormatter.format(value),
    unit: '',
  }
}

function presetButtonClassName(symbol: string) {
  if (symbol.startsWith('6')) {
    return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
  }

  if (symbol.startsWith('0')) {
    return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
  }

  return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
}
