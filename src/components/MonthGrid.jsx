import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday } from 'date-fns'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * A month calendar shared by the availability editor and the public date picker.
 *
 * getDay(dateStr, date) returns how a day should look and behave:
 *   { closed, selected, disabled, count }
 * The caller owns the meaning; this component only draws it.
 *
 * onWeekdayClick(index) is optional — the availability editor uses it to shut a
 * whole column, which is how you kill every Saturday without 5 taps.
 */
export default function MonthGrid({ month, onPrev, onNext, getDay, onDayClick, onWeekdayClick, canPrev = true, canNext = true }) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd   = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} disabled={!canPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 active:bg-slate-100 disabled:opacity-25"
          aria-label="Previous month">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="text-sm font-bold text-slate-800">{format(month, 'MMMM yyyy')}</p>
        <button onClick={onNext} disabled={!canNext}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 active:bg-slate-100 disabled:opacity-25"
          aria-label="Next month">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          onWeekdayClick ? (
            <button key={w} onClick={() => onWeekdayClick(i)}
              className="text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1 rounded active:bg-slate-100 active:text-slate-600"
              title={`Toggle every ${w} this month`}>
              {w}
            </button>
          ) : (
            <div key={w} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1 text-center">{w}</div>
          )
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const inMonth = isSameMonth(d, month)
          const { closed, selected, disabled, count } = getDay(dateStr, d) || {}
          const isOff = disabled || !inMonth

          let cls = 'bg-white border-slate-200 text-slate-700'
          if (isOff)         cls = 'bg-transparent border-transparent text-slate-300'
          else if (selected) cls = 'bg-sky-500 border-sky-500 text-white font-bold'
          else if (closed)   cls = 'bg-slate-100 border-slate-200 text-slate-300 line-through'

          return (
            <button
              key={dateStr}
              onClick={() => !isOff && onDayClick?.(dateStr, d)}
              disabled={isOff}
              aria-pressed={selected ? true : undefined}
              aria-label={`${format(d, 'EEEE d MMMM')}${closed ? ' — closed' : ''}`}
              className={`relative aspect-square rounded-lg border text-[13px] flex items-center justify-center transition-colors ${cls} ${
                isOff ? 'cursor-default' : 'active:brightness-95'
              }`}
            >
              <span className={isToday(d) && !selected && !isOff ? 'underline underline-offset-2 decoration-2 decoration-sky-400' : ''}>
                {format(d, 'd')}
              </span>
              {count > 0 && !isOff && (
                <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  selected ? 'bg-white text-sky-600' : 'bg-amber-400 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
