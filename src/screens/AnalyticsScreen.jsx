import { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatHMS } from '../lib/timeEntries'
import { format, parseISO, differenceInDays, startOfMonth, subMonths, endOfMonth, addMonths } from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

const DEFAULT_REVENUE_TARGET = 3000
const BRAND_PALETTE = ['#3b82f6','#f97316','#22c55e','#a855f7','#ef4444','#eab308','#06b6d4','#ec4899']

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

function workingDays(start, end) {
  let count = 0
  let d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d = new Date(d.getTime() + 86400000)
  }
  return count
}

function Section({ title, id, children }) {
  return (
    <div id={id}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-1">{title}</p>
      {children}
    </div>
  )
}

const NAV_SECTIONS = [
  { label: 'Revenue',      id: 'section-revenue' },
  { label: 'Forecast',     id: 'section-forecast' },
  { label: 'Capacity',     id: 'section-capacity' },
  { label: 'Service Time', id: 'section-service-time' },
  { label: 'Jobs',         id: 'section-jobs' },
  { label: 'Customers',    id: 'section-customers' },
  { label: 'Brands',       id: 'section-brands' },
  { label: 'Stock Pred.',  id: 'section-stock' },
]

function KPICard({ value, label, sub, accentColor, tip }) {
  const [show, setShow] = useState(false)
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-3 text-center relative"
      style={accentColor ? { borderTopWidth: 3, borderTopColor: accentColor } : {}}
      onMouseEnter={() => tip && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {show && tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 bg-slate-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 pointer-events-none shadow-xl">
          {tip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
      <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1 leading-tight font-medium">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function HBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

function DeltaBadge({ current, previous }) {
  if (!previous || previous === 0) return null
  const delta = ((current - previous) / previous) * 100
  const up = delta >= 0
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
      {up ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}%
    </span>
  )
}

function Insight({ text }) {
  return (
    <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 mt-2">
      <p className="text-xs text-sky-800 leading-relaxed">{text}</p>
    </div>
  )
}

// Donut chart — current month capacity split: confirmed / booked / available
function CapacityDonut({ confirmed, booked, available, total }) {
  const size = 110, cx = 55, cy = 55, r = 40, sw = 13
  const C = 2 * Math.PI * r
  const confirmedPct = total > 0 ? confirmed / total : 0
  const bookedPct    = total > 0 ? booked    / total : 0
  const allocatedPct = confirmedPct + bookedPct
  // arc helper: startFrac = 0..1 position on circle, lengthFrac = 0..1 arc length
  // strokeDashoffset: positive value rotates start CCW, we start at top so offset = C*0.25
  const arc = (startFrac, lengthFrac, color, opacity = 1) => {
    if (lengthFrac <= 0) return null
    const dash = lengthFrac * C
    const offset = C * 0.25 - startFrac * C
    return (
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={offset}
        strokeLinecap="butt" opacity={opacity} />
    )
  }
  const pct = Math.round(allocatedPct * 100)
  const verdictColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#22c55e'
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arc(0, 1, '#f1f5f9')}
      {arc(0, confirmedPct, '#34d399')}
      {arc(confirmedPct, bookedPct, '#38bdf8')}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="18" fontWeight="800" fill={verdictColor}>{pct}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="500">allocated</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="7.5" fill="#cbd5e1">{total} slots</text>
    </svg>
  )
}

// Area chart for capacity utilisation — filled area with 80% and 100% threshold lines
function CapacityAreaChart({ data, todayFrac }) {
  const H = 100, padT = 16, padB = 20, padL = 4, padR = 4
  const wrapRef = useRef(null)
  const [W, setW] = useState(300)
  const [hovered, setHovered] = useState(null)

  useLayoutEffect(() => {
    function measure() { if (wrapRef.current) setW(wrapRef.current.clientWidth || 300) }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const cW = W - padL - padR
  const cH = H - padT - padB
  const n = data.length
  const toX = i => padL + (n > 1 ? (i / (n - 1)) * cW : cW / 2)
  const toY = v => padT + cH - Math.min(Math.max(v, 0), 110) / 110 * cH
  const y80 = toY(80), y100 = toY(100)

  const pts = data.map((d, i) => [toX(i), toY(d.value)])
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length-1][0].toFixed(1)},${(padT+cH).toFixed(1)} L${padL},${(padT+cH).toFixed(1)} Z`

  const gradId = 'capAreaGrad'
  return (
    <div ref={wrapRef} style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} overflow="visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset={`${Math.round((1 - 100/110)*100)}%`} stopColor="#f97316" stopOpacity="0.25" />
            <stop offset={`${Math.round((1 - 80/110)*100)}%`} stopColor="#22c55e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Threshold bands */}
        <rect x={padL} y={padT} width={cW} height={y80 - padT} fill="#fff7ed" opacity="0.4" />

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* 100% threshold */}
        <line x1={padL} y1={y100} x2={W - padR} y2={y100} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />
        <text x={padL + 2} y={y100 - 2} fontSize="7" fill="#ef4444" fontWeight="600">100%</text>

        {/* 80% threshold */}
        <line x1={padL} y1={y80} x2={W - padR} y2={y80} stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" />
        <text x={padL + 2} y={y80 - 2} fontSize="7" fill="#f97316" fontWeight="600">80%</text>

        {/* Line */}
        <path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Points */}
        {pts.map(([x, y], i) => {
          const v = data[i].value
          const col = v >= 90 ? '#ef4444' : v >= 70 ? '#f97316' : '#22c55e'
          const isHov = hovered === i
          return (
            <circle key={i} cx={x} cy={y} r={isHov ? 4.5 : 2.5}
              fill={col} stroke="#fff" strokeWidth="1.5" />
          )
        })}

        {/* Hover tooltips */}
        {hovered !== null && (() => {
          const [x, y] = pts[hovered]
          const v = data[hovered].value
          const tipW = 34, tipH = 14
          const tipX = Math.min(Math.max(x - tipW / 2, padL), W - padR - tipW)
          return (
            <>
              <rect x={tipX} y={y - tipH - 5} width={tipW} height={tipH} rx="3" fill="#1e293b" />
              <text x={tipX + tipW/2} y={y - tipH + 4} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">{v}%</text>
            </>
          )
        })()}

        {/* Hit areas */}
        {pts.map(([x], i) => (
          <rect key={i} x={x - 12} y={padT} width={24} height={cH} fill="transparent"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}

        {/* Today line */}
        {todayFrac !== null && todayFrac >= 0 && todayFrac <= n - 1 && (
          <line x1={toX(todayFrac)} y1={padT} x2={toX(todayFrac)} y2={padT + cH}
            stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
        )}

        {/* Labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.label}</text>
        ))}
      </svg>
    </div>
  )
}

// Diverging column chart for MoM growth — positive bars up (green), negative down (red)
function GrowthDivergingChart({ data }) {
  const H = 110, padT = 12, padB = 20, padL = 4, padR = 4
  const wrapRef = useRef(null)
  const [W, setW] = useState(300)
  const [hovered, setHovered] = useState(null)

  useLayoutEffect(() => {
    function measure() { if (wrapRef.current) setW(wrapRef.current.clientWidth || 300) }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const n = data.length
  const maxAbs = Math.max(...data.map(d => Math.abs(d.value)), 10) * 1.2
  const gap = 4
  const barW = n > 0 ? Math.max((W - padL - padR - (n - 1) * gap) / n, 6) : 20
  const cH = H - padT - padB
  const zeroY = padT + cH / 2
  const toX = i => padL + i * (barW + gap)
  const toBarH = v => (Math.abs(v) / maxAbs) * (cH / 2)

  return (
    <div ref={wrapRef} style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} overflow="visible">
        {/* Zero axis */}
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="#e2e8f0" strokeWidth="1.5" />

        {data.map((d, i) => {
          const x = toX(i)
          const bH = toBarH(d.value)
          const isPos = d.value >= 0
          const isHov = hovered === i
          const color = isPos ? '#22c55e' : '#ef4444'
          const y = isPos ? zeroY - bH : zeroY
          const labelY = isPos ? zeroY - bH - 3 : zeroY + bH + 11
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(bH, 1)} rx="2"
                fill={color} opacity={isHov ? 1 : 0.8} />
              {isHov && bH > 0 && (
                <>
                  <rect x={Math.max(Math.min(x - 4, W - 38), 0)} y={labelY - 12} width={38} height={13} rx="3" fill="#1e293b" />
                  <text x={Math.max(Math.min(x - 4, W - 38), 0) + 19} y={labelY - 2} textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight="700">
                    {d.value >= 0 ? '+' : ''}{d.value}%
                  </text>
                </>
              )}
              {/* Hit area */}
              <rect x={x} y={padT} width={barW} height={cH} fill="transparent"
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
              <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Forecast chart — historical actuals + Y1 dashed + Y2 dashed, capacity ceiling + target
function ForecastChart({ historical, y1, y2, target, capacity, caps }) {
  const H = 140, padT = 20, padB = 22, padL = 4, padR = 4
  const wrapRef = useRef(null)
  const [W, setW] = useState(300)
  const [hovered, setHovered] = useState(null) // { seg: 'hist'|'y1'|'y2', i }

  useLayoutEffect(() => {
    function measure() { if (wrapRef.current) setW(wrapRef.current.clientWidth || 300) }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const cW = W - padL - padR
  const cH = H - padT - padB
  const hLen = historical.length
  const total = hLen + y1.length + y2.length
  const allRevenue = [...historical.map(m => m.revenue), ...y1.map(m => m.revenue), ...y2.map(m => m.revenue)]
  // Per-month ceilings when capacity steps partway through (e.g. going full time)
  const capsArr = caps && caps.length === total ? caps : null
  const maxRev = Math.max(target ?? 0, capacity ?? 0, ...(capsArr ?? []), ...allRevenue, 1) * 1.1

  const toX = i => padL + (total > 1 ? (i / (total - 1)) * cW : cW / 2)
  const toY = v => padT + cH - Math.max(0, Math.min(v / maxRev, 1)) * cH

  const histPts  = historical.map((m, i) => [toX(i), toY(m.revenue)])
  // Prepend last actual point so lines connect with no gap
  const y1Pts    = [
    ...(histPts.length ? [histPts[histPts.length - 1]] : []),
    ...y1.map((m, i) => [toX(hLen + i), toY(m.revenue)])
  ]
  const y2Pts    = [
    ...(y1Pts.length ? [y1Pts[y1Pts.length - 1]] : []),
    ...y2.map((m, i) => [toX(hLen + y1.length + i), toY(m.revenue)])
  ]

  const pathOf = pts => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaOf = (pts, baseY) => {
    if (!pts.length) return ''
    return `${pathOf(pts)} L${pts[pts.length-1][0].toFixed(1)},${baseY.toFixed(1)} L${pts[0][0].toFixed(1)},${baseY.toFixed(1)} Z`
  }
  const baseY = padT + cH

  const targetY  = target   != null ? toY(target)   : null
  const capY     = capacity != null ? toY(capacity)  : null
  const divX1    = hLen > 0 ? toX(hLen - 0.5) : null
  const divX2    = hLen > 0 && y1.length > 0 ? toX(hLen + y1.length - 0.5) : null

  // y1Pts/y2Pts carry a prepended connector point, so the data index lags the point index
  const hovTip = (pts, seg, data, offset = 0) => {
    if (!hovered || hovered.seg !== seg) return null
    const idx = hovered.i
    const item = data[idx - offset]
    if (!pts[idx] || !item) return null
    const [x, y] = pts[idx]
    const label = `£${item.revenue.toLocaleString()}`
    const tipW = label.length * 5.5 + 10
    const tipX = Math.min(Math.max(x - tipW / 2, padL), W - padR - tipW)
    return (
      <>
        <rect x={tipX} y={y - 17} width={tipW} height={13} rx="3" fill="#1e293b" />
        <text x={tipX + tipW / 2} y={y - 7} textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight="700">{label}</text>
      </>
    )
  }

  // Year boundary labels
  const y1StartX = hLen > 0 ? toX(hLen) : null
  const y2StartX = hLen + y1.length > 0 ? toX(hLen + y1.length) : null

  return (
    <div ref={wrapRef} style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} overflow="visible">
        <defs>
          <linearGradient id="fgHist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="fgY1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="fgY2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Year labels only — no vertical divider lines */}
        {y1StartX && <text x={y1StartX + 4} y={padT + 8} fontSize="8" fill="#38bdf8" fontWeight="700">2026 →</text>}
        {y2StartX && <text x={y2StartX + 4} y={padT + 8} fontSize="8" fill="#a855f7" fontWeight="700">2027 →</text>}

        {/* Capacity ceiling — stepped when it changes partway through */}
        {capsArr ? (() => {
          const segs = capsArr.map((c, i) => {
            const x0 = i === 0 ? padL : toX(i - 0.5)
            const x1 = i === total - 1 ? W - padR : toX(i + 0.5)
            const y = toY(c)
            return `${i === 0 ? 'M' : 'L'}${x0.toFixed(1)},${y.toFixed(1)} L${x1.toFixed(1)},${y.toFixed(1)}`
          })
          const lastY = toY(capsArr[capsArr.length - 1])
          return (
            <>
              <path d={segs.join(' ')} fill="none" stroke="#f97316" strokeWidth="1.2" strokeDasharray="5 3" />
              <text x={W - padR - 2} y={lastY - 3} textAnchor="end" fontSize="7" fill="#f97316" fontWeight="600">capacity</text>
            </>
          )
        })() : capY != null && (
          <>
            <line x1={padL} y1={capY} x2={W - padR} y2={capY} stroke="#f97316" strokeWidth="1.2" strokeDasharray="5 3" />
            <text x={W - padR - 2} y={capY - 2} textAnchor="end" fontSize="7" fill="#f97316" fontWeight="600">capacity</text>
          </>
        )}

        {/* Target line */}
        {targetY != null && (
          <>
            <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />
            <text x={padL + 2} y={targetY - 2} fontSize="7" fill="#ef4444" fontWeight="600">target</text>
          </>
        )}

        {/* 2027 purple area + line */}
        {y2Pts.length > 1 && <path d={areaOf(y2Pts, baseY)} fill="url(#fgY2)" />}
        {y2Pts.length > 1 && <path d={pathOf(y2Pts)} fill="none" stroke="#a855f7" strokeWidth="1.8" strokeDasharray="5 3" strokeLinejoin="round" />}
        {y2Pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={hovered?.seg==='y2'&&hovered.i===i?4:2} fill="#a855f7" stroke="#fff" strokeWidth="1.2" />)}
        {y2Pts.map(([x], i) => <rect key={i} x={x-10} y={padT} width={20} height={cH} fill="transparent" onMouseEnter={() => setHovered({ seg:'y2', i })} onMouseLeave={() => setHovered(null)} />)}
        {hovTip(y2Pts, 'y2', y2, y1Pts.length ? 1 : 0)}

        {/* 2026 green area spanning full year (actual + projected) — drawn before the lines */}
        {(() => {
          const all2026Pts = [...histPts, ...y1Pts.slice(histPts.length > 0 ? 1 : 0)]
          return all2026Pts.length > 1 ? <path d={areaOf(all2026Pts, baseY)} fill="url(#fgHist)" /> : null
        })()}

        {/* 2026 projected sky-blue dashed line */}
        {y1Pts.length > 1 && <path d={pathOf(y1Pts)} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="5 3" strokeLinejoin="round" />}
        {y1Pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={hovered?.seg==='y1'&&hovered.i===i?4:2} fill="#38bdf8" stroke="#fff" strokeWidth="1.2" />)}
        {y1Pts.map(([x], i) => <rect key={i} x={x-10} y={padT} width={20} height={cH} fill="transparent" onMouseEnter={() => setHovered({ seg:'y1', i })} onMouseLeave={() => setHovered(null)} />)}
        {hovTip(y1Pts, 'y1', y1, histPts.length ? 1 : 0)}

        {/* Actual green solid line on top */}
        {histPts.length > 1 && <path d={pathOf(histPts)} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {histPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={hovered?.seg==='hist'&&hovered.i===i?4:2.5} fill="#22c55e" stroke="#fff" strokeWidth="1.5" />)}
        {histPts.map(([x], i) => <rect key={i} x={x-10} y={padT} width={20} height={cH} fill="transparent" onMouseEnter={() => setHovered({ seg:'hist', i })} onMouseLeave={() => setHovered(null)} />)}
        {hovTip(histPts, 'hist', historical)}

        {/* X labels — every 2nd month */}
        {[...historical, ...y1, ...y2].map((d, i) => {
          if (i % 2 !== 0) return null
          return (
            <text key={i} x={toX(i)} y={H - 2} textAnchor="middle" fontSize="7.5" fill="#94a3b8">
              {d.shortLabel ?? d.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// Mini donut for brand distribution
function MiniDonut({ segments, centerLabel, centerSub, size = 160 }) {
  const pad = size * 0.40 // space around ring for callout labels — wider to prevent text clipping
  const svgSize = size + pad * 2
  const cx = svgSize / 2, cy = svgSize / 2
  const r = size * 0.36, sw = size * 0.14
  const rOuter = r + sw / 2 // outer edge of ring
  const C = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  // Compute arc midpoint angle for each segment
  const segs = []
  let startFrac = 0
  segments.forEach((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0
    const midFrac = startFrac + pct / 2
    const angleDeg = midFrac * 360 - 90 // -90 so 0 starts at top
    segs.push({ ...seg, pct, startFrac, angleDeg, i })
    startFrac += pct
  })

  // Use a tight viewBox centred on the donut; labels overflow (overflow=visible) so the card height = donut height only
  return (
    <svg viewBox={`${pad} ${pad} ${size} ${size}`} width={size} height={size} overflow="visible" style={{ display: 'block' }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      {/* Segments */}
      {segs.map(seg => {
        if (seg.pct === 0) return null
        const dash = seg.pct * C
        const offset = C * 0.25 - seg.startFrac * C
        return (
          <circle key={seg.i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={sw}
            strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`}
            strokeDashoffset={offset.toFixed(2)} />
        )
      })}
      {/* Centre labels */}
      <text x={cx} y={cy - size * 0.055} textAnchor="middle" fontSize={size * 0.11} fontWeight="800" fill="#1e293b">{centerLabel}</text>
      {centerSub && <text x={cx} y={cy + size * 0.09} textAnchor="middle" fontSize={size * 0.07} fill="#94a3b8">{centerSub}</text>}
      {/* Callout lines + labels */}
      {segs.filter(seg => seg.pct >= 0.03).map(seg => {
        const rad = seg.angleDeg * Math.PI / 180
        const lineStart = rOuter + 4
        const lineEnd = rOuter + size * 0.14
        const labelDist = lineEnd + 4
        const x1 = cx + Math.cos(rad) * lineStart
        const y1 = cy + Math.sin(rad) * lineStart
        const x2 = cx + Math.cos(rad) * lineEnd
        const y2 = cy + Math.sin(rad) * lineEnd
        const lx = cx + Math.cos(rad) * labelDist
        const ly = cy + Math.sin(rad) * labelDist
        const anchor = lx < cx - 4 ? 'end' : lx > cx + 4 ? 'start' : 'middle'
        const pctStr = `${Math.round(seg.pct * 100)}%`
        return (
          <g key={seg.i}>
            <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
              stroke={seg.color} strokeWidth="1.2" />
            <text x={lx.toFixed(1)} y={(ly + 3.5).toFixed(1)} textAnchor={anchor}
              fontSize={size * 0.08} fontWeight="700" fill={seg.color}>{pctStr}</text>
            <text x={lx.toFixed(1)} y={(ly + 3.5 + size * 0.085).toFixed(1)} textAnchor={anchor}
              fontSize={size * 0.07} fill="#64748b">{seg.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// SVG line chart. data = [{ label, value }], target = optional horizontal line value
// todayFrac = fractional index (e.g. 3.43) where today falls on the x-axis
function LineChart({ data, color = '#38bdf8', target = null, valueFormat = v => String(v), todayFrac = null }) {
  const H = 90
  const padT = 14, padB = 18, padL = 2, padR = 2
  const wrapRef = useRef(null)
  const [W, setW] = useState(300)
  const [hovered, setHovered] = useState(null)

  useLayoutEffect(() => {
    function measure() {
      if (wrapRef.current) setW(wrapRef.current.clientWidth || 300)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const cW = W - padL - padR
  const cH = H - padT - padB

  const values = data.map(d => d.value)
  const maxVal = Math.max(target ?? 0, ...values, 1) * 1.08
  const n = data.length

  const toX = i => padL + (n > 1 ? (i / (n - 1)) * cW : cW / 2)
  const toY = v => padT + cH - Math.max(0, Math.min(v / maxVal, 1)) * cH

  const pts = data.map((d, i) => [toX(i), toY(d.value)])
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(padT + cH).toFixed(1)} L${padL},${(padT + cH).toFixed(1)} Z`

  const targetY = target != null ? toY(target) : null
  const lastIdx = n - 1

  return (
    <div ref={wrapRef} style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} overflow="visible">
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#grad-${color.replace('#','')})`} />

        {targetY != null && (
          <>
            <line x1={padL} y1={targetY} x2={W - padR} y2={targetY}
              stroke="#ef4444" strokeWidth="1.2" strokeDasharray="5 3" />
            <text x={W - padR - 1} y={targetY - 2} textAnchor="end" fontSize="8" fill="#ef4444" fontWeight="600">
              £{target.toLocaleString()} target
            </text>
          </>
        )}

        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => {
          if (d.value === 0) return null
          const [x, y] = pts[i]
          const isLast = i === lastIdx
          const isHovered = hovered === i
          return (
            <circle key={i} cx={x} cy={y} r={isHovered ? 4 : isLast ? 3 : 2}
              fill={isLast || isHovered ? color : '#fff'} stroke={color} strokeWidth="1.5" />
          )
        })}

        {/* Hover tooltip */}
        {hovered !== null && data[hovered]?.value > 0 && (() => {
          const [x, y] = pts[hovered]
          const label = valueFormat(data[hovered].value)
          const tipW = label.length * 5.5 + 8
          const tipH = 13
          const tipX = Math.min(Math.max(x - tipW / 2, padL), W - padR - tipW)
          const tipY = y - tipH - 5
          return (
            <>
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="3"
                fill="#1e293b" />
              <text x={tipX + tipW / 2} y={tipY + 9} textAnchor="middle"
                fontSize="7.5" fill="#fff" fontWeight="600">{label}</text>
            </>
          )
        })()}

        {data[lastIdx]?.value > 0 && hovered === null && (
          <text x={pts[lastIdx][0]} y={pts[lastIdx][1] - 5} textAnchor="middle"
            fontSize="8" fill={color} fontWeight="700">
            {valueFormat(data[lastIdx].value)}
          </text>
        )}

        {/* Invisible hit areas for hover */}
        {data.map((d, i) => {
          if (d.value === 0) return null
          const [x] = pts[i]
          return (
            <rect key={`hit-${i}`} x={x - 10} y={padT} width={20} height={cH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)} />
          )
        })}

        {todayFrac !== null && todayFrac >= 0 && todayFrac <= n - 1 && (
          <line x1={toX(todayFrac)} y1={padT} x2={toX(todayFrac)} y2={padT + cH}
            stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
        )}

        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 1} textAnchor="middle" fontSize="8" fill="#94a3b8">
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default function AnalyticsScreen({ jobs: jobs_raw, customers, settings }) {
  const REVENUE_TARGET = settings?.revenueTarget ?? DEFAULT_REVENUE_TARGET
  const data = useMemo(() => {
    const today = new Date()
    // Exclude jobs where every unit is on hold from all analytics counts
    const jobs = jobs_raw.filter(j => !(j.units?.length > 0 && j.units.every(u => u.status === 'on_hold')))
    const allUnits = jobs.flatMap(j => j.units || [])
    const completedJobs = jobs.filter(j => j.units?.length && j.units.every(u => u.status === 'complete'))
    const activeJobs = jobs.filter(j => !j.units?.length || j.units.some(u => u.status !== 'complete'))

    // Revenue totals
    const totalRevenue = jobs.reduce((s, j) => s + jobTotal(j), 0)
    const completedRevenue = completedJobs.reduce((s, j) => s + jobTotal(j), 0)
    const wipRevenue = activeJobs.reduce((s, j) => s + jobTotal(j), 0)
    const avgJobValue = jobs.length ? totalRevenue / jobs.length : 0
    const avgCompletedValue = completedJobs.length ? completedRevenue / completedJobs.length : 0

    // Window: 6 months back → furthest future job drop_off month (min 2 months ahead)
    const windowStart = startOfMonth(subMonths(today, 6))
    const latestJobMonth = jobs.reduce((max, j) => {
      if (!j.drop_off_date) return max
      const m = startOfMonth(parseISO(j.drop_off_date))
      return m > max ? m : max
    }, startOfMonth(today))
    const minFutureEnd = startOfMonth(subMonths(today, -2)) // 2 months ahead
    const windowEnd = latestJobMonth > minFutureEnd ? latestJobMonth : minFutureEnd

    // Build month array from windowStart to windowEnd
    const months = []
    let cursor = windowStart
    while (cursor <= windowEnd) {
      const start = cursor
      const end = endOfMonth(start)
      const label = format(start, 'MMM')
      const monthJobs = jobs.filter(j => {
        if (!j.drop_off_date) return false
        const d = parseISO(j.drop_off_date)
        return d >= start && d <= end
      })
      const revenue = monthJobs.reduce((s, j) => s + jobTotal(j), 0)
      const turonarounds = monthJobs
        .filter(j => j.drop_off_date && j.pickup_date)
        .map(j => differenceInDays(parseISO(j.pickup_date), parseISO(j.drop_off_date)))
      const avgTurnaround = turonarounds.length
        ? turonarounds.reduce((a, b) => a + b, 0) / turonarounds.length : 0
      const unitCount = monthJobs.flatMap(j => j.units || []).length
      months.push({ label, start, end, jobCount: monthJobs.length, unitCount, revenue, avgTurnaround })
      cursor = startOfMonth(subMonths(cursor, -1))
    }

    const currentMonthStart = startOfMonth(today)
    const thisMonthIdx = months.findIndex(m => m.start.getTime() === currentMonthStart.getTime())
    const thisMonth = months[thisMonthIdx] ?? months[months.length - 1]
    const lastMonth = months[thisMonthIdx - 1] ?? months[0]
    const targetGap = REVENUE_TARGET - thisMonth.revenue
    const targetPct = ((thisMonth.revenue / REVENUE_TARGET) * 100).toFixed(0)

    // Run rate & capacity-aware projection
    const weeklyCapacity = settings?.weeklyCapacity ?? 8
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    const wdElapsed = workingDays(monthStart, today)
    const wdTotal = workingDays(monthStart, monthEnd)
    const wdRemaining = wdTotal - wdElapsed

    // Split this month's jobs into confirmed (already dropped off) vs booked future
    const confirmedJobs = jobs.filter(j => {
      if (!j.drop_off_date) return false
      const d = parseISO(j.drop_off_date)
      return d >= monthStart && d <= today
    })
    const bookedFutureJobs = jobs.filter(j => {
      if (!j.drop_off_date) return false
      const d = parseISO(j.drop_off_date)
      return d > today && d <= monthEnd
    })
    const confirmedRevenue = confirmedJobs.reduce((s, j) => s + jobTotal(j), 0)
    const confirmedUnits = confirmedJobs.flatMap(j => j.units || []).length
    const bookedFutureRevenue = bookedFutureJobs.reduce((s, j) => s + jobTotal(j), 0)
    const bookedFutureUnits = bookedFutureJobs.flatMap(j => j.units || []).length

    // Avg unit price: use confirmed jobs this month, fall back to settings default
    const avgUnitPriceThisMonth = confirmedUnits > 0
      ? confirmedRevenue / confirmedUnits
      : (settings?.defaultUnitPrice ?? 120)

    // Unfilled slots = remaining capacity minus already-booked future jobs
    const weeksRemaining = wdRemaining / 5
    const totalRemainingCapacityUnits = weeksRemaining * weeklyCapacity
    const unfilledUnits = Math.max(0, totalRemainingCapacityUnits - bookedFutureUnits)
    const unfilledRevenue = unfilledUnits * avgUnitPriceThisMonth

    // Projection = confirmed + booked future + unfilled capacity at avg price
    const projectedMonthEnd = Math.round(confirmedRevenue + bookedFutureRevenue + unfilledRevenue)
    // Ceiling = confirmed + booked future + all remaining capacity (if fully booked)
    const capacityCeilingThisMonth = Math.round(confirmedRevenue + bookedFutureRevenue + totalRemainingCapacityUnits * avgUnitPriceThisMonth)

    // Daily run rate on confirmed revenue only (actual throughput to date)
    const dailyRunRate = wdElapsed > 0 ? confirmedRevenue / wdElapsed : 0
    const daysToTarget = dailyRunRate > 0 && thisMonth.revenue < REVENUE_TARGET
      ? Math.ceil((REVENUE_TARGET - thisMonth.revenue) / dailyRunRate) : null

    // Capacity utilisation: confirmed units vs elapsed capacity
    const weeksElapsed = wdElapsed / 5
    const capacityUnitsElapsed = weeksElapsed * weeklyCapacity
    const utilisationPctThisMonth = capacityUnitsElapsed > 0
      ? Math.round((confirmedUnits / capacityUnitsElapsed) * 100) : 0
    const spareUnitsThisMonth = Math.max(0, Math.round(unfilledUnits))
    const spareRevenueThisMonth = Math.round(spareUnitsThisMonth * avgUnitPriceThisMonth)
    const totalSlotsThisMonth = Math.round((wdTotal / 5) * weeklyCapacity)

    // Monthly capacity utilisation for chart (units booked / monthly capacity)
    const monthlyCapacityUtil = months.map(m => {
      const mWd = workingDays(m.start, m.end)
      const mWeeks = mWd / 5
      const mCap = mWeeks * weeklyCapacity
      return { label: m.label, value: mCap > 0 ? Math.min(Math.round((m.unitCount / mCap) * 100), 100) : 0 }
    })

    // Sustainability: rolling averages of completed months
    const historicalMonths = thisMonthIdx > 0 ? months.slice(0, thisMonthIdx) : []
    const pipelineMonths   = thisMonthIdx >= 0 ? months.slice(thisMonthIdx + 1) : []
    const activeHistMonths = historicalMonths.filter(m => m.revenue > 0)
    const last3 = activeHistMonths.slice(-3)
    const last6 = activeHistMonths.slice(-6)
    const rolling3Avg = last3.length > 0 ? last3.reduce((s, m) => s + m.revenue, 0) / last3.length : 0
    const rolling6Avg = last6.length > 0 ? last6.reduce((s, m) => s + m.revenue, 0) / last6.length : 0
    const monthsHitTarget = activeHistMonths.filter(m => m.revenue >= REVENUE_TARGET).length
    const totalHistMonths = activeHistMonths.length

    // Growth trend — MoM revenue growth rates on historical completed months
    const momGrowthRates = activeHistMonths.slice(1).map((m, i) => {
      const prev = activeHistMonths[i]
      if (!prev?.revenue) return null
      return { label: m.label, value: Math.round(((m.revenue - prev.revenue) / prev.revenue) * 100) }
    }).filter(Boolean)
    const avgMoMGrowth = momGrowthRates.length > 0
      ? momGrowthRates.reduce((s, r) => s + r.value, 0) / momGrowthRates.length : null
    // Trailing 3-month growth (compare most recent 3 avg to prior 3 avg)
    const recent3 = activeHistMonths.slice(-3)
    const prior3  = activeHistMonths.slice(-6, -3)
    const recent3Avg = recent3.length ? recent3.reduce((s,m)=>s+m.revenue,0)/recent3.length : 0
    const prior3Avg  = prior3.length  ? prior3.reduce((s,m)=>s+m.revenue,0)/prior3.length   : 0
    const trailing3Growth = prior3Avg > 0 ? Math.round(((recent3Avg - prior3Avg) / prior3Avg) * 100) : null

    // Seasonality — UK MTB seasonal index by month (Jun is peak = 1.3)
    const SEASONAL_IDX = [0.6, 0.65, 0.85, 1.1, 1.2, 1.3, 1.25, 1.15, 0.9, 0.75, 0.65, 0.55]
    const currentSeasonIdx = SEASONAL_IDX[today.getMonth()]
    // Seasonally-adjusted revenue: what this month would look like in a neutral month
    const seasonallyAdjRevenue = thisMonth.revenue > 0
      ? Math.round(thisMonth.revenue / currentSeasonIdx) : 0
    // Season label
    const monthIdx = today.getMonth()
    const seasonName = monthIdx >= 2 && monthIdx <= 4 ? 'Spring (peak)'
      : monthIdx >= 5 && monthIdx <= 7 ? 'Summer (peak)'
      : monthIdx >= 8 && monthIdx <= 10 ? 'Autumn (slowdown)'
      : 'Winter (quiet)'
    // For each historical month, compute seasonally-adjusted revenue
    const seasonallyAdjMonths = activeHistMonths.map(m => ({
      ...m,
      adjRevenue: Math.round(m.revenue / SEASONAL_IDX[m.start.getMonth()]),
    }))
    // Underlying growth = growth in seasonally-adjusted figures
    const adjGrowthRates = seasonallyAdjMonths.slice(1).map((m, i) => {
      const prev = seasonallyAdjMonths[i]
      if (!prev?.adjRevenue) return null
      return Math.round(((m.adjRevenue - prev.adjRevenue) / prev.adjRevenue) * 100)
    }).filter(v => v !== null)
    const avgAdjGrowth = adjGrowthRates.length > 0
      ? Math.round(adjGrowthRates.reduce((s,v)=>s+v,0) / adjGrowthRates.length) : null
    // Winter projection: what would target-month revenue look like in Dec (idx=0.55)?
    const winterRevProjection = seasonallyAdjRevenue > 0
      ? Math.round(seasonallyAdjRevenue * SEASONAL_IDX[11]) : 0

    // Turnaround stats
    const allTurnarounds = completedJobs
      .filter(j => j.drop_off_date && j.pickup_date)
      .map(j => differenceInDays(parseISO(j.pickup_date), parseISO(j.drop_off_date)))
    const avgTurnaround = allTurnarounds.length
      ? Math.round(allTurnarounds.reduce((a, b) => a + b, 0) / allTurnarounds.length) : null
    const minTurnaround = allTurnarounds.length ? Math.min(...allTurnarounds) : null
    const maxTurnaround = allTurnarounds.length ? Math.max(...allTurnarounds) : null

    // Unit metrics
    const avgUnitsPerJob = jobs.length ? allUnits.length / jobs.length : 0
    const unitStatusCounts = STATUS_ORDER.reduce((acc, s) => {
      acc[s] = allUnits.filter(u => u.status === s).length
      return acc
    }, {})
    const activeUnits = allUnits.filter(u => u.status !== 'complete')

    // Parts delays by brand
    const awaitingPartsByBrand = {}
    allUnits.filter(u => u.status === 'awaiting_parts').forEach(u => {
      if (!u.brand) return
      awaitingPartsByBrand[u.brand] = (awaitingPartsByBrand[u.brand] || 0) + 1
    })
    const partsByBrandArr = Object.entries(awaitingPartsByBrand).sort(([, a], [, b]) => b - a)
    const totalAwaitingParts = allUnits.filter(u => u.status === 'awaiting_parts').length

    // Customer metrics
    const repeatCustomers = customers.filter(c => jobs.filter(j => j.customer_id === c.id).length > 1)
    const custSpend = customers.map(c => {
      const cJobs = jobs.filter(j => j.customer_id === c.id)
      return { name: c.name, spend: cJobs.reduce((s, j) => s + jobTotal(j), 0), jobCount: cJobs.length }
    }).filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend)
    const topCustomers = custSpend.slice(0, 6)
    const maxCustSpend = topCustomers[0]?.spend || 1

    // LTV and return interval
    const avgLTV = custSpend.length > 0
      ? custSpend.reduce((s, c) => s + c.spend, 0) / custSpend.length : 0
    const returnIntervals = repeatCustomers.map(c => {
      const cJobs = jobs
        .filter(j => j.customer_id === c.id && j.drop_off_date)
        .sort((a, b) => a.drop_off_date.localeCompare(b.drop_off_date))
      if (cJobs.length < 2) return null
      const first = parseISO(cJobs[0].drop_off_date)
      const last = parseISO(cJobs[cJobs.length - 1].drop_off_date)
      return differenceInDays(last, first) / (cJobs.length - 1)
    }).filter(Boolean)
    const avgReturnInterval = returnIntervals.length > 0
      ? Math.round(returnIntervals.reduce((a, b) => a + b, 0) / returnIntervals.length) : null

    // New customers per month
    const newCustMonths = months.map(m => {
      const value = customers.filter(c => {
        const firstJob = jobs
          .filter(j => j.customer_id === c.id && j.drop_off_date)
          .sort((a, b) => a.drop_off_date.localeCompare(b.drop_off_date))[0]
        if (!firstJob) return false
        const d = parseISO(firstJob.drop_off_date)
        return d >= m.start && d <= m.end
      }).length
      return { label: m.label, value }
    })

    // Brand metrics
    const brandData = {}
    allUnits.forEach(u => {
      if (!u.brand) return
      if (!brandData[u.brand]) brandData[u.brand] = { count: 0, revenue: 0 }
      brandData[u.brand].count++
      brandData[u.brand].revenue += parseFloat(u.price) || 0
    })
    const topBrandsByCount = Object.entries(brandData).sort(([, a], [, b]) => b.count - a.count).slice(0, 6)
    const topBrandsByRevenue = Object.entries(brandData).sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 6)
    const maxBrandCount = topBrandsByCount[0]?.[1].count || 1
    const maxBrandRevenue = topBrandsByRevenue[0]?.[1].revenue || 1

    // Model breakdown grouped by brand
    const modelData = {}
    allUnits.forEach(u => {
      if (!u.brand) return
      const model = u.model?.trim() || 'Unknown'
      const key = `${u.brand}||${model}`
      if (!modelData[key]) modelData[key] = { brand: u.brand, model, count: 0, revenue: 0 }
      modelData[key].count++
      modelData[key].revenue += parseFloat(u.price) || 0
    })
    const modelsByBrand = {}
    Object.values(modelData).forEach(m => {
      if (!modelsByBrand[m.brand]) modelsByBrand[m.brand] = []
      modelsByBrand[m.brand].push(m)
    })
    Object.keys(modelsByBrand).forEach(b => {
      modelsByBrand[b].sort((a, z) => z.count - a.count)
    })

    const unitsChartData = months.map(m => ({ label: m.label, value: m.unitCount || 0 }))
    const todayFrac = thisMonthIdx >= 0 ? thisMonthIdx : null

    // ── Revenue forecast ──────────────────────────────────────────────────────
    // Method: deseasonalise completed months, fit a linear trend, then project
    // forward with a damped slope and re-apply the seasonal shape.
    //
    // Damping matters: compounding a monthly growth % over 29 months sends any
    // positive rate through the roof, which just pins every future month to the
    // capacity ceiling and erases the seasonal pattern. A damped linear trend
    // grows quickly near term and flattens out long term, which is how a
    // one-bench workshop actually behaves.
    const FORECAST_Y1 = 2026
    const FORECAST_Y2 = 2027
    const thisMonthNum = today.getMonth()
    const thisYearNum = today.getFullYear()

    // Seasonal indices normalised to mean 1.0 — the raw table averages 0.91,
    // which would inflate every deseasonalised figure by ~10%.
    const seasonMean = SEASONAL_IDX.reduce((s, v) => s + v, 0) / SEASONAL_IDX.length
    const SEASON = SEASONAL_IDX.map(v => v / seasonMean)

    // A stable unit price for the capacity ceiling — this month's average is
    // based on a partial month and swings around too much to anchor a forecast.
    const pricedUnits = allUnits.filter(u => (parseFloat(u.price) || 0) > 0)
    const avgUnitPriceOverall = pricedUnits.length
      ? pricedUnits.reduce((s, u) => s + (parseFloat(u.price) || 0), 0) / pricedUnits.length
      : avgUnitPriceThisMonth

    // Revenue for a calendar month, straight from jobs. The `months` window only
    // reaches 6 months back, so anything earlier in the year has to come from here.
    function revenueForMonth(year, monthIdx) {
      const start = new Date(year, monthIdx, 1)
      const end = endOfMonth(start)
      return jobs.reduce((s, j) => {
        if (!j.drop_off_date) return s
        const d = parseISO(j.drop_off_date)
        return d >= start && d <= end ? s + jobTotal(j) : s
      }, 0)
    }

    // Absolute month index, 0 = Jan 2026 … 23 = Dec 2027
    const absOf = (year, mi) => (year - FORECAST_Y1) * 12 + mi
    const nowAbs = absOf(thisYearNum, thisMonthNum)

    // Fit on completed months only — the in-progress month is partial and would
    // drag the trend down.
    const monthRevenue = Array.from({ length: 24 }, (_, m) =>
      revenueForMonth(FORECAST_Y1 + Math.floor(m / 12), m % 12)
    )
    const fitPoints = []
    for (let m = 0; m < Math.min(nowAbs, 24); m++) {
      if (monthRevenue[m] > 0) fitPoints.push({ x: m, y: monthRevenue[m] / SEASON[m % 12] })
    }

    // ── Capacity ceiling ──────────────────────────────────────────────────────
    // Two candidates: what the settings say you can do, and what you have
    // actually done. A completed month is proof of throughput, so the ceiling
    // takes whichever is higher — otherwise a stale setting caps the forecast
    // below your own track record and projects you going backwards.
    // Both are held as a weekly rate so months with more working days scale up.
    const configuredWeeklyRevenue = weeklyCapacity * avgUnitPriceOverall

    let demonstratedWeeklyRevenue = 0
    let bestMonthRevenue = 0
    let bestMonthLabel = null
    for (let m = 0; m < Math.min(nowAbs, 24); m++) {
      if (monthRevenue[m] <= 0) continue
      const d = new Date(FORECAST_Y1 + Math.floor(m / 12), m % 12, 1)
      const wd = workingDays(startOfMonth(d), endOfMonth(d))
      if (wd <= 0) continue
      const weekly = monthRevenue[m] / (wd / 5)
      if (weekly > demonstratedWeeklyRevenue) {
        demonstratedWeeklyRevenue = weekly
        bestMonthRevenue = monthRevenue[m]
        bestMonthLabel = format(d, 'MMM yyyy')
      }
    }

    const ceilingWeeklyRevenue = Math.max(configuredWeeklyRevenue, demonstratedWeeklyRevenue)
    const capacityFromActuals = demonstratedWeeklyRevenue > configuredWeeklyRevenue
    const ceilingWeeklyUnits = avgUnitPriceOverall > 0
      ? ceilingWeeklyRevenue / avgUnitPriceOverall : weeklyCapacity

    // A planned step change in throughput — going full time, taking on help.
    // Without this the ceiling is frozen at what you managed part-time, which
    // caps every future peak at your current peak no matter how demand grows.
    const stepFrom = settings?.stepCapacityFrom || ''
    const stepMatch = /^(\d{4})-(\d{2})$/.exec(stepFrom)
    const stepAbs = stepMatch
      ? absOf(parseInt(stepMatch[1], 10), parseInt(stepMatch[2], 10) - 1)
      : null
    const stepWeeklyUnits = Math.max(settings?.stepCapacity ?? 0, 0)
    const stepWeeklyRevenue = stepWeeklyUnits * avgUnitPriceOverall
    const hasCapacityStep = stepAbs != null && stepWeeklyRevenue > 0

    // Weekly ceiling for a given absolute month index
    function weeklyCeilingAt(m) {
      if (hasCapacityStep && m >= stepAbs) return Math.max(stepWeeklyRevenue, ceilingWeeklyRevenue)
      return ceilingWeeklyRevenue
    }

    function monthCapacityRevenue(d, m) {
      const wd = workingDays(startOfMonth(d), endOfMonth(d))
      const weekly = m == null ? ceilingWeeklyRevenue : weeklyCeilingAt(m)
      return (wd / 5) * weekly
    }

    // Least-squares trend on the deseasonalised series
    let trendLevel, trendSlope
    if (fitPoints.length >= 3) {
      const n = fitPoints.length
      const sx = fitPoints.reduce((s, p) => s + p.x, 0)
      const sy = fitPoints.reduce((s, p) => s + p.y, 0)
      const sxx = fitPoints.reduce((s, p) => s + p.x * p.x, 0)
      const sxy = fitPoints.reduce((s, p) => s + p.x * p.y, 0)
      const denom = n * sxx - sx * sx
      trendSlope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0
      const intercept = (sy - trendSlope * sx) / n
      trendLevel = intercept + trendSlope * (nowAbs - 1) // fitted value at the last completed month
    } else if (fitPoints.length > 0) {
      trendLevel = fitPoints.reduce((s, p) => s + p.y, 0) / fitPoints.length
      trendSlope = 0
    } else {
      trendLevel = ((21 / 5) * weeklyCapacity * avgUnitPriceOverall) * 0.5
      trendSlope = 0
    }
    trendLevel = Math.max(trendLevel, 0)

    // Damped trend: slope × (φ + φ² + … + φᵏ). Converges to slope × φ/(1−φ),
    // so the long-run forecast stays bounded instead of compounding away.
    const DAMP = 0.85
    const dampedGain = k => (k <= 0 ? 0 : trendSlope * DAMP * (1 - Math.pow(DAMP, k)) / (1 - DAMP))

    // Soft ceiling — keeps the seasonal shape visible as the forecast approaches
    // capacity instead of clipping it into a dead-flat plateau.
    function softCap(v, cap) {
      if (!cap || cap <= 0) return v
      const knee = cap * 0.8
      if (v <= knee) return v
      const room = cap - knee
      return knee + room * (1 - Math.exp(-(v - knee) / room))
    }

    // 24 months, Jan 2026 → Dec 2027, always in calendar order
    const forecastMonths = Array.from({ length: 24 }, (_, m) => {
      const year = FORECAST_Y1 + Math.floor(m / 12)
      const mi = m % 12
      const d = new Date(year, mi, 1)
      const cap = Math.round(monthCapacityRevenue(d, m))
      const base = { label: format(d, 'MMM'), year, month: mi, cap }

      if (m < nowAbs) {
        return { ...base, revenue: Math.round(monthRevenue[m]), type: 'actual' }
      }
      const projected = softCap(Math.max(0, trendLevel + dampedGain(m - (nowAbs - 1))) * SEASON[mi], cap)
      if (m === nowAbs) {
        // In progress — never show less than what's already booked
        return { ...base, revenue: Math.round(Math.max(projected, monthRevenue[m])), type: 'current' }
      }
      return { ...base, revenue: Math.round(projected), type: 'projected' }
    })

    // Split as a prefix/suffix so months can never be reordered into the wrong bucket
    const splitIdx = Math.min(Math.max(nowAbs + 1, 0), 24)
    const settled = forecastMonths.slice(0, splitIdx)
    const pending = forecastMonths.slice(splitIdx)
    const year2026 = forecastMonths.slice(0, 12)
    const year2027 = forecastMonths.slice(12, 24)
    const forecastActual = settled
    const forecastY1 = pending.filter(m => m.year === FORECAST_Y1)
    const forecastY2 = pending.filter(m => m.year === FORECAST_Y2)

    const y1Total = Math.round(year2026.reduce((s, m) => s + m.revenue, 0))
    const y2Total = Math.round(year2027.reduce((s, m) => s + m.revenue, 0))
    const avgMonthlyCapacityRevenue = Math.round((21 / 5) * ceilingWeeklyRevenue)
    const avgMonthlyCapacityAfterStep = hasCapacityStep
      ? Math.round((21 / 5) * Math.max(stepWeeklyRevenue, ceilingWeeklyRevenue))
      : null
    const stepFromLabel = hasCapacityStep
      ? format(new Date(FORECAST_Y1 + Math.floor(stepAbs / 12), stepAbs % 12, 1), 'MMM yyyy')
      : null
    const forecastCaps = forecastMonths.map(m => m.cap)

    // Underlying month-on-month growth at today's level, before damping
    const effectiveGrowthRate = trendLevel > 0 ? trendSlope / trendLevel : 0
    const forecastFitMonths = fitPoints.length
    const y1Forecast = year2026, y2Forecast = year2027

    return {
      jobs,
      totalRevenue, completedRevenue, wipRevenue, avgJobValue, avgCompletedValue,
      months, thisMonth, lastMonth, targetGap, targetPct,
      confirmedRevenue: confirmedRevenue, bookedFutureRevenue, confirmedUnits, bookedFutureUnits,
      dailyRunRate, projectedMonthEnd, capacityCeilingThisMonth, daysToTarget,
      wdElapsed, wdTotal, wdRemaining,
      weeklyCapacity, totalSlotsThisMonth, utilisationPctThisMonth, spareUnitsThisMonth, spareRevenueThisMonth,
      monthlyCapacityUtil,
      rolling3Avg, rolling6Avg, last3, monthsHitTarget, totalHistMonths,
      avgMoMGrowth, trailing3Growth, momGrowthRates,
      currentSeasonIdx, seasonName, seasonallyAdjRevenue, winterRevProjection,
      avgAdjGrowth, seasonallyAdjMonths,
      avgTurnaround, minTurnaround, maxTurnaround,
      allUnits, activeUnits, avgUnitsPerJob, unitStatusCounts,
      completedJobs, activeJobs,
      partsByBrandArr, totalAwaitingParts,
      repeatCustomers, custSpend, topCustomers, maxCustSpend, newCustMonths,
      avgLTV, avgReturnInterval,
      topBrandsByCount, topBrandsByRevenue, maxBrandCount, maxBrandRevenue, modelsByBrand,
      unitsChartData, todayFrac, historicalMonths, pipelineMonths,
      year2026, year2027, y1Forecast, y2Forecast, y1Total, y2Total, avgMonthlyCapacityRevenue, effectiveGrowthRate,
      forecastActual, forecastY1, forecastY2, forecastFitMonths,
      capacityFromActuals, bestMonthLabel, bestMonthRevenue, ceilingWeeklyUnits, avgUnitPriceOverall,
      hasCapacityStep, stepFromLabel, stepWeeklyUnits, avgMonthlyCapacityAfterStep, forecastCaps,
      avgUnitPriceThisMonth,

      // Stock predictor: based on the same recent window as the revenue rolling avg (last 3 completed months)
      // Falls back to all available history if fewer than 3 months exist.
      stockRates: (() => {
        const windowStart = last3.length > 0 ? last3[0].start : (activeHistMonths[0]?.start ?? startOfMonth(subMonths(today, 3)))
        const baseJobs = jobs.filter(j => {
          if (!j.drop_off_date) return false
          const d = parseISO(j.drop_off_date)
          return d >= windowStart && d <= today
        })
        if (!baseJobs.length) return []
        const actualWeeks = Math.max(differenceInDays(today, windowStart) / 7, 1)
        const byKey = {}
        baseJobs.forEach(j => {
          ;(j.units || []).forEach(u => {
            const brand = u.brand || 'Unknown'
            const model = u.model?.trim() || 'Unknown'
            const key = `${brand}||${model}`
            if (!byKey[key]) byKey[key] = { brand, model, count: 0 }
            byKey[key].count++
          })
        })
        return Object.values(byKey)
          .map(r => ({ ...r, weeklyRate: r.count / actualWeeks }))
          .sort((a, b) => b.weeklyRate - a.weeklyRate)
      })(),
      stockHistoryWeeks: (() => {
        const windowStart = last3.length > 0 ? last3[0].start : (activeHistMonths[0]?.start ?? startOfMonth(subMonths(today, 3)))
        return Math.max(differenceInDays(today, windowStart) / 7, 1)
      })(),
      stockWindowLabel: last3.length > 0
        ? `last ${last3.length} completed month${last3.length !== 1 ? 's' : ''}`
        : 'available history',
    }
  }, [jobs_raw, customers])

  const {
    jobs,
    totalRevenue, completedRevenue, wipRevenue, avgJobValue, avgCompletedValue,
    months, thisMonth, lastMonth, targetGap, targetPct,
    confirmedRevenue, bookedFutureRevenue, confirmedUnits, bookedFutureUnits,
    dailyRunRate, projectedMonthEnd, capacityCeilingThisMonth, daysToTarget,
    wdElapsed, wdTotal, wdRemaining,
    weeklyCapacity, totalSlotsThisMonth, utilisationPctThisMonth, spareUnitsThisMonth, spareRevenueThisMonth,
    monthlyCapacityUtil,
    rolling3Avg, rolling6Avg, last3, monthsHitTarget, totalHistMonths,
    avgMoMGrowth, trailing3Growth, momGrowthRates,
    currentSeasonIdx, seasonName, seasonallyAdjRevenue, winterRevProjection,
    avgAdjGrowth, seasonallyAdjMonths,
    avgTurnaround, minTurnaround, maxTurnaround,
    allUnits, activeUnits, avgUnitsPerJob, unitStatusCounts,
    completedJobs, activeJobs,
    partsByBrandArr, totalAwaitingParts,
    repeatCustomers, custSpend, topCustomers, maxCustSpend, newCustMonths,
    avgLTV, avgReturnInterval,
    topBrandsByCount, topBrandsByRevenue, maxBrandCount, maxBrandRevenue, modelsByBrand,
    unitsChartData, todayFrac, historicalMonths, pipelineMonths,
    year2026, year2027, y1Forecast, y2Forecast, y1Total, y2Total, avgMonthlyCapacityRevenue, effectiveGrowthRate,
    forecastActual, forecastY1, forecastY2, forecastFitMonths,
    capacityFromActuals, bestMonthLabel, bestMonthRevenue, ceilingWeeklyUnits, avgUnitPriceOverall,
    hasCapacityStep, stepFromLabel, stepWeeklyUnits, avgMonthlyCapacityAfterStep, forecastCaps,
    avgUnitPriceThisMonth,
    stockRates, stockHistoryWeeks, stockWindowLabel,
  } = data

  // ── Models by Brand toggles ──────────────────────────────────────────────────
  const [modelMetric, setModelMetric] = useState('qty') // 'qty' | 'pct'
  const [showRevenue, setShowRevenue] = useState(true)

  // ── Stock predictor period ────────────────────────────────────────────────────
  const [stockPeriod, setStockPeriod] = useState('4w') // '1w' | '4w' | '3m'

  // ── Service time data ────────────────────────────────────────────────────────
  const [serviceTimeByModel, setServiceTimeByModel] = useState([])

  useEffect(() => {
    async function fetchServiceTimes() {
      const { data: entries } = await supabase
        .from('time_entries')
        .select('duration_seconds, unit_id, started_at, units!inner(brand, model, status)')
        .not('duration_seconds', 'is', null)
        .eq('units.status', 'complete')
        .order('started_at', { ascending: true })
      if (!entries?.length) return

      // Step 1: sum all sessions per unit instance → one total per unit
      const byUnit = {}
      entries.forEach(e => {
        if (!byUnit[e.unit_id]) byUnit[e.unit_id] = {
          brand: e.units?.brand || 'Unknown',
          model: e.units?.model?.trim() || 'Unknown',
          total: 0,
          started_at: e.started_at,
        }
        byUnit[e.unit_id].total += e.duration_seconds
      })

      // Step 2: group per-unit totals by brand/model, in chronological order
      const byModel = {}
      Object.values(byUnit).sort((a, b) => a.started_at.localeCompare(b.started_at)).forEach(u => {
        const key = `${u.brand}||${u.model}`
        if (!byModel[key]) byModel[key] = { brand: u.brand, model: u.model, totals: [] }
        byModel[key].totals.push(u.total)
      })

      // Step 3: compute stats and trend (first half avg vs last half avg, need 3+ units)
      const result = Object.values(byModel).map(g => {
        const t = g.totals
        const avg = Math.round(t.reduce((s, v) => s + v, 0) / t.length)
        const min = Math.min(...t)
        const max = Math.max(...t)
        let trend = null
        if (t.length >= 3) {
          const half = Math.floor(t.length / 2)
          const firstAvg = t.slice(0, half).reduce((s, v) => s + v, 0) / half
          const lastAvg  = t.slice(-half).reduce((s, v) => s + v, 0) / half
          trend = Math.round(((lastAvg - firstAvg) / firstAvg) * 100)
        }
        return { brand: g.brand, model: g.model, units: t.length, avg, min, max, trend }
      }).sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model))

      setServiceTimeByModel(result)
    }
    fetchServiceTimes()
  }, [])

  // Sustainability verdict badge
  const sustainVerdict = (() => {
    if (last3.length < 2) return null
    const avg = rolling3Avg
    if (avg >= REVENUE_TARGET * 1.1) return { label: 'Strong', color: '#22c55e', bg: '#f0fdf4', border: '#86efac' }
    if (avg >= REVENUE_TARGET)       return { label: 'On Track', color: '#22c55e', bg: '#f0fdf4', border: '#86efac' }
    if (avg >= REVENUE_TARGET * 0.75) return { label: 'Building', color: '#f97316', bg: '#fff7ed', border: '#fdba74' }
    return { label: 'Below Target', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' }
  })()

  function revenueInsight() {
    const histRevMonths = historicalMonths.filter(m => m.revenue > 0)
    if (histRevMonths.length < 2) return "Revenue history is building — insights will sharpen once you have more completed months."
    const trend = histRevMonths[histRevMonths.length - 1].revenue - histRevMonths[0].revenue
    const trendDir = trend > 100 ? 'upward' : trend < -100 ? 'downward' : 'flat'
    const pipeTotal = pipelineMonths.filter(m => m.revenue > 0).reduce((s, m) => s + m.revenue, 0)
    const hitTarget = Number(targetPct) >= 100
    let txt = `Historical revenue shows a ${trendDir} trend. `
    if (hitTarget) txt += `This month already hit the £${REVENUE_TARGET.toLocaleString()} target. `
    else txt += `This month is at ${targetPct}% of target with £${Math.abs(targetGap).toFixed(0)} still to book. `
    if (projectedMonthEnd > 0) txt += `At today's run rate, on track for £${projectedMonthEnd.toLocaleString()} by month end. `
    if (pipeTotal > 0) txt += `£${pipeTotal.toFixed(0)} already scheduled beyond this month gives good forward visibility.`
    return txt
  }

  function forecastInsight() {
    if (forecastFitMonths < 3) {
      return `Only ${forecastFitMonths} completed month${forecastFitMonths !== 1 ? 's' : ''} of revenue so far, so the forecast holds your current level flat and just applies the seasonal pattern. Once you have three completed months a growth trend can be fitted and these numbers will sharpen considerably.`
    }
    const growthPct = Math.round(effectiveGrowthRate * 100)
    const y2VsY1 = y1Total > 0 ? Math.round(((y2Total - y1Total) / y1Total) * 100) : 0
    const y1Monthly = Math.round(y1Total / 12)
    const y2Monthly = Math.round(y2Total / 12)
    const actualSoFar = year2026.filter(m => m.type === 'actual').reduce((s, m) => s + m.revenue, 0)

    let txt = `Built from ${forecastFitMonths} completed months: each is stripped of its seasonal factor, a trend is fitted through them, then the seasonal shape is put back on top. `
    txt += growthPct > 0
      ? `Underlying growth is running at about ${growthPct}% a month, damped as it projects further out so the long-range numbers stay realistic rather than compounding away. `
      : `The underlying trend is flat, so the forecast is your current level shaped by season alone. `
    txt += `2026 lands at £${y1Total.toLocaleString()} (£${actualSoFar.toLocaleString()} banked so far, £${y1Monthly.toLocaleString()}/month average) — `
    txt += y1Monthly >= REVENUE_TARGET
      ? `above your £${REVENUE_TARGET.toLocaleString()} monthly target. `
      : `below your £${REVENUE_TARGET.toLocaleString()} target on a full-year average, though peak months clear it. `
    txt += `2027 projects £${y2Total.toLocaleString()} (£${y2Monthly.toLocaleString()}/month), ${y2VsY1 >= 0 ? '+' : ''}${y2VsY1}% on 2026. `

    const capPeak27 = year2027.reduce((max, m) => Math.max(max, m.revenue), 0)
    const ceiling27 = avgMonthlyCapacityAfterStep ?? avgMonthlyCapacityRevenue
    if (hasCapacityStep) {
      txt += `Capacity steps up to about £${ceiling27.toLocaleString()}/month from ${stepFromLabel} (${stepWeeklyUnits} units/wk), which is what lets 2027 peaks clear this year's. `
      txt += capPeak27 >= ceiling27 * 0.9
        ? `Even so, summer 2027 reaches that new ceiling — demand is outrunning the bench again, so it is worth sanity-checking whether ${stepWeeklyUnits} units/wk is realistic week in, week out.`
        : `Summer 2027 stays inside the new ceiling, so the plan has headroom.`
    } else if (capPeak27 >= avgMonthlyCapacityRevenue * 0.9) {
      txt += `Summer 2027 is pinned to your capacity ceiling of roughly £${avgMonthlyCapacityRevenue.toLocaleString()}/month, so peak months come out flat against this year — that is throughput binding, not demand falling away. `
      txt += capacityFromActuals
        ? `The ceiling is set by your best month so far (${bestMonthLabel}), and it is held flat across the whole forecast. If you are planning to take on more work — going full time, adding help — set the date in Settings and the peak-season forecast will lift accordingly.`
        : `The ceiling is your Settings figure of ${weeklyCapacity} units/wk, held flat throughout. Raise it, or set a date for when it changes, and the peaks will follow.`
    } else {
      txt += `2027 peaks stay inside your current capacity, so the growth can be absorbed on the existing bench.`
    }
    return txt
  }

  function capacityInsight() {
    const capPct = utilisationPctThisMonth
    let txt = `${confirmedUnits} units confirmed so far this month (${capPct}% of elapsed capacity). `
    if (bookedFutureUnits > 0) txt += `${bookedFutureUnits} more already booked for later this month, consuming ${Math.round(bookedFutureUnits / weeklyCapacity * 10) / 10} weeks of remaining slots. `
    if (capPct >= 90) txt += `Near full capacity on confirmed work — limit new bookings or you risk overrun. `
    else if (capPct >= 70) txt += `Good utilisation with headroom remaining. `
    else txt += `Spare capacity available — confirmed work is below your throughput ceiling. `
    if (spareUnitsThisMonth > 0) txt += `${spareUnitsThisMonth} unfilled unit slots left this month (~£${spareRevenueThisMonth.toLocaleString()}). Projection includes booked future jobs plus an estimate for unfilled slots.`
    return txt
  }

  function growthInsight() {
    if (!avgMoMGrowth && !trailing3Growth) return "Need more completed months to calculate growth trend."
    let txt = ''
    if (trailing3Growth !== null) {
      txt += `Your most recent 3-month average is ${trailing3Growth >= 0 ? '+' : ''}${trailing3Growth}% vs the preceding 3 months — `
      if (trailing3Growth >= 15) txt += `strong acceleration underway. `
      else if (trailing3Growth >= 5) txt += `solid upward trajectory. `
      else if (trailing3Growth >= 0) txt += `modest positive trend. `
      else txt += `recent slowdown worth monitoring. `
    }
    const undGrowthPct = Math.round(effectiveGrowthRate * 100)
    txt += `Estimated growth rate is ~+${undGrowthPct}%/month, but this includes seasonal uplift and cannot be separated from true business growth until you have year-on-year data (from January 2027). `
    if (avgMoMGrowth !== null) {
      txt += `Overall month-on-month average since tracking began: ${avgMoMGrowth >= 0 ? '+' : ''}${Math.round(avgMoMGrowth)}%.`
    }
    return txt
  }

  function seasonalityInsight() {
    const idx = Math.round(currentSeasonIdx * 100)
    let txt = `You are currently in ${seasonName} — historically ${idx}% of annual average demand for UK mountain bike suspension. `
    if (winterRevProjection > 0) {
      txt += `Seasonally adjusting your current run rate to a typical winter month (Dec), you could expect around £${winterRevProjection.toLocaleString()} — `
      if (winterRevProjection >= REVENUE_TARGET) txt += `still above your £${REVENUE_TARGET.toLocaleString()} target, which is a strong signal for full-time viability. `
      else txt += `below your £${REVENUE_TARGET.toLocaleString()} target. This is normal — plan for 3–4 quieter months per year and size your cash buffer accordingly. `
    }
    txt += `Peak months (May–Jul) typically run 2× winter volume. Use peak months to build a cash reserve that covers the winter shortfall.`
    return txt
  }

  function sustainabilityInsight() {
    if (last3.length < 2) return "Track a few complete months to build a sustainability picture."
    const hitRate = totalHistMonths > 0 ? Math.round((monthsHitTarget / totalHistMonths) * 100) : 0
    const shortfall = REVENUE_TARGET - rolling3Avg
    let txt = ''
    if (last3.length >= 3) {
      txt += `Your 3-month rolling average is £${Math.round(rolling3Avg).toLocaleString()}. `
      if (rolling3Avg >= REVENUE_TARGET) {
        txt += `You are consistently clearing the £${REVENUE_TARGET.toLocaleString()} threshold — the revenue is there to support a full-time commitment. `
      } else {
        txt += `You are averaging £${Math.round(shortfall).toLocaleString()} below the £${REVENUE_TARGET.toLocaleString()} threshold — focus on increasing jobs per week or average job value before committing full time. `
      }
    }
    txt += `${monthsHitTarget} of ${totalHistMonths} completed month${totalHistMonths !== 1 ? 's' : ''} hit the target (${hitRate}%). `
    if (avgJobValue > 0) {
      const jobsNeeded = Math.ceil(REVENUE_TARGET / avgJobValue)
      txt += `At your average job value of £${avgJobValue.toFixed(0)}, you need roughly ${jobsNeeded} jobs per month to sustain target.`
    }
    return txt
  }

  function jobVolumeInsight() {
    const histJobMonths = historicalMonths.filter(m => m.jobCount > 0)
    const pipeJobMonths = pipelineMonths.filter(m => m.jobCount > 0)
    const completionRate = Math.round((completedJobs.length / Math.max(jobs.length, 1)) * 100)
    const peakHist = histJobMonths.reduce((a, b) => b.jobCount > a.jobCount ? b : a, histJobMonths[0])
    const pipeJobs = pipelineMonths.reduce((s, m) => s + m.jobCount, 0)
    let txt = `${completionRate}% of all jobs are completed. `
    if (peakHist) txt += `Your busiest historical month was ${peakHist.label} with ${peakHist.jobCount} jobs. `
    if (pipeJobs > 0) txt += `After today's line, ${pipeJobs} job${pipeJobs !== 1 ? 's' : ''} are already in the pipeline — `
    if (pipeJobs > peakHist?.jobCount) txt += `shaping up to be a record period. `
    else if (pipeJobs > 0) txt += `good forward bookings. `
    txt += `At ${avgUnitsPerJob.toFixed(1)} units per job on average, `
    if (avgUnitsPerJob >= 2) txt += `customers regularly bring multiple items — positive for revenue per visit.`
    else txt += `encouraging multi-unit bookings could meaningfully lift revenue per visit.`
    return txt
  }

  function unitsInsight() {
    const totalUnits = allUnits.length
    const completedUnits = allUnits.filter(u => u.status === 'complete').length
    const completionRate = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0
    const pipeUnits = pipelineMonths.reduce((s, m) => s + (m.unitCount || 0), 0)
    let txt = `${totalUnits} units in total — ${completionRate}% completed. `
    if (pipeUnits > 0) txt += `${pipeUnits} units already scheduled ahead — pipeline is active. `
    if (totalAwaitingParts > 0) {
      const pct = Math.round((totalAwaitingParts / totalUnits) * 100)
      txt += `${totalAwaitingParts} units (${pct}%) blocked on parts — every delayed unit defers the revenue it represents.`
    } else {
      txt += `No units blocked on parts — supply chain is clear.`
    }
    return txt
  }

  function partsInsight() {
    if (partsByBrandArr.length === 0) return "No units currently blocked on parts — supply chain is clear."
    const top = partsByBrandArr[0]
    const topPct = Math.round((top[1] / totalAwaitingParts) * 100)
    let txt = `${totalAwaitingParts} unit${totalAwaitingParts !== 1 ? 's' : ''} currently awaiting parts. `
    txt += `${top[0]} accounts for ${topPct}% of the delay — `
    if (topPct > 60) txt += `consider holding buffer stock for this brand to protect throughput. `
    else txt += `delays spread across brands suggest general supply chain variability. `
    txt += `Blocked units represent deferred revenue — chasing outstanding parts should be a daily priority.`
    return txt
  }

  function turnaroundInsight() {
    if (avgTurnaround === null) return "Turnaround data will appear once jobs have both drop-off and pickup dates recorded."
    const histTurnaround = historicalMonths.filter(m => m.avgTurnaround > 0)
    const trendUp = histTurnaround.length >= 2 && histTurnaround[histTurnaround.length - 1].avgTurnaround > histTurnaround[0].avgTurnaround
    let txt = `Historical average turnaround is ${avgTurnaround} days (${minTurnaround}–${maxTurnaround}d range). `
    if (trendUp) txt += `Turnaround has been lengthening in recent history — watch for capacity or parts constraints emerging. `
    else txt += `Turnaround is stable or improving across your historical record. `
    if (maxTurnaround > avgTurnaround * 2) txt += `A large spread between fastest and slowest jobs suggests some outliers — investigate what's causing the longest jobs.`
    return txt
  }

  function customerInsight() {
    const retentionRate = customers.length ? Math.round((repeatCustomers.length / customers.length) * 100) : 0
    const top3spend = custSpend.slice(0, 3).reduce((s, c) => s + c.spend, 0)
    const top3pct = totalRevenue > 0 ? Math.round((top3spend / totalRevenue) * 100) : 0
    let txt = `Retention rate is ${retentionRate}% — `
    if (retentionRate >= 60) txt += `strong repeat business that reduces acquisition cost. `
    else if (retentionRate >= 30) txt += `moderate repeat business; post-service follow-ups could improve returns. `
    else txt += `low repeat rate — consider follow-up messages and loyalty incentives. `
    if (avgReturnInterval) txt += `Repeat customers return every ${avgReturnInterval} days on average. `
    if (top3pct > 50) txt += `Top 3 customers account for ${top3pct}% of revenue — high concentration risk.`
    else txt += `Revenue is reasonably distributed across your customer base.`
    return txt
  }

  function brandInsight() {
    if (topBrandsByCount.length === 0) return "Brand data will appear as you log units on jobs."
    const top = topBrandsByCount[0]
    const topPct = allUnits.length > 0 ? Math.round((top[1].count / allUnits.length) * 100) : 0
    const perUnitValues = topBrandsByRevenue.map(([b, d]) => ({ brand: b, perUnit: d.count ? d.revenue / d.count : 0 }))
    const highestPU = perUnitValues.sort((a, b) => b.perUnit - a.perUnit)[0]
    let txt = `${top[0]} is your dominant brand at ${topPct}% of units. `
    if (topPct > 70) txt += `This heavy concentration means your business is closely tied to one manufacturer's service cycle and parts ecosystem — worth monitoring as a risk. `
    else txt += `Brand mix is reasonably spread, which reduces dependency on any single manufacturer's demand cycle. `
    txt += `${highestPU.brand} generates the highest revenue per unit at £${highestPU.perUnit.toFixed(0)}, making it your most valuable service line.`
    return txt
  }

  // Shared colour map — consistent across donut charts and model bar charts
  const allBrandNames = [...new Set([...topBrandsByCount.map(([b]) => b), ...topBrandsByRevenue.map(([b]) => b)])]
  const colorMap = Object.fromEntries(allBrandNames.map((b, i) => [b, BRAND_PALETTE[i % BRAND_PALETTE.length]]))

  if (!jobs.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-black safe-top shrink-0">
          <div className="px-4 py-3 flex items-center gap-3">
            <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Work State</h1>
              <p className="text-slate-400 text-xs mt-1">Business insights</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
            <p className="text-slate-500 font-semibold">Analytics will populate as you add jobs</p>
          </div>
        </div>
      </div>
    )
  }

  const revenueChartData = months.map(m => ({ label: m.label, value: m.revenue }))
  const jobsChartData = months.map(m => ({ label: m.label, value: m.jobCount }))
  const turnaroundChartData = months.map(m => ({ label: m.label, value: Math.round(m.avgTurnaround) }))
  const newCustChartData = newCustMonths

  return (
    <div className="flex flex-col h-full">
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Work State</h1>
            <p className="text-slate-400 text-xs mt-1">Business insights</p>
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="bg-black shrink-0 border-t border-slate-800">
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
          {NAV_SECTIONS.map(s => (
            <button key={s.id}
              onClick={() => {
                const el = document.getElementById(s.id)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="shrink-0 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-medium active:bg-sky-600 active:text-white whitespace-nowrap">
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
      <div className="max-w-2xl mx-auto p-4 space-y-5">

        {/* ── REVENUE ── */}
        <Section title="Revenue" id="section-revenue">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPICard value={`£${totalRevenue.toFixed(0)}`} label="Total" sub="all time" accentColor="#22c55e"
              tip="Sum of all unit prices across every job ever created, including active work." />
            <KPICard value={`£${completedRevenue.toFixed(0)}`} label="Invoiced" sub="completed" accentColor="#3b82f6"
              tip="Revenue from jobs where every unit is marked complete — work fully delivered." />
            <KPICard value={`£${wipRevenue.toFixed(0)}`} label="Pipeline" sub="in workshop" accentColor="#f97316"
              tip="Revenue tied up in active jobs — earned once those jobs complete." />
          </div>

          {/* Monthly revenue vs target */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Monthly Revenue</p>
                <p className="text-[10px] text-slate-400 mt-0.5">vs £{REVENUE_TARGET.toLocaleString()} target</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-sm font-bold text-slate-800">£{thisMonth.revenue.toFixed(0)}</span>
                  <DeltaBadge current={thisMonth.revenue} previous={lastMonth.revenue} />
                </div>
                <p className={`text-[10px] mt-0.5 font-semibold ${thisMonth.revenue >= REVENUE_TARGET ? 'text-emerald-500' : 'text-red-500'}`}>
                  {thisMonth.revenue >= REVENUE_TARGET
                    ? `✓ Target hit`
                    : `£${targetGap.toFixed(0)} to target`}
                </p>
              </div>
            </div>
            <LineChart data={revenueChartData} color="#22c55e" target={REVENUE_TARGET} valueFormat={v => `£${v.toFixed(0)}`} todayFrac={todayFrac} />
          </div>

          {/* Target progress bar + run rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-slate-700">This Month vs Target</p>
              <span className={`text-sm font-bold ${Number(targetPct) >= 100 ? 'text-emerald-600' : Number(targetPct) >= 75 ? 'text-orange-500' : 'text-red-500'}`}>
                {targetPct}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(Number(targetPct), 100)}%`, backgroundColor: Number(targetPct) >= 100 ? '#22c55e' : Number(targetPct) >= 75 ? '#f97316' : '#ef4444' }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
              <span>£0</span>
              <span className="text-red-400 font-medium">£{REVENUE_TARGET.toLocaleString()} target</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <KPICard
                value={dailyRunRate > 0 ? `£${Math.round(dailyRunRate)}` : '—'}
                label="Per Day"
                sub="confirmed only"
                tip="Confirmed revenue (jobs already dropped off) ÷ working days elapsed this month."
              />
              <KPICard
                value={projectedMonthEnd > 0 ? `£${projectedMonthEnd.toLocaleString()}` : '—'}
                label="Projected"
                sub="capacity-adjusted"
                accentColor={projectedMonthEnd >= REVENUE_TARGET ? '#22c55e' : '#ef4444'}
                tip="Confirmed + booked future jobs + unfilled slots at avg unit price — capped at your weekly capacity."
              />
              <KPICard
                value={capacityCeilingThisMonth > 0 ? `£${capacityCeilingThisMonth.toLocaleString()}` : '—'}
                label="Max Possible"
                sub={`${wdRemaining}d at capacity`}
                accentColor="#64748b"
                tip="Confirmed + booked future + every remaining slot filled — the absolute ceiling for this month."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <KPICard value={`£${avgJobValue.toFixed(0)}`} label="Avg Job Value" sub="all jobs"
              tip="Total revenue across all jobs ÷ total number of jobs." />
            <KPICard value={`£${avgCompletedValue.toFixed(0)}`} label="Avg Completed" sub="invoiced"
              tip="Revenue from completed jobs only ÷ number of completed jobs." />
          </div>
          <Insight text={revenueInsight()} />
        </Section>

        {/* ── SUSTAINABILITY ── */}
        <Section title="Sustainability Track">
          {sustainVerdict ? (
            <div className="rounded-xl border p-4 mb-2" style={{ backgroundColor: sustainVerdict.bg, borderColor: sustainVerdict.border }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">Full-Time Viability</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">3-month rolling average vs £{REVENUE_TARGET.toLocaleString()} target</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: sustainVerdict.color }}>
                  {sustainVerdict.label}
                </span>
              </div>
              <div className="h-3 bg-white bg-opacity-60 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min((rolling3Avg / REVENUE_TARGET) * 100, 100)}%`, backgroundColor: sustainVerdict.color }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white bg-opacity-70 rounded-lg p-2 text-center group relative cursor-default"
                  onMouseEnter={e => e.currentTarget.querySelector('.tip')?.classList.remove('hidden')}
                  onMouseLeave={e => e.currentTarget.querySelector('.tip')?.classList.add('hidden')}>
                  <div className="tip hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 bg-slate-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 pointer-events-none shadow-xl">
                    Average monthly revenue across your last 3 completed months.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                  <p className="text-base font-bold text-slate-900">£{Math.round(rolling3Avg).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">3-month avg</p>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-2 text-center group relative cursor-default"
                  onMouseEnter={e => e.currentTarget.querySelector('.tip')?.classList.remove('hidden')}
                  onMouseLeave={e => e.currentTarget.querySelector('.tip')?.classList.add('hidden')}>
                  <div className="tip hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 bg-slate-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 pointer-events-none shadow-xl">
                    Completed months where revenue hit or exceeded your £{REVENUE_TARGET.toLocaleString()} target.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                  <p className="text-base font-bold text-slate-900">{monthsHitTarget}/{totalHistMonths}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">months on target</p>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-2 text-center group relative cursor-default"
                  onMouseEnter={e => e.currentTarget.querySelector('.tip')?.classList.remove('hidden')}
                  onMouseLeave={e => e.currentTarget.querySelector('.tip')?.classList.add('hidden')}>
                  <div className="tip hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 bg-slate-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 pointer-events-none shadow-xl">
                    3-month rolling average minus your £{REVENUE_TARGET.toLocaleString()} target — how far above or below you typically run.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                  <p className="text-base font-bold" style={{ color: rolling3Avg >= REVENUE_TARGET ? '#16a34a' : '#dc2626' }}>
                    {rolling3Avg >= REVENUE_TARGET ? '+' : '-'}£{Math.abs(Math.round(rolling3Avg - REVENUE_TARGET)).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">vs target</p>
                </div>
              </div>
              {rolling6Avg > 0 && (
                <div className="mt-2 pt-2 border-t border-white border-opacity-50">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>6-month average</span>
                    <span className="font-semibold text-slate-700">£{Math.round(rolling6Avg).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-6 mb-2">
              Needs 2+ completed months to calculate sustainability trend
            </div>
          )}
          <Insight text={sustainabilityInsight()} />
        </Section>

        {/* ── REVENUE FORECAST ── */}
        <Section title="Revenue Forecast" id="section-forecast">
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-sm font-semibold text-slate-700">2026 & 2027 Projection</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {forecastFitMonths} completed months · damped trend · seasonal · capacity ceiling
                </p>
              </div>
              <div className="text-right">
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-emerald-400 shrink-0" />Actual</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-sky-400 shrink-0 opacity-70" />2026</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-purple-400 shrink-0 opacity-70" />2027</span>
                </div>
              </div>
            </div>
            <ForecastChart
              historical={forecastActual}
              y1={forecastY1}
              y2={forecastY2}
              target={REVENUE_TARGET}
              capacity={avgMonthlyCapacityRevenue}
              caps={forecastCaps}
            />
            {/* Make it obvious which ceiling is binding — a stale or flat ceiling
                silently capping peak months is hard to spot from the line alone */}
            <div className={`mt-3 rounded-lg px-3 py-2 border ${hasCapacityStep ? 'bg-emerald-50 border-emerald-200' : capacityFromActuals ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[10px] leading-relaxed text-slate-600">
                <span className="font-bold text-orange-500">Capacity ceiling £{avgMonthlyCapacityRevenue.toLocaleString()}/mo</span>
                {capacityFromActuals ? (
                  <>
                    {' '}— from your best month ({bestMonthLabel}, £{Math.round(bestMonthRevenue).toLocaleString()}),
                    which beats the {weeklyCapacity} units/wk in Settings — about {ceilingWeeklyUnits.toFixed(1)} units/wk.
                  </>
                ) : (
                  <>
                    {' '}— from {weeklyCapacity} units/wk in Settings at £{Math.round(avgUnitPriceOverall)}/unit.
                  </>
                )}
                {hasCapacityStep ? (
                  <>
                    {' '}Rising to <span className="font-bold text-emerald-600">£{avgMonthlyCapacityAfterStep.toLocaleString()}/mo</span>{' '}
                    from {stepFromLabel} ({stepWeeklyUnits} units/wk).
                  </>
                ) : (
                  <>
                    {' '}This ceiling holds for the whole forecast, so peak months can never exceed your current peak.
                    If you plan to take on more — going full time, adding help — set that date in Settings → Capacity Changes From.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <KPICard
              value={`£${y1Total.toLocaleString()}`}
              label="2026 Annual"
              sub={`£${Math.round(y1Total/12).toLocaleString()}/mo avg`}
              accentColor={y1Total / 12 >= REVENUE_TARGET ? '#22c55e' : '#ef4444'}
              tip="Full calendar year 2026 — actual revenue for completed months, plus a seasonally-shaped projection of your trend for the rest."
            />
            <KPICard
              value={`£${y2Total.toLocaleString()}`}
              label="2027 Annual"
              sub={`£${Math.round(y2Total/12).toLocaleString()}/mo avg`}
              accentColor={y2Total / 12 >= REVENUE_TARGET ? '#22c55e' : '#f97316'}
              tip={`2027 continues your ${Math.round(effectiveGrowthRate * 100)}%/month underlying trend, damped as it runs further out, shaped by the seasonal pattern and held under your capacity ceiling.`}
            />
          </div>
          <Insight text={forecastInsight()} />
        </Section>

        {/* ── CAPACITY & GROWTH ── */}
        <Section title="Capacity & Growth" id="section-capacity">
          {/* This month — donut + KPIs */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">This Month's Capacity</p>
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <CapacityDonut
                  confirmed={confirmedUnits}
                  booked={bookedFutureUnits}
                  available={spareUnitsThisMonth}
                  total={totalSlotsThisMonth}
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-600 flex-1">Confirmed</span>
                  <span className="text-sm font-bold text-slate-800">{confirmedUnits}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
                  <span className="text-xs text-slate-600 flex-1">Booked ahead</span>
                  <span className="text-sm font-bold text-slate-800">{bookedFutureUnits}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 shrink-0" />
                  <span className="text-xs text-slate-600 flex-1">Available</span>
                  <span className="text-sm font-bold text-slate-800">{spareUnitsThisMonth}</span>
                </div>
                <div className="pt-1 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">{totalSlotsThisMonth} total slots · {weeklyCapacity}/wk</p>
                  {spareRevenueThisMonth > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">~£{spareRevenueThisMonth.toLocaleString()} available revenue</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Monthly utilisation area chart */}
          {monthlyCapacityUtil.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">Monthly Capacity Utilisation</p>
                <span className="text-[10px] text-slate-400">orange band = above 80%</span>
              </div>
              <CapacityAreaChart data={monthlyCapacityUtil} todayFrac={todayFrac} />
            </div>
          )}

          <Insight text={capacityInsight()} />

          {/* Growth trend */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mt-2 mb-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">Revenue Growth Trend</p>
            {momGrowthRates.length >= 2 ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <KPICard
                    value={trailing3Growth !== null ? `${trailing3Growth >= 0 ? '+' : ''}${trailing3Growth}%` : '—'}
                    label="3-Month Growth"
                    sub="recent vs prior 3"
                    accentColor={trailing3Growth >= 0 ? '#22c55e' : '#ef4444'}
                    tip="Average of most recent 3 months vs average of the 3 months before that — overall revenue momentum."
                  />
                  <KPICard
                    value={`+${Math.round(effectiveGrowthRate * 100)}%/mo`}
                    label="Est. Growth (raw)"
                    sub="YoY clarity from Jan '27"
                    accentColor="#f97316"
                    tip="Raw revenue trend — includes seasonal uplift so this overstates true business growth. A genuine underlying rate needs year-on-year data, available from January 2027."
                  />
                </div>
                <GrowthDivergingChart data={momGrowthRates} />
              </>
            ) : (
              <p className="text-sm text-slate-400 text-center py-3">Need 3+ completed months for growth trend</p>
            )}
          </div>

          <Insight text={growthInsight()} />

          {/* Seasonality */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mt-2">
            <p className="text-sm font-semibold text-slate-700 mb-1">Seasonal Context</p>
            <p className="text-[10px] text-slate-400 mb-3">UK mountain bike suspension demand pattern</p>
            {/* Season band chart */}
            <div className="flex rounded-lg overflow-hidden h-4 mb-3">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => {
                const idx = [0.6,0.65,0.85,1.1,1.2,1.3,1.25,1.15,0.9,0.75,0.65,0.55][i]
                const isCurrent = i === (new Date()).getMonth()
                const bg = idx >= 1.2 ? '#22c55e' : idx >= 0.9 ? '#f97316' : '#94a3b8'
                return (
                  <div key={m} className="flex-1 flex items-end justify-center relative" style={{ backgroundColor: bg, opacity: isCurrent ? 1 : 0.5 }}>
                    {isCurrent && <div className="absolute inset-0 ring-2 ring-white ring-inset rounded-sm" />}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mb-3">
              <span>Jan</span><span>Jun</span><span>Dec</span>
            </div>
            <div className="flex gap-3 text-[10px] mb-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 shrink-0" />Peak</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 shrink-0" />Mid</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400 shrink-0" />Quiet</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <KPICard
                value={seasonallyAdjRevenue > 0 ? `£${seasonallyAdjRevenue.toLocaleString()}` : '—'}
                label="Season-Adj Revenue"
                sub={`÷ ${currentSeasonIdx}× (${seasonName.split(' ')[0]})`}
                accentColor="#38bdf8"
                tip={`This month's revenue divided by the ${seasonName.split(' ')[0]} seasonal factor (${currentSeasonIdx}×) — what you'd expect in an average month.`}
              />
              <KPICard
                value={winterRevProjection > 0 ? `£${winterRevProjection.toLocaleString()}` : '—'}
                label="Est. Dec Revenue"
                sub="at current base level"
                accentColor={winterRevProjection >= REVENUE_TARGET ? '#22c55e' : '#ef4444'}
                tip="Season-adjusted base × December seasonal factor (0.55×) — estimated revenue in your quietest month."
              />
            </div>
          </div>
          <Insight text={seasonalityInsight()} />
        </Section>

        {/* ── JOB VOLUME ── */}
        <Section title="Job Volume" id="section-jobs">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPICard value={jobs.length} label="Total Jobs" accentColor="#64748b"
              tip="Every job ever created — includes active, completed, and on-hold." />
            <KPICard value={activeJobs.length} label="Active" accentColor="#f97316"
              tip="Jobs with at least one unit not yet marked complete." />
            <KPICard value={completedJobs.length} label="Completed" accentColor="#22c55e"
              tip="Jobs where every unit is marked complete." />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Jobs Booked per Month</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-700">{thisMonth.jobCount}</span>
                <DeltaBadge current={thisMonth.jobCount} previous={lastMonth.jobCount} />
              </div>
            </div>
            <LineChart data={jobsChartData} color="#38bdf8" valueFormat={v => String(v)} todayFrac={todayFrac} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <KPICard value={avgUnitsPerJob.toFixed(1)} label="Avg Units / Job" sub="bikes per booking"
              tip="Total units ÷ total jobs — how many bikes a customer brings per visit on average." />
            <KPICard
              value={`${((completedJobs.length / Math.max(jobs.length, 1)) * 100).toFixed(0)}%`}
              label="Completion Rate"
              sub="jobs finished"
              accentColor="#22c55e"
              tip="Completed jobs ÷ all jobs — the proportion of work fully delivered." />
          </div>
          <Insight text={jobVolumeInsight()} />
        </Section>

        {/* ── UNITS VOLUME ── */}
        <Section title="Units Volume">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPICard value={allUnits.length} label="Total Units" accentColor="#64748b" />
            <KPICard value={activeUnits.length} label="Active" accentColor="#f97316" />
            <KPICard value={allUnits.filter(u => u.status === 'complete').length} label="Completed" accentColor="#22c55e" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Units Booked per Month</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-700">{thisMonth.unitCount || 0}</span>
                <DeltaBadge current={thisMonth.unitCount || 0} previous={lastMonth.unitCount || 0} />
              </div>
            </div>
            <LineChart data={unitsChartData} color="#f97316" valueFormat={v => String(v)} todayFrac={todayFrac} />
          </div>
          <Insight text={unitsInsight()} />
        </Section>

        {/* ── TURNAROUND ── */}
        <Section title="Turnaround Time">
          {avgTurnaround !== null ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <KPICard value={`${avgTurnaround}d`} label="Average" accentColor="#a855f7" />
                <KPICard value={`${minTurnaround}d`} label="Fastest" accentColor="#22c55e" />
                <KPICard value={`${maxTurnaround}d`} label="Slowest" accentColor="#ef4444" />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Avg Days per Month</p>
                <LineChart data={turnaroundChartData} color="#a855f7" valueFormat={v => `${v}d`} todayFrac={todayFrac} />
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-6">
              Appears once jobs have completed pickup dates
            </div>
          )}
          <Insight text={turnaroundInsight()} />
        </Section>

        {/* ── SERVICE TIME ── */}
        <Section title="Service Time by Model" id="section-service-time">
          {serviceTimeByModel.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-6">
              Service time data will appear once you start recording time against units
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Model</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Avg</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Min</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Max</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Trend</span>
              </div>
              {(() => {
                const brands = [...new Set(serviceTimeByModel.map(r => r.brand))].sort()
                return brands.map((brand, bi) => {
                  const rows = serviceTimeByModel.filter(r => r.brand === brand)
                  const color = colorMap[brand] ?? BRAND_PALETTE[bi % BRAND_PALETTE.length]
                  return (
                    <div key={brand}>
                      <div className="px-3 py-1.5 border-b border-slate-100" style={{ backgroundColor: `${color}10` }}>
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{brand}</span>
                      </div>
                      {rows.map((r, i) => (
                        <div key={r.model}
                          className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-2 items-center ${i < rows.length - 1 ? 'border-b border-slate-50' : ''}`}>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{r.model}</p>
                            <p className="text-[10px] text-slate-400">{r.units} unit{r.units !== 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-800 text-right">{formatHMS(r.avg)}</span>
                          <span className="text-[10px] font-mono text-slate-400 text-right">{formatHMS(r.min)}</span>
                          <span className="text-[10px] font-mono text-slate-400 text-right">{formatHMS(r.max)}</span>
                          <div className="text-right">
                            {r.trend === null
                              ? <span className="text-[10px] text-slate-300">—</span>
                              : r.trend < 0
                                ? <span className="text-[10px] font-bold text-emerald-500">↓{Math.abs(r.trend)}%</span>
                                : r.trend === 0
                                  ? <span className="text-[10px] font-bold text-slate-400">→</span>
                                  : <span className="text-[10px] font-bold text-red-500">↑{r.trend}%</span>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </Section>

        {/* ── CUSTOMERS ── */}
        <Section title="Customers" id="section-customers">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <KPICard value={customers.length} label="Total" accentColor="#38bdf8" />
            <KPICard value={repeatCustomers.length} label="Repeat" sub="2+ jobs" accentColor="#22c55e" />
            <KPICard
              value={customers.length ? `${((repeatCustomers.length / customers.length) * 100).toFixed(0)}%` : '—'}
              label="Retention" sub="repeat rate" accentColor="#a855f7"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <KPICard
              value={avgLTV > 0 ? `£${Math.round(avgLTV)}` : '—'}
              label="Avg Lifetime Value"
              sub="per customer"
              accentColor="#22c55e"
              tip="Total revenue ÷ number of customers who have spent — average value of a customer relationship."
            />
            <KPICard
              value={avgReturnInterval ? `${avgReturnInterval}d` : '—'}
              label="Return Interval"
              sub="repeat customers"
              accentColor="#38bdf8"
              tip="Average days between visits for customers who have booked more than once."
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">New Customers per Month</p>
            <LineChart data={newCustChartData} color="#38bdf8" valueFormat={v => String(v)} todayFrac={todayFrac} />
          </div>
          {topCustomers.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Top Customers by Spend</p>
              <div className="space-y-3">
                {topCustomers.map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700 truncate max-w-[55%]">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{c.jobCount} job{c.jobCount !== 1 ? 's' : ''}</span>
                        <span className="font-bold text-slate-800">£{c.spend.toFixed(0)}</span>
                      </div>
                    </div>
                    <HBar value={c.spend} max={maxCustSpend} color="#38bdf8" />
                  </div>
                ))}
              </div>
              {custSpend.length > 6 && (
                <p className="text-[10px] text-slate-400 mt-2 text-center">+{custSpend.length - 6} more customers</p>
              )}
            </div>
          )}
          <Insight text={customerInsight()} />
        </Section>

        {/* ── BRANDS ── */}
        <Section title="Brands & Equipment" id="section-brands">
          {topBrandsByCount.length > 0 ? (() => {
            const allBrands = allBrandNames
            const volSegs  = topBrandsByCount.map(([b, d]) => ({ label: b, value: d.count,   color: colorMap[b] }))
            const revSegs  = topBrandsByRevenue.map(([b, d]) => ({ label: b, value: d.revenue, color: colorMap[b] }))
            const totalVol = volSegs.reduce((s, d) => s + d.value, 0)
            const totalRev = revSegs.reduce((s, d) => s + d.value, 0)
            return (
              <div className="space-y-2">
                <div className="bg-white rounded-xl border border-slate-200 py-6 px-4">
                  <div className="grid grid-cols-2 items-center">
                    <div className="flex justify-center"><MiniDonut segments={volSegs} centerLabel={`${totalVol}`} centerSub="Volume" size={130} /></div>
                    <div className="flex justify-center"><MiniDonut segments={revSegs} centerLabel={`£${Math.round(totalRev/1000)}k`} centerSub="Revenue" size={130} /></div>
                  </div>
                </div>
              </div>
            )
          })() : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-6">
              Brand data appears as you log units on jobs
            </div>
          )}
          <Insight text={brandInsight()} />
        </Section>

        {/* ── MODELS ── */}
        {Object.keys(modelsByBrand).length > 0 && (
          <Section title="Models by Brand" id="section-brands">
            {(() => {
              const totalUnits = allUnits.length || 1
              const sorted = Object.entries(modelsByBrand).sort(([a], [b]) => a.localeCompare(b))
              const paired = ['Fox', 'Rockshox']
              const pairEntries = paired.map(b => sorted.find(([brand]) => brand === b)).filter(Boolean)
              const rest = sorted.filter(([b]) => !paired.includes(b))
              const BrandCard = ({ brand, models, flex }) => {
                const maxCount = models[0]?.count || 1
                const barColor = colorMap[brand] ?? BRAND_PALETTE[0]
                const brandTotal = models.reduce((s, m) => s + m.count, 0)
                const brandPct = ((brandTotal / totalUnits) * 100).toFixed(0)
                return (
                  <div className={`bg-white rounded-xl border border-slate-200 p-4${flex ? ' flex-1 min-w-0' : ''}`}>
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="text-sm font-bold" style={{ color: barColor }}>{brand}</p>
                      <span className="text-[10px] font-bold text-slate-400">{brandPct}% of all</span>
                    </div>
                    <div className="space-y-2.5">
                      {models.map(m => (
                        <div key={m.model}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-600 font-medium truncate pr-2">{m.model}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {modelMetric === 'qty'
                                ? <span className="text-xs font-semibold text-slate-700">{m.count}</span>
                                : <span className="text-xs font-semibold text-slate-700">{((m.count / totalUnits) * 100).toFixed(0)}%</span>
                              }
                              {showRevenue && <span className="text-[10px] text-slate-400">£{m.revenue.toFixed(0)}</span>}
                            </div>
                          </div>
                          <HBar value={m.count} max={maxCount} color={barColor} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              return (
                <div className="space-y-4">
                  {/* Toggles */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                      {['qty', 'pct'].map(v => (
                        <button key={v} onClick={() => setModelMetric(v)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${modelMetric === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                          {v === 'qty' ? 'Qty' : '% of total'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowRevenue(v => !v)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${showRevenue ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                      £ Revenue
                    </button>
                  </div>
                  {pairEntries.length === 2 && (
                    <div className="flex gap-3">
                      <BrandCard brand={pairEntries[0][0]} models={pairEntries[0][1]} flex />
                      <BrandCard brand={pairEntries[1][0]} models={pairEntries[1][1]} flex />
                    </div>
                  )}
                  {pairEntries.length === 1 && <BrandCard brand={pairEntries[0][0]} models={pairEntries[0][1]} />}
                  {rest.map(([brand, models]) => <BrandCard key={brand} brand={brand} models={models} />)}
                </div>
              )
            })()}
          </Section>
        )}


        {/* ── STOCK PREDICTOR ── */}
        <Section title="Stock Predictor" id="section-stock">
          {(() => {
            const PERIOD_OPTIONS = [
              { id: '1w', label: '1 Week',   weeks: 1 },
              { id: '4w', label: '4 Weeks',  weeks: 4 },
              { id: '3m', label: '3 Months', weeks: 13 },
            ]
            const selected = PERIOD_OPTIONS.find(p => p.id === stockPeriod) ?? PERIOD_OPTIONS[1]
            const multiplier = selected.weeks

            // Confidence: how many full periods of this length are in history
            const periodsInHistory = stockHistoryWeeks / multiplier
            const confidence = periodsInHistory >= 4 ? 'high' : periodsInHistory >= 2 ? 'medium' : periodsInHistory >= 1 ? 'low' : 'insufficient'
            const confColor = { high: '#22c55e', medium: '#f97316', low: '#ef4444', insufficient: '#94a3b8' }[confidence]
            const confLabel = { high: 'High confidence', medium: 'Moderate confidence', low: 'Low confidence', insufficient: 'Insufficient history' }[confidence]

            // Compute predicted units, filter out zero predictions
            const predictions = stockRates
              .map(r => ({ ...r, predicted: r.weeklyRate * multiplier }))
              .filter(r => r.predicted >= 0.1)

            // Group by brand
            const byBrand = {}
            predictions.forEach(r => {
              if (!byBrand[r.brand]) byBrand[r.brand] = []
              byBrand[r.brand].push(r)
            })
            const sortedBrands = Object.keys(byBrand).sort((a, b) => {
              const aTotal = byBrand[a].reduce((s, r) => s + r.predicted, 0)
              const bTotal = byBrand[b].reduce((s, r) => s + r.predicted, 0)
              return bTotal - aTotal
            })

            return (
              <div className="space-y-3">
                {/* Period selector */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                    {PERIOD_OPTIONS.map(p => (
                      <button key={p.id} onClick={() => setStockPeriod(p.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          stockPeriod === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: confColor }} />
                    <span className="text-[10px] font-semibold" style={{ color: confColor }}>{confLabel}</span>
                  </div>
                </div>

                {/* Context line */}
                <p className="text-[10px] text-slate-400">
                  Profile: {stockWindowLabel} · same base as revenue rolling avg ·
                  Predicted arrivals for the next {selected.label.toLowerCase()}
                </p>

                {confidence === 'insufficient' ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
                    Need at least one full {selected.label.toLowerCase()} of recent history to predict stock
                  </div>
                ) : predictions.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
                    No unit history to build a prediction from
                  </div>
                ) : (
                  sortedBrands.map(brand => {
                    const rows = byBrand[brand].sort((a, b) => b.predicted - a.predicted)
                    const brandTotal = rows.reduce((s, r) => s + r.predicted, 0)
                    const barColor = colorMap[brand] ?? BRAND_PALETTE[0]
                    const maxPredicted = rows[0].predicted
                    return (
                      <div key={brand} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between"
                          style={{ backgroundColor: `${barColor}10` }}>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: barColor }}>{brand}</span>
                          <span className="text-xs font-bold text-slate-700">{brandTotal.toFixed(1)} units predicted</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {rows.map(r => {
                            const pct = maxPredicted > 0 ? (r.predicted / maxPredicted) * 100 : 0
                            const isLow = r.predicted < 0.5
                            return (
                              <div key={r.model} className="px-4 py-2.5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-medium text-slate-700 truncate pr-3">{r.model}</span>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-[10px] text-slate-400">{r.count} historical</span>
                                    <span className={`text-sm font-bold ${isLow ? 'text-slate-400' : 'text-slate-800'}`}>
                                      {r.predicted >= 1 ? Math.round(r.predicted) : r.predicted.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, backgroundColor: isLow ? '#cbd5e1' : barColor }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })()}
        </Section>

      </div>
      </div>
    </div>
  )
}
