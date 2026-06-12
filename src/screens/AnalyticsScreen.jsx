import { useMemo } from 'react'
import { format, parseISO, differenceInDays, startOfMonth, subMonths, endOfMonth } from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

const REVENUE_TARGET = 3000

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-1">{title}</p>
      {children}
    </div>
  )
}

function KPICard({ value, label, sub, accentColor }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center"
      style={accentColor ? { borderTopWidth: 3, borderTopColor: accentColor } : {}}>
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

// SVG line chart. data = [{ label, value }], target = optional horizontal line value
function LineChart({ data, color = '#38bdf8', target = null, valueFormat = v => String(v), showZeroLine = false }) {
  const W = 300, H = 90
  const padT = 14, padB = 18, padL = 2, padR = 2
  const cW = W - padL - padR
  const cH = H - padT - padB

  const values = data.map(d => d.value)
  const maxVal = Math.max(target ?? 0, ...values, 1) * 1.08 // 8% headroom
  const n = data.length

  const toX = i => padL + (n > 1 ? (i / (n - 1)) * cW : cW / 2)
  const toY = v => padT + cH - Math.max(0, Math.min(v / maxVal, 1)) * cH

  // Build path for line and area
  const pts = data.map((d, i) => [toX(i), toY(d.value)])
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(padT + cH).toFixed(1)} L${padL},${(padT + cH).toFixed(1)} Z`

  const targetY = target != null ? toY(target) : null

  // Find max point for annotation
  const maxIdx = values.indexOf(Math.max(...values))
  const lastIdx = n - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill={`url(#grad-${color.replace('#','')})`} />

      {/* Target line */}
      {targetY != null && (
        <>
          <line x1={padL} y1={targetY} x2={W - padR} y2={targetY}
            stroke="#ef4444" strokeWidth="1.2" strokeDasharray="5 3" />
          <text x={W - padR - 1} y={targetY - 2} textAnchor="end" fontSize="6.5" fill="#ef4444" fontWeight="600">
            £{target.toLocaleString()} target
          </text>
        </>
      )}

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points — only non-zero, highlight last */}
      {data.map((d, i) => {
        if (d.value === 0) return null
        const [x, y] = pts[i]
        const isLast = i === lastIdx
        return (
          <circle key={i} cx={x} cy={y} r={isLast ? 3 : 2}
            fill={isLast ? color : '#fff'} stroke={color} strokeWidth="1.5" />
        )
      })}

      {/* Value label above last non-zero point */}
      {data[lastIdx]?.value > 0 && (
        <text x={pts[lastIdx][0]} y={pts[lastIdx][1] - 5} textAnchor="middle"
          fontSize="7" fill={color} fontWeight="700">
          {valueFormat(data[lastIdx].value)}
        </text>
      )}

      {/* X-axis month labels */}
      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={H - 1} textAnchor="middle" fontSize="6.5" fill="#94a3b8">
          {d.label}
        </text>
      ))}
    </svg>
  )
}

