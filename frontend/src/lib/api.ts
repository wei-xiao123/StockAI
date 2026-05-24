import type {
  AnalysisDetailResponse,
  AnalysisListResponse,
  AnalysisRequest,
  AnalysisResponse,
  HealthResponse,
  SessionResponse,
  StockOverviewResponse,
} from '../types/api'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const apiBaseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : ''

type ErrorPayload =
  | { detail?: string }
  | {
      detail?: Array<{
        msg?: string
        loc?: Array<string | number>
      }>
    }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined && init.body !== null

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    let message = 'Request failed'

    try {
      const payload = (await response.json()) as ErrorPayload
      if (typeof payload.detail === 'string' && payload.detail) {
        message = payload.detail
      } else if (Array.isArray(payload.detail) && payload.detail.length > 0) {
        const firstIssue = payload.detail[0]
        const fieldName = firstIssue.loc?.at(-1)
        if (fieldName === 'symbol') {
          message = '股票代码格式不合法，请输入 6 位数字代码。'
        } else if (firstIssue.msg) {
          message = firstIssue.msg
        }
      }
    } catch {
      message = `${response.status} ${response.statusText}`
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export function fetchHealth() {
  return request<HealthResponse>('/api/health')
}

export function loginWithPassword(password: string) {
  return request<SessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function fetchSession() {
  return request<SessionResponse>('/api/auth/me')
}

export function logoutSession() {
  return request<{ status: string }>('/api/auth/logout', {
    method: 'POST',
  })
}

export function fetchStockOverview(symbol: string) {
  return request<StockOverviewResponse>(`/api/stocks/${symbol}/overview`)
}

export function createAnalysis(payload: AnalysisRequest) {
  return request<AnalysisResponse>('/api/analyses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

type FetchHistoryParams = {
  limit: number
  offset: number
  symbol?: string
  sentiment?: string
  risk_level?: string
}

export function fetchAnalysisHistory(params: FetchHistoryParams) {
  const searchParams = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })

  if (params.symbol) {
    searchParams.set('symbol', params.symbol)
  }
  if (params.sentiment) {
    searchParams.set('sentiment', params.sentiment)
  }
  if (params.risk_level) {
    searchParams.set('risk_level', params.risk_level)
  }

  return request<AnalysisListResponse>(`/api/analyses?${searchParams.toString()}`)
}

export function fetchAnalysisDetail(analysisId: string) {
  return request<AnalysisDetailResponse>(`/api/analyses/${analysisId}`)
}
