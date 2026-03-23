'use client'

import { useEffect, useRef, useState } from 'react'

interface LoadingScreenProps {
  progress: number   // 0–1, driven by actual data loading
  onComplete: () => void
}

const PAD = 3, VW = 64, VH = 112, S = 3
const BLUE = '#097cf7'

const headD = "M29.0196247,62.5097349 C15.2069994,62.5097349 4.64599757,45.6777165 4.64599757,24.3591914 C4.64599757,3.04405242 13.4457034,0 29.0196247,0 C44.5935459,0 52.6311525,3.04405242 52.6311525,24.3591914 C52.6311525,45.6777165 41.5790201,62.5097349 29.0196247,62.5097349 Z"
const eyesD = "M23.3123482,48.6845224 C21.0768571,48.6845224 19.2647545,50.4621948 19.2647545,52.6495784 C19.2647545,54.8437341 21.0768571,56.6180205 23.3123482,56.6180205 C25.5478393,56.6180205 27.3599419,54.8437341 27.3599419,52.6495784 C27.3599419,50.4621948 25.5478393,48.6845224 23.3123482,48.6845224 Z M33.9614148,48.6845224 C31.7259237,48.6845224 29.9138211,50.4621948 29.9138211,52.6495784 C29.9138211,54.8437341 31.7259237,56.6180205 33.9614148,56.6180205 C36.1969059,56.6180205 38.0090085,54.8437341 38.0090085,52.6495784 C38.0090085,50.4621948 36.1969059,48.6845224 33.9614148,48.6845224 Z"
const legsD = "M56.7160044,81.9659364 C57.8506855,83.8519622 57.207135,86.2865269 55.2832579,87.397149 C54.6363203,87.7696137 53.9284148,87.9456879 53.2306706,87.9456879 C51.8453435,87.9456879 50.4938876,87.2481631 49.7385625,85.9919412 C48.4345261,83.831646 47.1000056,82.2943826 45.5961298,80.8891748 C44.092254,79.4907392 42.3851517,78.2379034 40.4307905,76.7785189 C39.4756262,76.070836 38.5238489,75.4579623 37.5754587,74.9365117 C37.6872333,75.1396743 37.7990079,75.3462229 37.9141695,75.5595436 C40.6577268,80.7198727 43.4893488,87.8813531 43.5028972,96.03833 C43.5028972,98.2257136 41.6907946,100 39.4553035,100 C37.2164253,100 35.4043227,98.2257136 35.4043227,96.03833 C35.4178711,89.8350997 33.1959285,83.8688924 30.8520499,79.4467206 C30.0933378,78.0042664 29.3278515,76.7311143 28.6368815,75.6678969 C27.9831697,76.6803237 27.2583287,77.8823689 26.5334876,79.236786 C24.1523509,83.679274 21.8558919,89.7402905 21.8694403,96.03833 C21.8694403,98.2257136 20.0573377,100 17.8218466,100 C15.5863555,100 13.7742529,98.2257136 13.7742529,96.03833 C13.7878013,87.8813531 16.6160362,80.7198727 19.3629806,75.5595436 C19.4747551,75.3462229 19.5865297,75.1396743 19.7016913,74.9365117 C18.7499141,75.4579623 17.8015239,76.070836 16.8463595,76.7785189 C14.8886113,78.2379034 13.181509,79.4907392 11.6810203,80.8891748 C10.1771445,82.2943826 8.83923692,83.831646 7.53520045,85.9953273 C6.40051937,87.8813531 3.91776941,88.507771 1.99389223,87.397149 C0.0666279455,86.2865269 -0.573535412,83.8519622 0.561145671,81.9659364 C2.25469953,79.1453628 4.15825406,76.944435 6.1092281,75.1362882 C8.06358925,73.3247554 10.0314988,71.8958453 11.9418276,70.4669353 C12.8461853,69.7897267 13.7742529,69.1666949 14.722643,68.6012257 C13.7742529,68.0357566 12.8461853,67.4093387 11.9418276,66.7321302 C7.57245863,63.471371 3.77551089,59.0729015 0.561145671,53.7331121 C-0.573535412,51.8437003 0.0666279455,49.4125216 1.99389223,48.3018996 C3.91776941,47.1912776 6.40051937,47.8176955 7.53520045,49.7037213 C10.319403,54.3324417 13.4795745,57.9148749 16.8429724,60.4205465 C20.4502422,63.0921342 23.9931568,64.4160769 27.6376847,64.6260116 C27.9696213,64.6158535 28.3049449,64.6056953 28.6368815,64.6056953 C28.9722052,64.6056953 29.3041417,64.6158535 29.6360783,64.6260116 C33.2806062,64.4160769 36.8269079,63.0921342 40.4307905,60.4205465 C43.7941885,57.9148749 46.9577471,54.3324417 49.7385625,49.7037213 C50.8766307,47.8176955 53.3559936,47.1912776 55.2832579,48.3018996 C57.207135,49.4125216 57.8506855,51.8437003 56.7160044,53.7297261 C53.5016392,59.0729015 49.7013043,63.471371 45.3319354,66.7321302 C44.4275776,67.4093387 43.4995101,68.0357566 42.5545071,68.6012257 C43.4995101,69.1666949 44.4275776,69.7897267 45.3319354,70.4669353 C47.2456513,71.8958453 49.2101737,73.3247554 51.167922,75.1362882 C53.118896,76.944435 55.0190635,79.1453628 56.7160044,81.9659364 Z"

