export interface HealthResponse {
  status: string
}

export interface SessionResponse {
  session_id: string
  user_id: string
  expires_in_days: number
}

export type Sentiment = 'bullish' | 'neutral' | 'bearish'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface QuoteSnapshot {
  open: number
  high: number
  low: number
  close: number
  change_percent: number
  volume: number
  amount: number
}

export interface CandlePoint {
  trade_date: string
  open: number
  close: number
  low: number
  high: number
}

export interface VolumePoint {
  trade_date: string
  volume: number
}

export interface MovingAveragePoint {
  trade_date: string
  value: number
}

export interface StockChartData {
  candles: CandlePoint[]
  volumes: VolumePoint[]
  ma5: MovingAveragePoint[]
  ma10: MovingAveragePoint[]
  ma20: MovingAveragePoint[]
}

export interface StockChartViews {
  daily: StockChartData
  weekly: StockChartData
  monthly: StockChartData
}

export interface StockOverviewResponse {
  symbol: string
  stock_name: string
  market: string
  latest_trade_date: string
  quote: QuoteSnapshot
  chart: StockChartData
  charts?: StockChartViews | null
}

export interface AnalysisOutput {
  summary: string
  sentiment: Sentiment
  risk_level: RiskLevel
  key_drivers: string[]
  risk_factors: string[]
}

export interface StockRef {
  symbol: string
  stock_name: string
  market: string
}

export interface ChartSummary {
  date_range: string
  latest_close: number
  latest_change_percent: number
  trend_note: string
}

export interface AnalysisRequest {
  symbol: string
  user_id?: string | null
}

export interface AnalysisResponse {
  record_id: string | null
  save_status: 'saved' | 'failed'
  stock: StockRef
  quote: QuoteSnapshot
  chart_summary: ChartSummary
  analysis: AnalysisOutput
}

export interface AnalysisListItem {
  id: string
  symbol: string
  stock_name: string
  created_at: string
  sentiment: Sentiment
  risk_level: RiskLevel
  summary: string
}

export interface AnalysisListResponse {
  items: AnalysisListItem[]
  total: number
  next_offset: number | null
}

export interface AnalysisDetailResponse {
  id: string
  symbol: string
  stock_name: string
  market: string
  created_at: string
  sentiment: Sentiment
  risk_level: RiskLevel
  summary: string
  quote_snapshot: QuoteSnapshot
  chart_meta: ChartSummary
  analysis: AnalysisOutput
  model_name: string
  prompt_version: string
}
