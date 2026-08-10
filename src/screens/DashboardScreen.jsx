import { useState } from 'react'
import { format, parseISO, differenceInDays, addDays, isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns'
import JobModal from '../components/JobModal'

// ── Todo row ──────────────────────────────────────────────────────────────────
function TodoRow({ todo, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(todo.text)

  function handleSave() {
    if (text.trim() && text.trim() !== todo.text) onEdit(todo.id, text.trim())
    setEditing(false)
  }

  return (
    <div className={`flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 ${todo.completed ? 'opacity-60' : ''}`}>
      <button onClick={() => onToggle(todo.id, !todo.completed)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          todo.completed ? 'bg-green-500 border-green-500' : 'border-amber-400'
        }`}>
        {todo.completed && (
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 text-sm bg-white border border-amber-300 rounded-lg px-2 py-0.5 text-slate-800 outline-none"
        />
      ) : (
        <p className={`flex-1 text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}
          onClick={() => setEditing(true)}>{todo.text}</p>
      )}
      <button onClick={() => onDelete(todo.id)} className="text-slate-300 active:text-red-400 shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Add todo form ─────────────────────────────────────────────────────────────
function AddTodoForm({ defaultDate, onAdd, onClose }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!text.trim() || !date) return
    setSaving(true)
    try { await onAdd(text.trim(), date) } finally { setSaving(false) }
    onClose()
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose() }}
        placeholder="To-do note…"
        className="w-full text-sm bg-white border border-amber-300 rounded-lg px-3 py-2 text-slate-800 outline-none placeholder-slate-400"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="flex-1 text-sm bg-white border border-amber-300 rounded-lg px-2 py-1.5 text-slate-700 outline-none"
        />
        <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-500 active:text-slate-700">Cancel</button>
        <button onClick={handleAdd} disabled={saving || !text.trim()}
          className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 active:bg-amber-600">
          Add
        </button>
      </div>
    </div>
  )
}

const STATUS_URGENCY = { awaiting_parts: 0, ready: 1, in_progress: 2, booked_in: 3, on_hold: 4, complete: 5 }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-xl"
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
                {job.drop_off_date && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Drop-off {format(parseISO(job.drop_off_date), 'd MMM yyyy')}
                  </p>
                )}
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

const FALLBACK_CFG = { bg: '#94a3b8', light: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: '—' }

function dominantStatusOf(job) {
  const units = job.units || []
  return units.reduce(
    (best, u) => ((STATUS_URGENCY[u.status] ?? 99) < (STATUS_URGENCY[best] ?? 99) ? u.status : best),
    units[0]?.status || 'booked_in'
  )
}

function dueLabelFor(job, today) {
  if (isOverdue(job, today)) return { text: 'OVERDUE', overdue: true }
  if (!job.pickup_date) return null
  const d = parseISO(job.pickup_date)
  if (isToday(d)) return { text: 'Today' }
  if (isTomorrow(d)) return { text: 'Tmrw' }
  return { text: format(d, 'd MMM') }
}

// The unit a timer should attach to — first one still being worked on
function timerUnitFor(job) {
  return (job.units || []).find(u => u.status !== 'complete' && u.status !== 'on_hold') || job.units?.[0]
}

