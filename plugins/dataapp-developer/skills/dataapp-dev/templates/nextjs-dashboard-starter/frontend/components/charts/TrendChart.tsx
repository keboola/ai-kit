'use client'

import dynamic from 'next/dynamic'
import type { TrendResponse } from '@/lib/types'
import { COLORS } from '@/lib/constants'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface TrendChartProps {
  data: TrendResponse
  height?: number
}

function fmtCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export default function TrendChart({ data, height = 200 }: TrendChartProps) {
  // CUSTOMIZE: Define your chart series based on your data structure
  const series = [
    { name: 'Current', key: 'values_current' as const, color: COLORS.brandPrimary, dash: false },
    { name: 'Previous', key: 'values_previous' as const, color: COLORS.brandSecondary, dash: true },
  ]

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#001029',
      borderColor: 'rgba(9, 124, 247,0.3)',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
        if (!params.length) return ''
        const lines = [`<b>${params[0].name}</b>`]
        for (const p of params) {
          lines.push(`${p.seriesName}: <b>${fmtCurrency(p.value)}</b>`)
        }
        return lines.join('<br/>')
      },
    },
    legend: {
      show: true,
      top: 0,
      right: 0,
      textStyle: { fontSize: 10, color: COLORS.textSecondary },
      itemWidth: 14,
      itemHeight: 8,
      icon: 'roundRect',
    },
    grid: { left: '8%', right: '3%', top: '12%', bottom: '14%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.labels,
      axisLabel: { rotate: 30, color: COLORS.textPrimary, fontSize: 9, interval: 0 },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (v: number) => fmtCurrency(v),
        color: COLORS.textSecondary,
        fontSize: 9,
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: COLORS.border } },
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      data: (data as Record<string, unknown>)[s.key] as number[],
      smooth: true,
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: s.color,
        ...(s.dash ? { type: 'dashed' as const } : {}),
      },
      itemStyle: { color: s.color },
      areaStyle: { color: `${s.color}1F` },
    })),
  }

  return (
    <ReactECharts
      option={option}
      theme="keboola"
      style={{ height, width: '100%' }}
      notMerge
    />
  )
}
