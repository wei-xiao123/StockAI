import { useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'

import type { StockChartData, StockOverviewResponse } from '../../types/api'
import { Button } from '../ui/button'

type ChartMode = 'daily' | 'weekly' | 'monthly'

type StockOverviewChartProps = {
  overview: StockOverviewResponse
}

export function StockOverviewChart({ overview }: StockOverviewChartProps) {
  const [mode, setMode] = useState<ChartMode>('daily')
  const availableModes = useMemo(() => {
    const modes: Array<{ key: ChartMode; label: string }> = [
      { key: 'daily', label: '日K' },
      { key: 'weekly', label: '周K' },
      { key: 'monthly', label: '月K' },
    ]
    return modes
  }, [overview.charts])
  const fallbackMode = availableModes.some((item) => item.key === mode) ? mode : 'daily'
  const chartData = overview.charts?.[fallbackMode] ?? overview.chart
  const option = useMemo(() => buildOption(chartData), [chartData])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {availableModes.map((item) => (
          <Button
            key={item.key}
            variant={fallbackMode === item.key ? 'default' : 'outline'}
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <ReactECharts option={option} style={{ height: 520, width: '100%' }} notMerge />
    </div>
  )
}

function buildOption(chart: StockChartData): EChartsOption {
  const labels = chart.candles.map((item) => item.trade_date.slice(5))
  const candles = chart.candles.map((item) => [item.open, item.close, item.low, item.high])
  const volumes = chart.volumes.map((item, index) => ({
    value: item.volume,
    itemStyle: {
      color: chart.candles[index]?.close >= chart.candles[index]?.open ? '#d9485f' : '#0f8b6d',
    },
  }))

  return {
    animationDuration: 450,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    legend: {
      top: 0,
      left: 0,
      itemGap: 18,
      textStyle: {
        color: '#475569',
        fontFamily: 'IBM Plex Sans',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc' },
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: '#1e293b' },
    },
    grid: [
      { left: 18, right: 18, top: 42, height: '58%' },
      { left: 18, right: 18, top: '74%', height: '16%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#d6d3d1' } },
        axisLabel: { color: '#78716c', fontSize: 11 },
        min: 'dataMin',
        max: 'dataMax',
      },
      {
        type: 'category',
        gridIndex: 1,
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#d6d3d1' } },
        axisLabel: { show: false },
        axisTick: { show: false },
        min: 'dataMin',
        max: 'dataMax',
      },
    ],
    yAxis: [
      {
        scale: true,
        splitNumber: 5,
        position: 'right',
        axisLine: { show: false },
        axisLabel: { color: '#78716c', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(214, 211, 209, 0.8)' } },
      },
      {
        gridIndex: 1,
        scale: true,
        splitNumber: 2,
        position: 'right',
        axisLine: { show: false },
        axisLabel: {
          color: '#78716c',
          fontSize: 10,
          formatter: (value: number) => `${(value / 10000).toFixed(0)}万`,
        },
        splitLine: { lineStyle: { color: 'rgba(214, 211, 209, 0.55)' } },
      },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: candles,
        itemStyle: {
          color: '#d9485f',
          color0: '#0f8b6d',
          borderColor: '#d9485f',
          borderColor0: '#0f8b6d',
        },
      },
      { name: 'MA5', type: 'line', data: chart.ma5.map((item) => item.value), smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#2563eb' } },
      { name: 'MA10', type: 'line', data: chart.ma10.map((item) => item.value), smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#f59e0b' } },
      { name: 'MA20', type: 'line', data: chart.ma20.map((item) => item.value), smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#7c3aed' } },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        barMaxWidth: 10,
      },
    ],
  }
}