// ── Unit pills with timer buttons — shared by the hero and expanded rows ─────
function UnitPills({ job, statusConfig, activeTimer, onStartTimer }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(job.units || []).map(u => {
        const sc = statusConfig?.[u.status] ?? FALLBACK_CFG
        const isRecording = activeTimer?.unit?.id === u.id
        return (
          <div key={u.id} className="flex items-center gap-1">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: sc.light, color: sc.text, border: `1px solid ${sc.border}` }}>
              {u.brand} {u.model}
            </span>
            {onStartTimer && (
              <button
                onClick={e => { e.stopPropagation(); onStartTimer(job, u) }}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                  isRecording
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-slate-400 border-slate-200 active:bg-slate-50'
                }`}
                aria-label={isRecording ? 'Recording' : `Start timer for ${u.brand} ${u.model}`}
              >
                {isRecording
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse block" /> Rec</>
                  : <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                }
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Up next — the top job in your manual work order ──────────────────────────
function UpNextHero({ job, today, statusConfig, activeTimer, onStartTimer, onOpen, benchCount }) {
  const cfg = statusConfig?.[dominantStatusOf(job)] ?? FALLBACK_CFG
  const days = daysInWorkshop(job, today)
  const due = dueLabelFor(job, today)
  const unit = timerUnitFor(job)
  const isRecording = activeTimer?.job?.id === job.id
  const unitLine = (job.units || []).map(u => [u.brand, u.model].filter(Boolean).join(' ')).join(' · ')

  return (
    <div className="bg-white rounded-2xl border p-3.5"
      style={{ borderColor: cfg.border, boxShadow: `0 3px 14px -6px ${cfg.bg}80` }}>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.text }}>Up next</p>
        <span className="ml-auto text-[10px] text-slate-400">1st of {benchCount} in your order</span>
      </div>

      <button onClick={onOpen} className="w-full text-left active:opacity-70">
        <p className="text-lg font-bold text-slate-900 leading-tight">{job.customers?.name || '—'}</p>
        {unitLine && <p className="text-[13px] text-slate-600 mt-0.5 font-medium">{unitLine}</p>}
        {job.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{job.notes}</p>}
      </button>

      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: cfg.bg }}>
          {cfg.label}
        </span>
        {days > 0 && (
          <span className={`text-[10px] font-medium ${days > 14 ? 'text-red-500' : days > 7 ? 'text-amber-500' : 'text-slate-400'}`}>
            {days}d in workshop
          </span>
        )}
        {due && (
          <span className={`text-[10px] font-medium ${due.overdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
            {due.overdue ? 'OVERDUE' : `Due ${due.text.toLowerCase()}`}
          </span>
        )}
        <span className="ml-auto text-sm font-bold text-slate-800">£{jobTotal(job).toFixed(0)}</span>
      </div>

      <div className="flex gap-2 mt-3">
        {onStartTimer && unit && (
          <button
            onClick={() => onStartTimer(job, unit)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${
              isRecording ? 'bg-sky-600 text-white' : 'bg-sky-500 active:bg-sky-600 text-white'
            }`}
          >
            {isRecording ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse block" /> Recording</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
                </svg>
                Start timer
              </>
            )}
          </button>
        )}
        <button onClick={onOpen}
          className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 bg-white border border-slate-200 active:bg-slate-50">
          Open
        </button>
      </div>
    </div>
  )
}

// ── Compact bench row — tap to reveal units and timers ───────────────────────
function CompactJobRow({ job, today, statusConfig, expanded, onToggle, onOpen, activeTimer, onStartTimer }) {
  const overdue = isOverdue(job, today)
  const days = daysInWorkshop(job, today)
  const cfg = statusConfig?.[dominantStatusOf(job)] ?? FALLBACK_CFG
  const due = dueLabelFor(job, today)
  const units = job.units || []
  const unitLine = units.map(u => [u.brand, u.model].filter(Boolean).join(' ')).join(' · ')
  const isRecording = activeTimer?.job?.id === job.id

  return (
    <div className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: overdue ? '#fca5a5' : cfg.border, borderLeftWidth: 3, borderLeftColor: overdue ? '#ef4444' : cfg.bg }}>
      <button onClick={onToggle}
        className="w-full flex items-center gap-2.5 pl-2.5 pr-2 py-2 text-left active:bg-slate-50 transition-colors">
        <div className="flex gap-1 shrink-0">
          {units.slice(0, 4).map(u => (
            <span key={u.id} className="w-[7px] h-[7px] rounded-full block"
              style={{ backgroundColor: (statusConfig?.[u.status] ?? FALLBACK_CFG).bg }} />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 leading-tight truncate">
            {job.customers?.name || '—'}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {unitLine}{days > 0 ? ` · ${days}d` : ''}
          </p>
        </div>
        {isRecording && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse block shrink-0" />}
        <div className="text-right shrink-0">
          <p className="text-[13px] font-bold text-slate-800 leading-tight">£{jobTotal(job).toFixed(0)}</p>
          {due && (
            <p className={due.overdue ? 'text-[9px] font-bold text-red-500' : 'text-[9px] text-slate-400'}>
              {due.text}
            </p>
          )}
        </div>
        <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 text-slate-300 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 pt-2 border-t border-slate-50 space-y-2">
          <UnitPills job={job} statusConfig={statusConfig} activeTimer={activeTimer} onStartTimer={onStartTimer} />
          {job.notes && <p className="text-[11px] text-slate-400">{job.notes}</p>}
          <button onClick={onOpen}
            className="w-full py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 active:bg-slate-100">
            Open job
          </button>
        </div>
      )}
    </div>
  )
}

// ── Glance tiles + workshop state bar ────────────────────────────────────────
function GlanceCard({ benchJobs, benchUnits, dueToday, blocked, monthRev, target, statusConfig, statusOrder, onJump }) {
  const targetPct = target > 0 ? Math.round((monthRev / target) * 100) : 0
  const counts = (statusOrder || []).map(s => ({
    key: s,
    cfg: statusConfig?.[s] ?? FALLBACK_CFG,
    n: benchUnits.filter(u => u.status === s).length,
  })).filter(s => s.n > 0)
  const totalUnits = benchUnits.length

  const Tile = ({ value, label, sub, tone, target: jumpTo }) => (
    <button onClick={() => onJump?.(jumpTo)}
      className="py-2.5 px-1 text-center border-r border-slate-100 last:border-r-0 active:bg-slate-50 transition-colors">
      <p className={`text-[19px] font-bold leading-none tracking-tight ${tone || 'text-slate-900'}`}>{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
    </button>
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-4">
        <Tile value={benchJobs} label="Bench" sub={`${totalUnits} unit${totalUnits !== 1 ? 's' : ''}`} jumpTo="bench" />
        <Tile value={dueToday} label="Due today" sub="pickups" jumpTo="today" />
        <Tile value={blocked} label="Blocked" sub="on parts" tone={blocked > 0 ? 'text-red-500' : undefined} jumpTo="bench" />
        <Tile
          value={`£${monthRev >= 1000 ? `${(monthRev / 1000).toFixed(1)}k` : monthRev.toFixed(0)}`}
          label="Month"
          sub={`${targetPct}% of target`}
          tone={targetPct >= 100 ? 'text-green-600' : targetPct >= 60 ? 'text-amber-500' : undefined}
        />
      </div>

      {totalUnits > 0 && (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workshop state</p>
            <span className="text-[10px] text-slate-400">{totalUnits} units</span>
          </div>
          <div className="flex gap-[1.5px] h-2 rounded-full overflow-hidden">
            {counts.map(s => (
              <span key={s.key} className="block" style={{ width: `${(s.n / totalUnits) * 100}%`, backgroundColor: s.cfg.bg }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {counts.map(s => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-[7px] h-[7px] rounded-full block shrink-0" style={{ backgroundColor: s.cfg.bg }} />
                <b className="font-bold text-slate-700">{s.n}</b> {s.cfg.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini schedule row (Today / Coming Up) ─────────────────────────────────────
// Pass done/onToggleDone to make the row tickable — used on Today so arrivals
// and collections can be checked off as they happen.
function ScheduleRow({ job, label, sublabel, onClick, done, onToggleDone }) {
  const tickable = typeof onToggleDone === 'function'
  return (
    <div className={`flex items-center gap-2 bg-white rounded-xl border border-slate-100 pr-3 py-2.5 transition-opacity ${
      tickable ? 'pl-2' : 'pl-3'} ${done ? 'opacity-55' : ''}`}>
      {tickable && (
        <button
          onClick={onToggleDone}
          aria-pressed={!!done}
          aria-label={done ? `Undo — ${job.customers?.name || 'job'}` : `Mark ${sublabel || 'done'} — ${job.customers?.name || 'job'}`}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            done ? 'bg-green-500 border-green-500' : 'border-slate-300 active:border-slate-400'
          }`}
        >
          {done && (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}
      <button onClick={onClick} className="flex-1 flex items-center gap-3 min-w-0 text-left active:opacity-70">
        {label && (
          <div className="w-11 shrink-0 text-center">
            <p className="text-xs font-bold text-slate-700">{label}</p>
            {sublabel && <p className="text-[10px] text-slate-400">{sublabel}</p>}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold text-slate-800 truncate ${done ? 'line-through' : ''}`}>
            {job.customers?.name || '—'}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {job.units?.map(u => `${u.brand} ${u.model}`).join(' · ')}
          </p>
        </div>
        <span className="text-sm font-bold text-slate-600 shrink-0">£{jobTotal(job).toFixed(0)}</span>
      </button>
    </div>
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

// Month-to-date revenue, by drop-off date — feeds the Month glance tile
function monthRevenue(jobs, today) {
  const thisMonth = format(today, 'yyyy-MM')
  return jobs
    .filter(j => j.drop_off_date?.startsWith(thisMonth))
    .reduce((s, j) => s + jobTotal(j), 0)
}

// ── Stock view ───────────────────────────────────────────────────────────────
function buildStockGroups(jobs) {
  const byBrand = {}
  jobs
    .filter(j => !j.units?.every(u => u.status === 'complete' || u.status === 'on_hold'))
    .forEach(job => {
      (job.units || []).filter(u => u.status !== 'complete' && u.status !== 'on_hold').forEach(u => {
        const brand = u.brand || 'Unknown'
        const model = u.model?.trim() || 'Unknown'
        if (!byBrand[brand]) byBrand[brand] = {}
        if (!byBrand[brand][model]) byBrand[brand][model] = []
        if (!byBrand[brand][model].find(j => j.id === job.id)) byBrand[brand][model].push(job)
      })
    })
  return byBrand
}

// One card, two scopes — these were previously two stacked copies of the same thing
function StockView({ weekJobs, allJobs, scope, onScopeChange, onPillClick }) {
  const byBrand = buildStockGroups(scope === 'week' ? weekJobs : allJobs)
  const brands = Object.entries(byBrand).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Requirements</p>
        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 shrink-0">
          {[['week', 'This week'], ['all', 'All active']].map(([id, label]) => (
            <button key={id} onClick={() => onScopeChange(id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                scope === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {brands.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">
          {scope === 'week' ? 'Nothing booked in this week' : 'No active units'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {brands.map(([brand, models]) => (
            <div key={brand}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{brand}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(models).sort(([, a], [, b]) => b.length - a.length).map(([model, modelJobs]) => (
                  <button key={model}
                    onClick={() => onPillClick(modelJobs, `${brand} ${model}`)}
                    className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 active:bg-slate-100">
                    <span className="text-xs text-slate-700 font-medium">{model}</span>
                    <span className="text-[10px] font-bold text-slate-400">×{modelJobs.length}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ jobs, customers, todos = [], loading, saveJob, deleteJob, archiveJob, restoreJob, setJobArrived, setJobCollected, addTodo, updateTodo, toggleTodo, deleteTodo, settings, refresh, activeTimer, onStartTimer, timerStopKey }) {
  const [editJob, setEditJob] = useState(null)
  const [alertPicker, setAlertPicker] = useState(null) // { jobs, title, color }
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [addTodoDate, setAddTodoDate] = useState(null)
  const [stockScope, setStockScope] = useState('week')
  const [expandedJob, setExpandedJob] = useState(null)
  const [tickError, setTickError] = useState(null)

  // Ticks write optimistically and roll back on failure — surface why, otherwise
  // the checkbox just silently un-ticks itself.
  async function toggleMovement(fn, job, currentValue) {
    if (!fn) return
    setTickError(null)
    try {
      await fn(job.id, !currentValue)
    } catch (e) {
      setTickError(e?.message || 'Could not save that — check your connection.')
    }
  }

  function closeModal() {
    setEditJob(null)
    refresh?.()
  }

  function jumpTo(id) {
    document.getElementById(`dash-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openAlert(alertJobs, title, color) {
    if (alertJobs.length === 1) { setEditJob(alertJobs[0]); return }
    setAlertPicker({ jobs: alertJobs, title, color })
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = format(today, 'yyyy-MM-dd')
  const statusConfig = settings?.statusConfig

  // Jobs physically in the workshop: dropped off on or before today, not all complete.
  // Order comes from sort_order — the sequence you set by dragging on the Jobs screen —
  // so "Up next" is genuinely your next job. Overdue work is surfaced by the alert
  // banner and flagged red in the rows rather than being force-sorted to the top.
  const inWorkshop = jobs.filter(j => {
    if (!j.drop_off_date || j.drop_off_date > todayStr) return false
    if (!j.units?.length) return false
    if (j.units.every(u => u.status === 'complete' || u.status === 'on_hold')) return false
    return true
  })
  const [upNext, ...restOfBench] = inWorkshop

  // Glance metrics
  const benchUnits = inWorkshop.flatMap(j => (j.units || []).filter(u => u.status !== 'complete' && u.status !== 'on_hold'))
  const blockedUnits = benchUnits.filter(u => u.status === 'awaiting_parts').length
  const revThisMonth = monthRevenue(jobs, today)

  // Alert buckets (live, unfiltered)
  const overdueJobs      = inWorkshop.filter(j => isOverdue(j, today))
  const awaitingPartJobs = inWorkshop.filter(j => j.units?.some(u => u.status === 'awaiting_parts'))
  const onHoldJobs       = jobs.filter(j => j.units?.some(u => u.status === 'on_hold') && !j.units.every(u => u.status === 'complete'))

  // Today's schedule — exclude all-on-hold jobs
  const dropOffsToday = jobs.filter(j => j.drop_off_date === todayStr && !allOnHold(j))
  const pickupsToday  = jobs.filter(j => j.pickup_date === todayStr && !allOnHold(j))

  // Todos
  const todayTodos = todos.filter(t => t.due_date === todayStr)

  // Today's checklist progress — arrivals in, collections out
  const todayMovements = dropOffsToday.length + pickupsToday.length
  const todayMovementsDone =
    dropOffsToday.filter(j => j.arrived_at).length +
    pickupsToday.filter(j => j.collected_at).length

  // Coming up — drop-offs AND pickups in next 7 days, exclude all-on-hold
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1))
  const upcoming = next7
    .map(d => {
      const ds = format(d, 'yyyy-MM-dd')
      const dayJobs = jobs.filter(j => !allOnHold(j) && (
        j.drop_off_date === ds ||
        (j.pickup_date === ds && j.units?.every(u => u.status === 'complete'))
      ))
      const dayTodos = todos.filter(t => t.due_date === ds)
      return { date: d, dateStr: ds, jobs: dayJobs, todos: dayTodos }
    })
    .filter(g => g.jobs.length > 0 || g.todos.length > 0)

  const hasAlerts = overdueJobs.length || awaitingPartJobs.length || onHoldJobs.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work State</h1>
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

          {/* Glance tiles + workshop state */}
          <GlanceCard
            benchJobs={inWorkshop.length}
            benchUnits={benchUnits}
            dueToday={pickupsToday.length}
            blocked={blockedUnits}
            monthRev={revThisMonth}
            target={settings?.revenueTarget ?? 3000}
            statusConfig={statusConfig}
            statusOrder={settings?.statusOrder}
            onJump={jumpTo}
          />

          {/* Alerts */}
          {hasAlerts > 0 && (
            <div className="space-y-2">
              <AlertBanner label={`${overdueJobs.length} overdue — past promised pickup date`}
                count={overdueJobs.length} color="#ef4444" bg="#fef2f2"
                onClick={() => openAlert(overdueJobs, 'Overdue jobs', '#ef4444')} />
              <AlertBanner label={`${awaitingPartJobs.length} blocked — waiting on parts`}
                count={awaitingPartJobs.length} color="#f59e0b" bg="#fffbeb"
                onClick={() => openAlert(awaitingPartJobs, 'Waiting on parts', '#f59e0b')} />
              <AlertBanner label={`${onHoldJobs.length} on hold — pending decision`}
                count={onHoldJobs.length} color="#6b7280" bg="#f9fafb"
                onClick={() => openAlert(onHoldJobs, 'On hold', '#6b7280')} />
            </div>
          )}

          {/* In the Workshop — hero + compact rows */}
          <div id="dash-bench">
            {inWorkshop.length === 0 ? (
              <>
                <SectionHeader count={0} color="#0ea5e9">In the Workshop</SectionHeader>
                <EmptyRow text="Nothing on the bench right now" />
              </>
            ) : (
              <div className="space-y-3">
                <UpNextHero
                  job={upNext} today={today} statusConfig={statusConfig}
                  activeTimer={activeTimer} onStartTimer={onStartTimer}
                  onOpen={() => setEditJob(upNext)}
                  benchCount={inWorkshop.length}
                />
                {restOfBench.length > 0 && (
                  <div>
                    <SectionHeader count={restOfBench.length} color="#0ea5e9">Then</SectionHeader>
                    <div className="space-y-1.5">
                      {restOfBench.map(job => (
                        <CompactJobRow key={job.id} job={job} today={today}
                          statusConfig={statusConfig}
                          expanded={expandedJob === job.id}
                          onToggle={() => setExpandedJob(id => id === job.id ? null : job.id)}
                          onOpen={() => setEditJob(job)}
                          activeTimer={activeTimer}
                          onStartTimer={onStartTimer} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Today */}
          {(dropOffsToday.length > 0 || pickupsToday.length > 0 || todayTodos.length > 0 || showAddTodo) && (
            <div id="dash-today">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today</p>
                  {todayMovements > 0 && (
                    <span className={`text-[10px] font-bold ${
                      todayMovementsDone === todayMovements ? 'text-green-600' : 'text-slate-400'
                    }`}>
                      {todayMovementsDone}/{todayMovements} done
                    </span>
                  )}
                </div>
                <button onClick={() => { setAddTodoDate(todayStr); setShowAddTodo(true) }}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 active:text-amber-700">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  To-Do
                </button>
              </div>
              <div className="space-y-1.5">
                {showAddTodo && addTodoDate === todayStr && (
                  <AddTodoForm defaultDate={todayStr} onAdd={addTodo} onClose={() => setShowAddTodo(false)} />
                )}
                {todayTodos.map(t => (
                  <TodoRow key={t.id} todo={t} onToggle={toggleTodo} onEdit={updateTodo} onDelete={deleteTodo} />
                ))}
                {tickError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <p className="flex-1 text-[11px] text-red-700 leading-snug">{tickError}</p>
                    <button onClick={() => setTickError(null)} className="text-red-400 active:text-red-600 shrink-0">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {dropOffsToday.map(job => (
                  <ScheduleRow key={`in-${job.id}`} job={job}
                    label="IN"
                    sublabel={job.arrived_at ? 'arrived' : 'drop-off'}
                    onClick={() => setEditJob(job)}
                    done={!!job.arrived_at}
                    onToggleDone={setJobArrived && (() => toggleMovement(setJobArrived, job, job.arrived_at))} />
                ))}
                {pickupsToday.map(job => (
                  <ScheduleRow key={`out-${job.id}`} job={job}
                    label="OUT"
                    sublabel={job.collected_at ? 'collected' : 'pickup'}
                    onClick={() => setEditJob(job)}
                    done={!!job.collected_at}
                    onToggleDone={setJobCollected && (() => toggleMovement(setJobCollected, job, job.collected_at))} />
                ))}
              </div>
            </div>
          )}
          {/* Today section when it would be empty — still allow adding todos */}
          {(dropOffsToday.length === 0 && pickupsToday.length === 0 && todayTodos.length === 0 && !showAddTodo) && (
            <div className="flex justify-end">
              <button onClick={() => { setAddTodoDate(todayStr); setShowAddTodo(true) }}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-600 active:text-amber-700 py-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add To-Do
              </button>
            </div>
          )}

          {/* Coming Up */}
          {upcoming.length > 0 && (
            <div>
              <SectionHeader>Coming Up</SectionHeader>
              <div className="space-y-1.5">
                {upcoming.flatMap(g => {
                  const dayLabel = isToday(g.date) ? 'Today' : isTomorrow(g.date) ? 'Tmrw' : format(g.date, 'EEE d')
                  const items = []
                  g.todos.forEach(t => items.push(
                    <div key={`todo-${t.id}`} className="flex items-center gap-2">
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-xs font-bold text-amber-500">{dayLabel}</p>
                        <p className="text-[10px] text-amber-400">to-do</p>
                      </div>
                      <div className="flex-1">
                        <TodoRow todo={t} onToggle={toggleTodo} onEdit={updateTodo} onDelete={deleteTodo} />
                      </div>
                    </div>
                  ))
                  g.jobs.forEach(job => {
                    const isPickup = job.pickup_date === g.dateStr && job.units?.every(u => u.status === 'complete')
                    items.push(
                      <ScheduleRow key={job.id} job={job}
                        label={dayLabel}
                        sublabel={isPickup ? 'pickup' : 'drop-off'}
                        onClick={() => setEditJob(job)} />
                    )
                  })
                  return items
                })}
              </div>
            </div>
          )}

          {/* Stock — one card, scope toggle */}
          <StockView
            scope={stockScope}
            onScopeChange={setStockScope}
            weekJobs={jobs.filter(j => {
              if (!j.drop_off_date) return false
              const wo = { weekStartsOn: 1 }
              const ws = format(startOfWeek(today, wo), 'yyyy-MM-dd')
              const we = format(endOfWeek(today, wo), 'yyyy-MM-dd')
              return j.drop_off_date >= ws && j.drop_off_date <= we
            })}
            allJobs={jobs}
            onPillClick={(pillJobs, title) => openAlert(pillJobs, title, '#0ea5e9')}
          />

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
          onSave={saveJob} onDelete={deleteJob} onArchive={archiveJob} onRestore={restoreJob}
          onClose={closeModal}
          settings={settings}
          onStartTimer={onStartTimer}
          activeTimer={activeTimer}
          timerStopKey={timerStopKey} />
      )}
    </div>
  )
}
