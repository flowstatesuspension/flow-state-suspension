import { useState, useRef, useLayoutEffect } from 'react'
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  eachDayOfInterval, format, parseISO,
  differenceInDays, max, min, isToday,
} from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

const ROW_PAD = 8
const UNIT_H = 26
const UNIT_GAP = 3
const MIN_COL_W = 80

function rowHeight(job) {
  const n = job.units?.length || 1
  return ROW_PAD * 2 + n * UNIT_H + (n - 1) * UNIT_GAP
}

function firstNames(name) {
  return name ? name.split(' ')[0] : '—'
}

function copyToClipboard(text, e) {
  e.stopPropagation()
  navigator.clipboard.writeText(text).catch(() => {})
}

export default function GanttWeekView({ jobs, onJobClick, viewMode }) {
  const [anchor, setAnchor] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [copied, setCopied] = useState(null)
  const containerRef = useRef(null)
  const [colW, setColW] = useState(MIN_COL_W)

  useLayoutEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth
      setColW(Math.max(MIN_COL_W, Math.floor(available / 7)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: anchor, end: weekEnd })
  const chartW = days.length * colW

  const visible = jobs.filter(j => {
    if (!j.drop_off_date) return false
    if (viewMode === 'booking') {
      // Booking view: only show jobs whose drop-off falls in this week
      const d = parseISO(j.drop_off_date)
      return d >= anchor && d <= weekEnd
    }
    // Work view: show jobs whose span overlaps this week
    if (!j.pickup_date) return false
    return parseISO(j.drop_off_date) <= weekEnd && parseISO(j.pickup_date) >= anchor
  })

  const filtered =
    viewMode === 'work'
      ? visible.filter(j => j.units?.some(u => u.status !== 'complete'))
      : visible

  const allUnits = filtered.flatMap(j => j.units || [])
  const totalUnits = allUnits.length

  function barBounds(job) {
    if (viewMode === 'booking') {
      // Single-day bar on drop-off date
      const d = parseISO(job.drop_off_date)
      const left = differenceInDays(d, anchor) * colW + 2
      const width = colW - 4
      return { left, width }
    }
    const s = max([parseISO(job.drop_off_date), anchor])
    const e = min([parseISO(job.pickup_date), weekEnd])
    const left = differenceInDays(s, anchor) * colW + 2
    const width = (differenceInDays(e, s) + 1) * colW - 4
    return { left, width }
  }

  function handleCopy(serial, unitId, e) {
    copyToClipboard(serial, e)
    setCopied(unitId)
    setTimeout(() => setCopied(c => c === unitId ? null : c), 1500)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Week navigator */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <button
          onClick={() => setAnchor(w => subWeeks(w, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-lg"
        >‹</button>
        <div className="text-sm font-semibold text-slate-700">
          {format(anchor, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
        </div>
        <button
          onClick={() => setAnchor(w => addWeeks(w, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-lg"
        >›</button>
      </div>

      {/* Status key */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 shrink-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s]
            const count = allUnits.filter(u => u.status === s).length
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.bg }} />
                <span className="text-[11px] text-slate-600 font-medium">{cfg.label}</span>
                <span className="text-[11px] font-bold text-slate-800">{count}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Total</span>
            <span className="text-[11px] font-bold text-slate-900">{totalUnits}</span>
          </div>
        </div>
      </div>

      {/* Chart — full width, no label column */}
      <div className="flex-1 overflow-auto scrollbar-none" ref={containerRef} style={{ overscrollBehavior: 'none' }}>
        {/* Day headers */}
        <div
          className="sticky top-0 z-10 flex bg-white border-b border-slate-200"
          style={{ height: 40, width: chartW }}
        >
          {days.map(day => (
            <div
              key={day.toISOString()}
              style={{ width: colW }}
              className="border-r border-slate-100 flex flex-col items-center justify-center"
            >
              <span className="text-[10px] text-slate-400 font-medium">{format(day, 'EEE')}</span>
              <span
                className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday(day) ? 'bg-sky-500 text-white' : 'text-slate-700'
                }`}
              >
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* Job rows */}
        <div style={{ width: chartW }}>
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32 text-slate-300 text-sm">
              No jobs this week
            </div>
          )}

          {filtered.map(job => {
            const { left, width } = barBounds(job)
            const h = rowHeight(job)
            const firstName = firstNames(job.customers?.name)
            return (
              <div
                key={job.id}
                className="relative border-b border-slate-100"
                style={{ height: h }}
              >
                {/* Grid lines */}
                {days.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-r border-slate-100"
                    style={{ left: i * colW, width: colW }}
                  />
                ))}

                {/* Unit bars */}
                {(job.units || []).map((unit, idx) => {
                  const cfg = STATUS_CONFIG[unit.status] || STATUS_CONFIG.booked_in
                  const label = `${firstName}: ${unit.brand}${unit.model ? ' ' + unit.model : ''}`
                  const hasCopied = copied === unit.id
                  return (
                    <div
                      key={unit.id}
                      style={{
                        left,
                        width: Math.max(width, 4),
                        top: ROW_PAD + idx * (UNIT_H + UNIT_GAP),
                        height: UNIT_H,
                        backgroundColor: cfg.bg,
                      }}
                      className="absolute rounded flex items-center overflow-hidden group"
                    >
                      {/* Main clickable area */}
                      <button
                        onTouchEnd={e => { e.preventDefault(); onJobClick(job) }}
                        onClick={() => onJobClick(job)}
                        className="flex-1 flex items-center px-2 h-full text-left overflow-hidden"
                      >
                        <span className="text-white text-[11px] font-semibold truncate leading-none">
                          {label}
                        </span>
                      </button>

                      {/* Copy serial button */}
                      {unit.serial_number && (
                        <button
                          onClick={e => handleCopy(unit.serial_number, unit.id, e)}
                          className="shrink-0 w-7 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10"
                          title={`Copy serial: ${unit.serial_number}`}
                        >
                          {hasCopied ? (
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* No units fallback */}
                {(!job.units || job.units.length === 0) && (
                  <button
                    onTouchEnd={e => { e.preventDefault(); onJobClick(job) }}
                    onClick={() => onJobClick(job)}
                    style={{ left, width: Math.max(width, 4), top: ROW_PAD, height: UNIT_H, backgroundColor: '#94a3b8' }}
                    className="absolute rounded flex items-center px-2 overflow-hidden"
                  >
                    <span className="text-white text-[11px] font-semibold">{firstNames(job.customers?.name)}: no units</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
