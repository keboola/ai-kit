'use client'

import * as echarts from 'echarts'
import { echartsTheme } from '@/lib/constants'

let registered = false

export function registerEchartsTheme() {
  if (!registered) {
    echarts.registerTheme('keboola', echartsTheme)
    registered = true
  }
}
