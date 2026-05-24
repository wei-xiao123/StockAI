import { useQuery } from '@tanstack/react-query'

import { fetchHealth } from '../../lib/api'
import { Badge } from '../ui/badge'

export function ApiHealthIndicator() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
    staleTime: 60_000,
  })

  if (healthQuery.isLoading) {
    return <Badge variant="secondary">API 检查中</Badge>
  }

  if (healthQuery.isError) {
    return <Badge variant="danger">API 未连接</Badge>
  }

  return (
    <Badge variant="success">
      {(healthQuery.data?.status ?? 'unknown').toUpperCase()}
    </Badge>
  )
}