export default function AnalyticsScreen({ jobs, customers }) {
  const data = useMemo(() => {
    const today = new Date()
    const allUnits = jobs.flatMap(j => j.units || [])
    const completedJobs = jobs.filter(j => j.units?.length && j.units.every(u => u.status === 'complete'))
    const activeJobs = jobs.filter(j => !j.units?.length || j.units.some(u => u.status !== 'complete'))

    // Revenue totals
    const totalRevenue = jobs.reduce((s, j) => s + jobTotal(j), 0)
    const completedRevenue = completedJobs.reduce((s, j) => s + jobTotal(j), 0)
    const activeRevenue = activeJobs.reduce((s, j) => s + jobTotal(j), 0)
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
      months.push({ label, start, end, jobCount: monthJobs.length, revenue, avgTurnaround })
      cursor = startOfMonth(subMonths(cursor, -1))
    }

    const currentMonthStart = startOfMonth(today)
    const thisMonthIdx = months.findIndex(m => m.start.getTime() === currentMonthStart.getTime())
    const thisMonth = months[thisMonthIdx] ?? months[months.length - 1]
    const lastMonth = months[thisMonthIdx - 1] ?? months[0]
    const targetGap = REVENUE_TARGET - thisMonth.revenue
    const targetPct = Math.min((thisMonth.revenue / REVENUE_TARGET) * 100, 100).toFixed(0)

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

    // Customer metrics
    const repeatCustomers = customers.filter(c => jobs.filter(j => j.customer_id === c.id).length > 1)
    const custSpend = customers.map(c => {
      const cJobs = jobs.filter(j => j.customer_id === c.id)
      return { name: c.name, spend: cJobs.reduce((s, j) => s + jobTotal(j), 0), jobCount: cJobs.length }
    }).filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend)
    const topCustomers = custSpend.slice(0, 6)
    const maxCustSpend = topCustomers[0]?.spend || 1

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

    // Operational
    const overdueJobs = activeJobs.filter(j => j.pickup_date && parseISO(j.pickup_date) < today)
    const awaitingPartsJobs = jobs.filter(j => j.units?.some(u => u.status === 'awaiting_parts'))
    const readyJobs = jobs.filter(j =>
      j.units?.some(u => u.status === 'ready') &&
      j.units?.every(u => u.status === 'complete' || u.status === 'ready')
    )
    const oldestActiveDays = activeJobs.reduce((max, j) => {
      if (!j.drop_off_date) return max
      return Math.max(max, differenceInDays(today, parseISO(j.drop_off_date)))
    }, 0)
    const overdueRate = jobs.length ? ((overdueJobs.length / jobs.length) * 100).toFixed(0) : 0
    const partsBlockRate = jobs.length ? ((awaitingPartsJobs.length / jobs.length) * 100).toFixed(0) : 0

    return {
      totalRevenue, completedRevenue, activeRevenue, avgJobValue, avgCompletedValue,
      months, thisMonth, lastMonth, targetGap, targetPct,
      avgTurnaround, minTurnaround, maxTurnaround,
      allUnits, activeUnits, avgUnitsPerJob, unitStatusCounts,
      completedJobs, activeJobs,
      repeatCustomers, custSpend, topCustomers, maxCustSpend, newCustMonths,
      topBrandsByCount, topBrandsByRevenue, maxBrandCount, maxBrandRevenue, modelsByBrand,
      overdueJobs, awaitingPartsJobs, readyJobs, oldestActiveDays, overdueRate, partsBlockRate,
    }
  }, [jobs, customers])

  const {
    totalRevenue, completedRevenue, activeRevenue, avgJobValue, avgCompletedValue,
    months, thisMonth, lastMonth, targetGap, targetPct,
    avgTurnaround, minTurnaround, maxTurnaround,
    allUnits, activeUnits, avgUnitsPerJob, unitStatusCounts,
    completedJobs, activeJobs,
    repeatCustomers, custSpend, topCustomers, maxCustSpend, newCustMonths,
    topBrandsByCount, topBrandsByRevenue, maxBrandCount, maxBrandRevenue, modelsByBrand,
    overdueJobs, awaitingPartsJobs, readyJobs, oldestActiveDays, overdueRate, partsBlockRate,
  } = data

  if (!jobs.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-black safe-top shrink-0">
          <div className="px-4 py-3 flex items-center gap-3">
            <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Work Flow</h1>
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
            <h1 className="text-white font-bold text-lg leading-none">Work Flow</h1>
            <p className="text-slate-400 text-xs mt-1">Business insights</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-5">

        {/* ── REVENUE ── */}
        <Section title="Revenue">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPICard value={`£${totalRevenue.toFixed(0)}`} label="Total" sub="all time" accentColor="#22c55e" />
            <KPICard value={`£${completedRevenue.toFixed(0)}`} label="Invoiced" sub="completed" accentColor="#3b82f6" />
            <KPICard value={`£${activeRevenue.toFixed(0)}`} label="Pipeline" sub="active jobs" accentColor="#f97316" />
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
            <LineChart data={revenueChartData} color="#22c55e" target={REVENUE_TARGET} valueFormat={v => `£${v.toFixed(0)}`} />
          </div>

          {/* Target progress bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-slate-700">This Month vs Target</p>
              <span className={`text-sm font-bold ${Number(targetPct) >= 100 ? 'text-emerald-600' : 'text-slate-700'}`}>
                {targetPct}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${targetPct}%`, backgroundColor: Number(targetPct) >= 100 ? '#22c55e' : Number(targetPct) >= 75 ? '#f97316' : '#ef4444' }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
              <span>£0</span>
              <span className="text-red-400 font-medium">£{REVENUE_TARGET.toLocaleString()} target</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <KPICard value={`£${avgJobValue.toFixed(0)}`} label="Avg Job Value" sub="all jobs" />
              <KPICard value={`£${avgCompletedValue.toFixed(0)}`} label="Avg Completed" sub="invoiced" />
            </div>
          </div>
        </Section>

        {/* ── JOB VOLUME ── */}
        <Section title="Job Volume">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPICard value={jobs.length} label="Total Jobs" accentColor="#64748b" />
            <KPICard value={activeJobs.length} label="Active" accentColor="#f97316" />
            <KPICard value={completedJobs.length} label="Completed" accentColor="#22c55e" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Jobs Booked per Month</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-700">{thisMonth.jobCount}</span>
                <DeltaBadge current={thisMonth.jobCount} previous={lastMonth.jobCount} />
              </div>
            </div>
            <LineChart data={jobsChartData} color="#38bdf8" valueFormat={v => String(v)} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <KPICard value={avgUnitsPerJob.toFixed(1)} label="Avg Units / Job" sub="bikes per booking" />
            <KPICard
              value={`${((completedJobs.length / Math.max(jobs.length, 1)) * 100).toFixed(0)}%`}
              label="Completion Rate"
              sub="jobs finished"
              accentColor="#22c55e"
            />
          </div>
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
                <LineChart data={turnaroundChartData} color="#a855f7" valueFormat={v => `${v}d`} />
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-6">
              Appears once jobs have completed pickup dates
            </div>
          )}
        </Section>

        {/* ── WORKSHOP PIPELINE ── */}
        <Section title="Workshop Pipeline">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            {allUnits.length > 0 && (
              <div className="flex h-5 rounded-lg overflow-hidden mb-3 gap-px">
                {STATUS_ORDER.map(s => {
                  const n = unitStatusCounts[s] || 0
                  const pct = (n / allUnits.length) * 100
                  if (pct === 0) return null
                  return <div key={s} style={{ width: `${pct}%`, backgroundColor: STATUS_CONFIG[s].bg }} />
                })}
              </div>
            )}
            <div className="space-y-2">
              {STATUS_ORDER.map(s => {
                const n = unitStatusCounts[s] || 0
                const cfg = STATUS_CONFIG[s]
                const pct = allUnits.length ? ((n / allUnits.length) * 100).toFixed(0) : 0
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.bg }} />
                    <span className="text-xs font-medium text-slate-700 w-28 shrink-0">{cfg.label}</span>
                    <div className="flex-1">
                      <HBar value={n} max={allUnits.length} color={cfg.bg} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 w-5 text-right shrink-0">{n}</span>
                    <span className="text-[10px] text-slate-400 w-7 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
              <span>{allUnits.length} total units</span>
              <span>{activeUnits.length} active · {unitStatusCounts.complete || 0} complete</span>
            </div>
          </div>
        </Section>

        {/* ── OPERATIONAL HEALTH ── */}
        <Section title="Operational Health">
          <div className="grid grid-cols-2 gap-2">
            <KPICard value={overdueJobs.length} label="Overdue Jobs" sub={`${overdueRate}% of all jobs`}
              accentColor={overdueJobs.length > 0 ? '#ef4444' : '#22c55e'} />
            <KPICard value={awaitingPartsJobs.length} label="Awaiting Parts" sub={`${partsBlockRate}% blocked`}
              accentColor={awaitingPartsJobs.length > 0 ? '#f97316' : '#22c55e'} />
            <KPICard value={readyJobs.length} label="Ready to Collect" sub="notify customers"
              accentColor={readyJobs.length > 0 ? '#a855f7' : '#22c55e'} />
            <KPICard value={oldestActiveDays > 0 ? `${oldestActiveDays}d` : '—'} label="Oldest Active" sub="days in workshop"
              accentColor={oldestActiveDays > 14 ? '#ef4444' : oldestActiveDays > 7 ? '#f97316' : '#64748b'} />
          </div>
        </Section>

        {/* ── CUSTOMERS ── */}
        <Section title="Customers">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KPICard value={customers.length} label="Total" accentColor="#38bdf8" />
            <KPICard value={repeatCustomers.length} label="Repeat" sub="2+ jobs" accentColor="#22c55e" />
            <KPICard
              value={customers.length ? `${((repeatCustomers.length / customers.length) * 100).toFixed(0)}%` : '—'}
              label="Retention" sub="repeat rate" accentColor="#a855f7"
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">New Customers per Month</p>
            <LineChart data={newCustChartData} color="#38bdf8" valueFormat={v => String(v)} />
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
        </Section>

        {/* ── BRANDS ── */}
        <Section title="Brands & Equipment">
          {topBrandsByCount.length > 0 ? (
            <div className="space-y-2">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Volume by Brand</p>
                <div className="space-y-2.5">
                  {topBrandsByCount.map(([brand, d]) => (
                    <div key={brand}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{brand}</span>
                        <span className="font-bold text-slate-800">{d.count} unit{d.count !== 1 ? 's' : ''}</span>
                      </div>
                      <HBar value={d.count} max={maxBrandCount} color="#f97316" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Revenue by Brand</p>
                <div className="space-y-2.5">
                  {topBrandsByRevenue.map(([brand, d]) => (
                    <div key={brand}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{brand}</span>
                        <span className="font-bold text-slate-800">£{d.revenue.toFixed(0)}</span>
                      </div>
                      <HBar value={d.revenue} max={maxBrandRevenue} color="#a855f7" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Revenue per Unit by Brand</p>
                <div className="space-y-2.5">
                  {topBrandsByRevenue.map(([brand, d]) => {
                    const perUnit = d.count > 0 ? d.revenue / d.count : 0
                    const maxPU = Math.max(...topBrandsByRevenue.map(([, b]) => b.count ? b.revenue / b.count : 0), 1)
                    return (
                      <div key={brand}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{brand}</span>
                          <span className="font-bold text-slate-800">£{perUnit.toFixed(0)} / unit</span>
                        </div>
                        <HBar value={perUnit} max={maxPU} color="#22c55e" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400 text-sm py-6">
              Brand data appears as you log units on jobs
            </div>
          )}
        </Section>

        {/* ── MODELS ── */}
        {Object.keys(modelsByBrand).length > 0 && (
          <Section title="Models by Brand">
            <div className="space-y-4">
              {Object.entries(modelsByBrand)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([brand, models]) => {
                  const maxCount = models[0]?.count || 1
                  return (
                    <div key={brand} className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-sm font-bold text-slate-800 mb-3">{brand}</p>
                      <div className="space-y-2.5">
                        {models.map(m => (
                          <div key={m.model}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-600 font-medium truncate pr-2">{m.model}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-semibold text-slate-700">{m.count}</span>
                                <span className="text-[10px] text-slate-400">£{m.revenue.toFixed(0)}</span>
                              </div>
                            </div>
                            <HBar value={m.count} max={maxCount} color="#f97316" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          </Section>
        )}

      </div>
    </div>
  )
}