// CUSTOMIZE: Replace these with your own loading step labels
const LOADING_LABELS = [
  'Connecting to Keboola Storage...',
  'Loading data tables...',
  'Processing metrics...',
  'Calculating KPIs...',
  'Building charts...',
  'Almost ready...',
]

export default function LoadingScreen({ progress, onComplete }: LoadingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(progress)
  const animFill = useRef(0)
  const completingRef = useRef(false)
  const startTime = useRef(Date.now())
  const [opacity, setOpacity] = useState(1)
  const [mounted, setMounted] = useState(true)
  const pctRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => { progressRef.current = progress }, [progress])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = VW * S * dpr
    canvas.height = VH * S * dpr
    canvas.style.width  = `${VW * S}px`
    canvas.style.height = `${VH * S}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(S * dpr, S * dpr)
    ctx.translate(PAD, PAD)

    const clip = new Path2D()
    clip.addPath(new Path2D(headD))
    clip.addPath(new Path2D(eyesD))
    clip.addPath(new Path2D(legsD), new DOMMatrix().translate(0, 2))

    const headStroke = new Path2D(headD)
    const eyesStroke = new Path2D(eyesD)
    const legsStroke = new Path2D(legsD)

    const WAVES: [number, number, number, number][] = [
      [3.0, 0.04,  0.12, 0.00],
      [2.2, 0.07, -0.10, 1.50],
      [1.5, 0.12,  0.22, 2.80],
      [0.8, 0.20, -0.18, 0.50],
      [0.4, 0.35,  0.30, 3.60],
    ]
    function bw(x: number, t: number) {
      return WAVES.reduce((y, [a, f, s, p]) => y + a * Math.sin(x * f + t * s + p), 0)
    }

    const N = Math.ceil(VW)
    const ht = new Float32Array(N), vt = new Float32Array(N)
    const CC = 0.22, DM = 0.988
    function step() {
      for (let x = 1; x < N - 1; x++) vt[x] += CC * (ht[x - 1] - 2 * ht[x] + ht[x + 1])
      for (let x = 0; x < N; x++) {
        ht[x] = (ht[x] + vt[x]) * DM; vt[x] *= DM
        if (ht[x] > 3) ht[x] = 3; if (ht[x] < -3) ht[x] = -3
        if (vt[x] > 2) vt[x] = 2; if (vt[x] < -2) vt[x] = -2
      }
      ht[0] = ht[1]; ht[N - 1] = ht[N - 2]; vt[0] = vt[1]; vt[N - 1] = vt[N - 2]
    }
    function inj(cx: number, amp: number, w: number) {
      for (let i = -w; i <= w; i++) {
        const x = cx + i
        if (x >= 0 && x < N) vt[x] += amp * Math.exp(-i * i / (w * w / 2.5))
      }
    }
    inj(15, 1.5, 6); inj(45, 1.2, 5); inj(30, 1, 5)
    for (let s = 0; s < 60; s++) step()

    let nextDrop = 400
    function maybeDroplet(ts: number) {
      if (ts < nextDrop) return
      nextDrop = ts + 800 + Math.random() * 1200
      inj(5 + Math.random() * 50, 1 + Math.random() * 1.5, 4 + Math.random() * 4)
    }

    function drawCurves(pts: [number, number][]) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[Math.max(i - 1, 0)], b = pts[i], c = pts[i + 1], d = pts[Math.min(i + 2, pts.length - 1)]
        ctx.bezierCurveTo(
          b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6,
          c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6,
          c[0], c[1]
        )
      }
    }

    let rafId: number
    const DURATION = 1800
    const start = performance.now()

    function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }

    function frame(ts: number) {
      const realProgress = progressRef.current
      const elapsed = ts - start

      const timeFill = easeOutCubic(Math.min(elapsed / DURATION, 1))
      animFill.current = Math.min(timeFill, Math.max(realProgress, timeFill * 0.85))

      if (realProgress >= 1) {
        animFill.current = Math.max(animFill.current, easeOutCubic(Math.min((elapsed - 200) / DURATION, 1)))
      }

      const pct = Math.round(animFill.current * 100)
      if (pctRef.current) pctRef.current.textContent = `${pct}%`
      if (barRef.current) barRef.current.style.width = `${pct}%`
      if (labelRef.current) {
        const idx = Math.min(Math.floor(animFill.current * LOADING_LABELS.length), LOADING_LABELS.length - 1)
        labelRef.current.textContent = LOADING_LABELS[idx]
      }

      const wallElapsed = Date.now() - startTime.current
      const MIN_DISPLAY = 1800
      if (animFill.current >= 0.99 && realProgress >= 1 && wallElapsed >= MIN_DISPLAY && !completingRef.current) {
        completingRef.current = true
        setTimeout(() => {
          setOpacity(0)
          setTimeout(() => {
            setMounted(false)
            window.dispatchEvent(new CustomEvent('loading-complete'))
            onComplete()
          }, 500)
        }, 400)
      }

      maybeDroplet(ts)
      step()

      const fill = animFill.current
      const by = VH * (1 - fill)
      const t = ts / 1000
      const STEP = 0.5
      const pts: [number, number][] = []
      for (let x = -2; x <= VW + 2; x += STEP) {
        pts.push([x, by + bw(x, t) + ht[Math.min(Math.max(Math.round(x), 0), N - 1)]])
      }

      ctx.clearRect(-PAD - 2, -PAD - 2, VW + PAD + 4, VH + PAD + 4)

      ctx.save()
      ctx.clip(clip, 'evenodd')
      ctx.beginPath()
      ctx.moveTo(-2, VH + 2)
      ctx.lineTo(pts[0][0], pts[0][1])
      drawCurves(pts)
      ctx.lineTo(VW + 2, VH + 2)
      ctx.closePath()
      ctx.fillStyle = BLUE
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      drawCurves(pts)
      ctx.strokeStyle = 'rgba(220,240,255,0.6)'
      ctx.lineWidth = 0.6
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = BLUE; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      ctx.stroke(headStroke)
      ctx.stroke(eyesStroke)
      ctx.save(); ctx.translate(0, 2); ctx.stroke(legsStroke); ctx.restore()
      ctx.restore()

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mounted) return null

  return (
    <div
      data-loading-screen
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        opacity,
        transition: 'opacity 500ms ease',
        pointerEvents: opacity < 1 ? 'none' : 'auto',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 400, height: 400,
        background: `radial-gradient(circle, ${BLUE}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Keboola octopus canvas */}
      <canvas ref={canvasRef} />

      {/* Progress section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 260 }}>
        <div style={{
          width: '100%', height: 4, borderRadius: 2,
          background: 'rgba(0, 33, 81, 0.06)',
          overflow: 'hidden',
        }}>
          <div ref={barRef} style={{
            width: '0%', height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${BLUE}, #002151)`,
            boxShadow: `0 0 8px ${BLUE}40`,
          }} />
        </div>

        <span ref={pctRef} style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: '0.82rem', fontWeight: 700,
          color: '#002151', letterSpacing: '-0.02em',
        }}>
          0%
        </span>

        <span ref={labelRef} style={{
          fontSize: '0.75rem', fontWeight: 500,
          color: 'rgba(0, 33, 81, 0.45)',
          textAlign: 'center',
          minHeight: 20,
        }}>
          {LOADING_LABELS[0]}
        </span>
      </div>
    </div>
  )
}
