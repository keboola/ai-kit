'use client'

import { useEffect } from 'react'
import { registerEchartsTheme } from '@/app/echarts-theme'

export default function EchartsInit() {
  useEffect(() => {
    registerEchartsTheme()
  }, [])
  return null
}
