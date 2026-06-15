import { useState } from 'react'
import { format, parseISO, differenceInDays, addDays, isToday, isTomorrow } from 'date-fns'
import JobModal from '../components/JobModal'

const STATUS_URGENCY = { awaiting_parts: 0, ready: 1, in_progress: 2, booked_in: 3, on_hold: 4, complete: 5 }

function jobUrgency(job) {
  const statuses = job.units?.map(u => u.status) || ['booked_in']
  return Math.min(...statuses.map(s => STATUS_URGENCY[s] ?? 99))
}

function jobTotal(job) {
  return (job.units || []).reduce((s, u) => s + (parseFloat(u.price) || 0), 0)
}

function daysInWorkshop(job, today) {
  if (!job.drop_off_date) return 0
  return differenceInDays(today, parseISO(job.drop_off_date))
}

function isOverdue(job, today) {
  return job.pickup_date && parseISO(job.pickup_date) < today
}

const allOnHold = job => job.units?.length > 0 && job.units.every(u => u.status === 'on_hold')

// ── Alert picker modal ────────────────────────────────────────────────────────
function AlertPickerModal({ jobs, title, color, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl pb-safe overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <button onClick={onClose} className="text-slate-400 active:text-slate-600">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto max-h-96 p-3 space-y-2">
          {jobs.map(job => (
            <button key={job.id} onClick={() => { onSelect(job); onClose() }}
              className="w-full flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 text-left active:bg-slate-100"
              style={{ borderLeft: `4px solid ${color}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{job.customers?.name || '—'}</p>
                <p className="text-xs text-slate-400 truncate">
                  {job.units?.map(u => `${u.brand} ${u.model}`).join(', ')}
                </p>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Alert banner ─────────────────────────────────────────────────────────────
function AlertBanner({ label, count, color, bg, onClick }) {
  if (!count) return null
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-left active:opacity-80"
      style={{ backgroundColor: bg, border: `1px solid ${color}20` }}>
      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
        style={{ backgroundColor: color }}>{count}</span>
      <span className="text-sm font-semibold flex-1" style={{ color }}>{label}</span>
      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} style={{ color }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  )
}

// ── Job card ─────────────────────────────────────────────────────────────────
function JobCard({ job, today, onClick, statusConfig }) {
  const overdue = isOverdue(job, today)
  const days = daysInWorkshop(job, today)
  const urgency = jobUrgency(job)
  const total = jobTotal(job)

  // Dominant status colour for left border
  const units = job.units || []
  const dominantStatus = units.reduce((best, u) => {
    return (STATUS_URGENCY[u.status] ?? 99) < (STATUS_URGENCY[best] ?? 99) ? u.status : best
  }, units[0]?.status || 'booked_in')
  const cfg = statusConfig?.[dominantStatus] ?? { bg: '#94a3b8', light: '#f8fafc', border: '#e2e8f0', text: '#64748b' }

  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-xl border text-left active:bg-slate-50 transition-colors overflow-hidden"
      style={{ borderColor: overdue ? '#fca5a5' : cfg.border, borderLeftWidth: 4, borderLeftColor: overdue ? '#ef4444' : cfg.bg }}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className="font-bold text-slate-900 text-sm leading-tight">{job.customers?.name || '—'}</span>
            {job.notes ? <p className="text-xs text-slate-400 mt-0.5 truncate">{job.notes}</p> : null}
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-bold text-slate-800">£{total.toFixed(0)}</span>
            {overdue ? (
              <p className="text-[10px] font-bold text-red-500 mt-0.5">OVERDUE</p>
            ) : job.pickup_date ? (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Due {isToday(parseISO(job.pickup_date)) ? 'today' : isTomorrow(parseISO(job.pickup_date)) ? 'tomorrow' : format(parseISO(job.pickup_date), 'd MMM')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {job.units?.map(u => {
            const sc = statusConfig?.[u.status] ?? { light: '#f8fafc', text: '#64748b', border: '#e2e8f0' }
            return (
              <span key={u.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: sc.light, color: sc.text, border: `1px solid ${sc.border}` }}>
                {u.brand} {u.model}
              </span>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: cfg.bg }}>
            {statusConfig?.[dominantStatus]?.label ?? dominantStatus}
          </span>
          {days > 0 && (
            <span className={`text-[10px] font-medium ${days > 14 ? 'text-red-500' : days > 7 ? 'text-amber-500' : 'text-slate-400'}`}>
              {days}d in workshop
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Mini schedule row (Today / Coming Up) ─────────────────────────────────────
function ScheduleRow({ job, label, sublabel, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2.5 text-left active:bg-slate-50">
      {label && (
        <div className="w-12 shrink-0 text-center">
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sublabel && <p className="text-[10px] text-slate-400">{sublabel}</p>}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{job.customers?.name || '—'}</p>
        <p className="text-xs text-slate-400 truncate">
          {job.units?.map(u => `${u.brand} ${u.model}`).join(' · ')}
        </p>
      </div>
      <span className="text-sm font-bold text-slate-600 shrink-0">£{jobTotal(job).toFixed(0)}</span>
    </button>
  )
}

function SectionHeader({ children, count, color }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{children}</p>
      {count != null && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
          style={{ backgroundColor: color || '#94a3b8' }}>{count}</span>
      )}
    </div>
  )
}

function EmptyRow({ text }) {
  return <p className="text-sm text-slate-400 text-center py-3">{text}</p>
}

// ── Revenue strip ────────────────────────────────────────────────────────────
function RevenueStrip({ jobs, settings }) {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const wo = { weekStartsOn: 1 }
  const startOfThisWeek = new Date(today)
  startOfThisWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  startOfThisWeek.setHours(0, 0, 0, 0)
  const endOfThisWeek = new Date(startOfThisWeek)
  endOfThisWeek.setDate(startOfThisWeek.getDate() + 6)

  const thisMonthStr = format(today, 'yyyy-MM')
  const weekJobs = jobs.filter(j => j.drop_off_date >= format(startOfThisWeek, 'yyyy-MM-dd') && j.drop_off_date <= format(endOfThisWeek, 'yyyy-MM-dd'))
  const monthJobs = jobs.filter(j => j.drop_off_date?.startsWith(thisMonthStr))
  const weekRev = weekJobs.reduce((s, j) => s + jobTotal(j), 0)
  const monthRev = monthJobs.reduce((s, j) => s + jobTotal(j), 0)
  const target = settings?.revenueTarget ?? 3000
  const targetPct = Math.min(Math.round((monthRev / target) * 100), 999)

  return (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Revenue</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-base font-bold text-slate-900">£{weekRev.toFixed(0)}</p>
          <p className="text-[10px] text-slate-400">This week</p>
        </div>
        <div>
          <p className="text-base font-bold text-slate-900">£{monthRev.toFixed(0)}</p>
          <p className="text-[10px] text-slate-400">This month</p>
        </div>
        <div>
          <p className={`text-base font-bold ${targetPct >= 100 ? 'text-green-600' : targetPct >= 60 ? 'text-amber-500' : 'text-slate-900'}`}>{targetPct}%</p>
          <p className="text-[10px] text-slate-400">of target</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(targetPct, 100)}%`, backgroundColor: targetPct >= 100 ? '#22c55e' : targetPct >= 60 ? '#f59e0b' : '#38bdf8' }} />
      </div>
    </div>
  )
}

// ── Stock view ───────────────────────────────────────────────────────────────
function StockView({ jobs }) {
  // Collect all active units across workshop + upcoming (not complete, not on hold)
  const units = jobs
    .filter(j => !j.units?.every(u => u.status === 'complete' || u.status === 'on_hold'))
    .flatMap(j => (j.units || []).filter(u => u.status !== 'complete' && u.status !== 'on_hold'))

  if (!units.length) return null

  // Group by brand → model → count
  const byBrand = {}
  units.forEach(u => {
    const brand = u.brand || 'Unknown'
    const model = u.model?.trim() || 'Unknown'
    if (!byBrand[brand]) byBrand[brand] = {}
    byBrand[brand][model] = (byBrand[brand][model] || 0) + 1
  })
  const brands = Object.entries(byBrand).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Active Units · Stock View</p>
      <div className="space-y-2.5">
        {brands.map(([brand, models]) => (
          <div key={brand}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{brand}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(models).sort(([, a], [, b]) => b - a).map(([model, count]) => (
                <span key={model} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                  <span className="text-xs text-slate-700 font-medium">{model}</span>
                  <span className="text-[10px] font-bold text-slate-400">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ jobs, customers, loading, saveJob, deleteJob, settings, refresh }) {
  const [editJob, setEditJob] = useState(null)
  const [alertPicker, setAlertPicker] = useState(null) // { jobs, title, color }

  function closeModal() {
    setEditJob(null)
    refresh?.()
  }

  function openAlert(alertJobs, title, color) {
    if (alertJobs.length === 1) { setEditJob(alertJobs[0]); return }
    setAlertPicker({ jobs: alertJobs, title, color })
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = format(today, 'yyyy-MM-dd')
  const statusConfig = settings?.statusConfig

  // Jobs physically in the workshop: dropped off on or before today, not all complete
  const inWorkshop = jobs
    .filter(j => {
      if (!j.drop_off_date || j.drop_off_date > todayStr) return false
      if (!j.units?.length) return false
      if (j.units.every(u => u.status === 'complete' || u.status === 'on_hold')) return false
      return true
    })
    .sort((a, b) => {
      const aOver = isOverdue(a, today) ? 0 : 1
      const bOver = isOverdue(b, today) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      const urgDiff = jobUrgency(a) - jobUrgency(b)
      if (urgDiff !== 0) return urgDiff
      return (a.drop_off_date || '').localeCompare(b.drop_off_date || '')
    })

  // Alert buckets (live, unfiltered)
  const overdueJobs      = inWorkshop.filter(j => isOverdue(j, today))
  const awaitingPartJobs = inWorkshop.filter(j => j.units?.some(u => u.status === 'awaiting_parts'))
  const readyJobs        = inWorkshop.filter(j => j.units?.some(u => u.status === 'ready'))
  const onHoldJobs       = jobs.filter(j => j.units?.some(u => u.status === 'on_hold') && !j.units.every(u => u.status === 'complete'))

  // Today's schedule — exclude all-on-hold jobs
  const dropOffsToday = jobs.filter(j => j.drop_off_date === todayStr && !allOnHold(j))
  const pickupsToday  = inWorkshop.filter(j => j.pickup_date === todayStr)

  // Coming up — drop-offs in next 7 days, exclude all-on-hold
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1))
  const upcoming = next7
    .map(d => {
      const ds = format(d, 'yyyy-MM-dd')
      const dayJobs = jobs.filter(j => j.drop_off_date === ds && !allOnHold(j))
      return { date: d, dateStr: ds, jobs: dayJobs }
    })
    .filter(g => g.jobs.length > 0)

  const hasAlerts = overdueJobs.length || awaitingPartJobs.length || readyJobs.length || onHoldJobs.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work Flow</h1>
            <p className="text-slate-400 text-xs mt-1">{format(today, 'EEEE d MMMM')}</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg leading-none">{inWorkshop.length}</p>
            <p className="text-slate-400 text-[10px] mt-0.5">on bench</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-2xl mx-auto p-4 space-y-5">

          {/* Alerts */}
          {hasAlerts > 0 && (
            <div className="space-y-2">
              <AlertBanner label={`${overdueJobs.length} overdue — past promised pickup date`}
                count={overdueJobs.length} color="#ef4444" bg="#fef2f2"
                onClick={() => openAlert(overdueJobs, 'Overdue jobs', '#ef4444')} />
              <AlertBanner label={`${awaitingPartJobs.length} blocked — waiting on parts`}
                count={awaitingPartJobs.length} color="#f59e0b" bg="#fffbeb"
                onClick={() => openAlert(awaitingPartJobs, 'Waiting on parts', '#f59e0b')} />
              <AlertBanner label={`${readyJobs.length} ready — contact customer to collect`}
                count={readyJobs.length} color="#a855f7" bg="#faf5ff"
                onClick={() => openAlert(readyJobs, 'Ready to collect', '#a855f7')} />
              <AlertBanner label={`${onHoldJobs.length} on hold — pending decision`}
                count={onHoldJobs.length} color="#6b7280" bg="#f9fafb"
                onClick={() => openAlert(onHoldJobs, 'On hold', '#6b7280')} />
            </div>
          )}

          {/* In the Workshop */}
          <div>
            <SectionHeader count={inWorkshop.length} color="#0ea5e9">In the Workshop</SectionHeader>
            {inWorkshop.length === 0
              ? <EmptyRow text="Nothing on the bench right now" />
              : <div className="space-y-2">
                  {inWorkshop.map(job => (
                    <JobCard key={job.id} job={job} today={today}
                      statusConfig={statusConfig}
                      onClick={() => setEditJob(job)} />
                  ))}
                </div>
            }
          </div>

          {/* Today */}
          {(dropOffsToday.length > 0 || pickupsToday.length > 0) && (
            <div>
              <SectionHeader>Today</SectionHeader>
              <div className="space-y-1.5">
                {dropOffsToday.map(job => (
                  <ScheduleRow key={`in-${job.id}`} job={job}
                    label="IN" sublabel="drop-off"
                    onClick={() => setEditJob(job)} />
                ))}
                {pickupsToday.map(job => (
                  <ScheduleRow key={`out-${job.id}`} job={job}
                    label="OUT" sublabel="pickup"
                    onClick={() => setEditJob(job)} />
                ))}
              </div>
            </div>
          )}

          {/* Coming Up */}
          {upcoming.length > 0 && (
            <div>
              <SectionHeader>Coming Up</SectionHeader>
              <div className="space-y-1.5">
                {upcoming.flatMap(g =>
                  g.jobs.map(job => (
                    <ScheduleRow key={job.id} job={job}
                      label={isToday(g.date) ? 'Today' : isTomorrow(g.date) ? 'Tmrw' : format(g.date, 'EEE d')}
                      onClick={() => setEditJob(job)} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Revenue */}
          <RevenueStrip jobs={jobs} settings={settings} />

          {/* Stock view */}
          <StockView jobs={jobs} />

        </div>
      </div>

      {alertPicker && (
        <AlertPickerModal
          jobs={alertPicker.jobs}
          title={alertPicker.title}
          color={alertPicker.color}
          onSelect={setEditJob}
          onClose={() => setAlertPicker(null)}
        />
      )}

      {editJob && (
        <JobModal job={editJob} customers={customers}
          onSave={saveJob} onDelete={deleteJob}
          onClose={closeModal}
          settings={settings} />
      )}
    </div>
  )
}
