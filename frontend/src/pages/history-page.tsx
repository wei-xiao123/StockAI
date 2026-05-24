import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Database, Filter, ShieldAlert, Sparkles, X } from 'lucide-react'

import { fetchAnalysisDetail, fetchAnalysisHistory } from '../lib/api'
import type { AnalysisListItem, RiskLevel, Sentiment } from '../types/api'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

const pageSize = 10
const sentimentOptions: Array<{ value: '' | Sentiment; label: string }> = [
  { value: '', label: '全部情绪' },
  { value: 'bullish', label: '偏多' },
  { value: 'neutral', label: '中性' },
  { value: 'bearish', label: '偏空' },
]
const riskOptions: Array<{ value: '' | RiskLevel; label: string }> = [
  { value: '', label: '全部风险' },
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
]

type FiltersState = {
  symbol: string
  sentiment: '' | Sentiment
  riskLevel: '' | RiskLevel
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const priceFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function HistoryPage() {
  const [draftFilters, setDraftFilters] = useState<FiltersState>({
    symbol: '',
    sentiment: '',
    riskLevel: '',
  })
  const [filters, setFilters] = useState<FiltersState>({
    symbol: '',
    sentiment: '',
    riskLevel: '',
  })
  const [offset, setOffset] = useState(0)
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ['analysis-history', filters, offset],
    queryFn: () =>
      fetchAnalysisHistory({
        limit: pageSize,
        offset,
        symbol: filters.symbol || undefined,
        sentiment: filters.sentiment || undefined,
        risk_level: filters.riskLevel || undefined,
      }),
    staleTime: 30_000,
  })

  const detailQuery = useQuery({
    queryKey: ['analysis-detail', selectedAnalysisId],
    queryFn: () => fetchAnalysisDetail(selectedAnalysisId!),
    enabled: selectedAnalysisId !== null,
    staleTime: 30_000,
  })

  const totalPages = useMemo(() => {
    const total = historyQuery.data?.total ?? 0
    return total === 0 ? 1 : Math.ceil(total / pageSize)
  }, [historyQuery.data?.total])
  const currentPage = Math.floor(offset / pageSize) + 1
  const activeFilterCount = [filters.symbol, filters.sentiment, filters.riskLevel].filter(Boolean).length

  function applyFilters() {
    setFilters({
      symbol: draftFilters.symbol.trim(),
      sentiment: draftFilters.sentiment,
      riskLevel: draftFilters.riskLevel,
    })
    setOffset(0)
    setSelectedAnalysisId(null)
  }

  function resetFilters() {
    const cleared = { symbol: '', sentiment: '', riskLevel: '' } as FiltersState
    setDraftFilters(cleared)
    setFilters(cleared)
    setOffset(0)
    setSelectedAnalysisId(null)
  }

  return (
    <>
      <Card className="overflow-hidden border-primary/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.95))]">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-3" />
            <CardTitle className="text-3xl sm:text-4xl">
              按股票代码、情绪和风险等级回看每一次 AI 分析记录。
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              历史页直接读取后端管理的 Supabase 记录，支持分页浏览和单条详情查看。
            </CardDescription>
          </div>

          <div className="grid w-full max-w-3xl gap-3 rounded-[1.75rem] border border-border/70 bg-white/90 p-4 shadow-panel md:grid-cols-[1.1fr_0.85fr_0.85fr_auto]">
            <label>
              <span className="mb-2 block font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Stock Symbol
              </span>
              <input
                value={draftFilters.symbol}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    symbol: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                placeholder="例如 600519"
                className="h-11 w-full rounded-full border border-border bg-background/80 px-4 text-sm outline-none transition-colors focus:border-primary"
                inputMode="numeric"
              />
            </label>
            <label>
              <span className="mb-2 block font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Sentiment
              </span>
              <select
                value={draftFilters.sentiment}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sentiment: event.target.value as FiltersState['sentiment'],
                  }))
                }
                className="h-11 w-full rounded-full border border-border bg-background/80 px-4 text-sm outline-none transition-colors focus:border-primary"
              >
                {sentimentOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Risk Level
              </span>
              <select
                value={draftFilters.riskLevel}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    riskLevel: event.target.value as FiltersState['riskLevel'],
                  }))
                }
                className="h-11 w-full rounded-full border border-border bg-background/80 px-4 text-sm outline-none transition-colors focus:border-primary"
              >
                {riskOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button className="flex-1" onClick={applyFilters}>
                <Filter className="mr-2 h-4 w-4" />
                筛选
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                重置
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <SummaryCard
          title="当前记录总数"
          value={String(historyQuery.data?.total ?? 0)}
          hint="分页结果来自后端 exact count 统计"
          icon={Database}
        />
        <SummaryCard
          title="活跃筛选"
          value={String(activeFilterCount)}
          hint={activeFilterCount === 0 ? '当前查看全部记录' : '筛选条件已应用'}
          icon={Filter}
        />
        <SummaryCard
          title="当前页码"
          value={`${currentPage} / ${totalPages}`}
          hint={`每页 ${pageSize} 条`}
          icon={CalendarClock}
        />
      </section>

      {historyQuery.isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-[1.4rem] bg-muted/70 p-5">
                <div className="h-3 w-24 rounded-full bg-border" />
                <div className="mt-4 h-8 w-2/3 rounded-full bg-border" />
                <div className="mt-3 h-3 w-full rounded-full bg-border" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {historyQuery.isError ? (
        <Card className="border-rose-200 bg-rose-50/70">
          <CardHeader>
            <CardTitle>历史记录加载失败</CardTitle>
            <CardDescription className="text-rose-700">
              {historyQuery.error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {historyQuery.data && !historyQuery.isLoading ? (
        <Card>
          <CardHeader className="border-b border-border/70 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>分析历史列表</CardTitle>
                <CardDescription>
                  点击“查看详情”可展开单条记录的完整分析信息。
                </CardDescription>
              </div>
              <div className="rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
                共 {historyQuery.data.total} 条
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {historyQuery.data.items.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/35 px-6 py-12 text-center">
                <Badge variant="secondary">暂无记录</Badge>
                <p className="mt-4 text-lg font-semibold">当前筛选条件下没有分析记录。</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  可以回到分析页先跑一次 AI 分析，或清空筛选条件后再查看。
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {historyQuery.data.items.map((item) => (
                  <HistoryListItem
                    key={item.id}
                    item={item}
                    onOpenDetail={() => setSelectedAnalysisId(item.id)}
                  />
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                第 {currentPage} 页，共 {totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
                  disabled={offset === 0}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOffset((current) => current + pageSize)}
                  disabled={historyQuery.data.next_offset === null}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selectedAnalysisId ? (
        <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-border bg-background/95 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Analysis Detail
                </p>
                <h2 className="mt-2 text-2xl font-semibold">历史记录详情</h2>
              </div>
              <Button variant="outline" onClick={() => setSelectedAnalysisId(null)}>
                <X className="mr-2 h-4 w-4" />
                关闭
              </Button>
            </div>

            {detailQuery.isLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-[1.4rem] bg-muted/70 p-5 animate-pulse">
                    <div className="h-3 w-24 rounded-full bg-border" />
                    <div className="mt-4 h-8 w-2/3 rounded-full bg-border" />
                    <div className="mt-3 h-3 w-full rounded-full bg-border" />
                  </div>
                ))}
              </div>
            ) : null}

            {detailQuery.isError ? (
              <Card className="border-rose-200 bg-rose-50/70">
                <CardHeader>
                  <CardTitle>详情加载失败</CardTitle>
                  <CardDescription className="text-rose-700">
                    {detailQuery.error.message}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {detailQuery.data ? (
              <div className="space-y-6">
                <Card className="overflow-hidden border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,237,0.95))]">
                  <CardHeader className="border-b border-border/70 pb-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge>{detailQuery.data.market}</Badge>
                      <SentimentBadge sentiment={detailQuery.data.sentiment} />
                      <RiskBadge riskLevel={detailQuery.data.risk_level} />
                    </div>
                    <CardTitle className="text-2xl">
                      {detailQuery.data.stock_name} {detailQuery.data.symbol}
                    </CardTitle>
                    <CardDescription className="text-base leading-7 text-foreground/80">
                      {detailQuery.data.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                    <DetailMetric
                      label="创建时间"
                      value={formatDateTime(detailQuery.data.created_at)}
                    />
                    <DetailMetric label="模型" value={detailQuery.data.model_name} />
                    <DetailMetric
                      label="Prompt 版本"
                      value={detailQuery.data.prompt_version}
                    />
                    <DetailMetric
                      label="区间"
                      value={detailQuery.data.chart_meta.date_range}
                    />
                  </CardContent>
                </Card>

                <section className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>走势摘要</CardTitle>
                      <CardDescription>
                        趋势备注：{detailQuery.data.chart_meta.trend_note}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <DetailMetric
                        label="最新收盘"
                        value={`¥ ${priceFormatter.format(detailQuery.data.chart_meta.latest_close)}`}
                      />
                      <DetailMetric
                        label="最新涨跌幅"
                        value={`${detailQuery.data.chart_meta.latest_change_percent >= 0 ? '+' : ''}${detailQuery.data.chart_meta.latest_change_percent.toFixed(2)}%`}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>报价快照</CardTitle>
                      <CardDescription>分析执行时保留下来的行情快照。</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <DetailMetric
                        label="开盘"
                        value={`¥ ${priceFormatter.format(detailQuery.data.quote_snapshot.open)}`}
                      />
                      <DetailMetric
                        label="收盘"
                        value={`¥ ${priceFormatter.format(detailQuery.data.quote_snapshot.close)}`}
                      />
                      <DetailMetric
                        label="最高"
                        value={`¥ ${priceFormatter.format(detailQuery.data.quote_snapshot.high)}`}
                      />
                      <DetailMetric
                        label="最低"
                        value={`¥ ${priceFormatter.format(detailQuery.data.quote_snapshot.low)}`}
                      />
                    </CardContent>
                  </Card>

                  <InsightCard
                    title="关键驱动"
                    description="结构化输出中用于支持情绪判断的主要因素。"
                    items={detailQuery.data.analysis.key_drivers}
                    icon={Sparkles}
                  />

                  <InsightCard
                    title="风险因素"
                    description="需要持续观察的风险点。"
                    items={detailQuery.data.analysis.risk_factors}
                    icon={ShieldAlert}
                  />
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

type SummaryCardProps = {
  title: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

function SummaryCard({ title, value, hint, icon: Icon }: SummaryCardProps) {
  return (
    <Card className="bg-white/85">
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

type HistoryListItemProps = {
  item: AnalysisListItem
  onOpenDetail: () => void
}

function HistoryListItem({ item, onOpenDetail }: HistoryListItemProps) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{item.symbol}</Badge>
            <SentimentBadge sentiment={item.sentiment} />
            <RiskBadge riskLevel={item.risk_level} />
          </div>
          <div>
            <p className="text-xl font-semibold">{item.stock_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(item.created_at)}</p>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{item.summary}</p>
        </div>
        <Button onClick={onOpenDetail}>查看详情</Button>
      </div>
    </div>
  )
}

type DetailMetricProps = {
  label: string
  value: string
}

function DetailMetric({ label, value }: DetailMetricProps) {
  return (
    <div className="rounded-[1.3rem] border border-border/70 bg-white/90 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}

type InsightCardProps = {
  title: string
  description: string
  items: string[]
  icon: React.ComponentType<{ className?: string }>
}

function InsightCard({ title, description, items, icon: Icon }: InsightCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item} className="rounded-2xl bg-muted/60 px-4 py-3 text-sm leading-7">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const sentimentLabelMap: Record<Sentiment, string> = {
  bullish: '偏多',
  neutral: '中性',
  bearish: '偏空',
}

const riskLabelMap: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const variant =
    sentiment === 'bullish' ? 'success' : sentiment === 'bearish' ? 'danger' : 'secondary'

  return <Badge variant={variant}>{sentimentLabelMap[sentiment]}</Badge>
}

function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  const variant = riskLevel === 'high' ? 'danger' : riskLevel === 'low' ? 'success' : 'secondary'

  return <Badge variant={variant}>{riskLabelMap[riskLevel]}</Badge>
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}
