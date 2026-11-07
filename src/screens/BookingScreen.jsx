import { useState, useEffect } from 'react'
import { format, parseISO, addDays, addMonths, subMonths, startOfMonth } from 'date-fns'
import { supabase } from '../lib/supabase'
import MonthGrid from '../components/MonthGrid'
import { BOOKING_HORIZON_DAYS } from '../lib/booking'
import { DEFAULT_BRANDS, PUBLIC_BRAND_EXCLUDE, WORKSHOP_ADDRESS } from '../constants'

// Public booking form. Served at /book with no login.
//
// Writes only to booking_requests, which anonymous visitors can insert into and
// never read back — so this page cannot be used to find out who is a customer.
// Availability comes from booking_closures — every day is bookable unless it
// appears there. That table exposes dates and nothing else.

// Chosen when the listed models don't cover what someone's bringing in
const OTHER_MODEL = '__other__'

function blankItem() {
  return { brand: '', model: '', serial_number: '', notes: '' }
}

function Field({ label, hint, children, required }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-slate-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 ' +
  'outline-none placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'

export default function BookingScreen() {
  const [closures, setClosures] = useState(null) // null = loading
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [form, setForm] = useState({ name: '', phone: '', email: '', slot_date: '', notes: '', delivery_method: 'dropoff', return_address: '' })
  const [items, setItems] = useState([blankItem()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [copiedAddr, setCopiedAddr] = useState(false)

  const addressText = WORKSHOP_ADDRESS.join('\n')
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  function copyAddress() {
    navigator.clipboard?.writeText(addressText).then(() => {
      setCopiedAddr(true)
      setTimeout(() => setCopiedAddr(false), 2000)
    }).catch(() => {})
  }

  // Lets them fire it straight into their own notes, messages or mail
  function shareAddress() {
    navigator.share({ title: 'Flow State Suspension', text: addressText }).catch(() => {})
  }

  const posting = form.delivery_method === 'post'
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const horizonStr = format(addDays(new Date(), BOOKING_HORIZON_DAYS), 'yyyy-MM-dd')

  const [catalogue, setCatalogue] = useState([])
  const [turnaround, setTurnaround] = useState(null)

  useEffect(() => {
    async function loadTurnaround() {
      const { data } = await supabase
        .from('public_settings').select('value').eq('key', 'turnaround_days').maybeSingle()
      const n = parseInt(data?.value, 10)
      setTurnaround(Number.isFinite(n) && n > 0 ? n : null)
    }
    loadTurnaround()
  }, [])

  useEffect(() => {
    async function loadClosures() {
      const { data, error: err } = await supabase
        .from('booking_closures')
        .select('closed_date')
        .gte('closed_date', todayStr)
      setClosures(err ? [] : (data || []).map(c => c.closed_date))
    }
    async function loadCatalogue() {
      const { data } = await supabase.from('public_unit_catalogue').select('brand, model')
      setCatalogue(data || [])
    }
    loadClosures()
    loadCatalogue()
  }, [todayStr])

  // Brands actually seen in the workshop, plus the standing list, minus
  // anything customers should never pick
  const brands = [...new Set([
    ...catalogue.map(c => c.brand),
    ...DEFAULT_BRANDS,
  ])]
    .filter(b => b && !PUBLIC_BRAND_EXCLUDE.includes(b))
    .sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))

  const modelsFor = brand => [...new Set(
    catalogue.filter(c => c.brand === brand && c.model).map(c => c.model)
  )].sort((a, b) => a.localeCompare(b))

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setItem(i, k, v) { setItems(us => us.map((u, n) => (n === i ? { ...u, [k]: v } : u))) }
  function addItem() { setItems(us => [...us, blankItem()]) }
  function removeItem(i) { setItems(us => us.filter((_, n) => n !== i)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim())  { setError('Please give us your name.'); return }
    if (!form.phone.trim()) { setError('Please give us a phone number so we can reach you.'); return }
    if (!form.slot_date)    { setError(posting ? 'Please choose a date.' : 'Please choose a drop-off day.'); return }
    if (items.every(u => !u.brand.trim())) { setError('Please tell us what you are sending.'); return }
    if (posting && form.return_address.trim().length < 10) {
      setError('Please give us the full address to send it back to.'); return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        slot_date: form.slot_date,
        notes: form.notes.trim() || null,
        delivery_method: form.delivery_method,
        return_address: posting ? form.return_address.trim() : null,
        items: items
          .filter(u => u.brand.trim())
          .map(u => ({
            brand: u.brand.trim(),
            model: u.model.trim(),
            serial_number: u.serial_number.trim(),
            notes: u.notes.trim(),
          })),
      }
      const { error: err } = await supabase.from('booking_requests').insert(payload)
      if (err) throw err
      setDone({ date: form.slot_date, name: form.name.trim(), posting })
    } catch (err) {
      // The slot check lives in a database policy, so a day filling up between
      // page load and submit lands here rather than being silently accepted.
      setError(
        /row-level security|violates/i.test(err?.message || '')
          ? 'That day just filled up. Pick another and try again.'
          : (err?.message || 'Something went wrong. Please try again.')
      )
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-5">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-7 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Thank you, {done.name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {done.posting ? (
              <>
                You're going to <b className="text-slate-900">Send It</b> — landing with me by{' '}
                <b className="text-slate-900">{format(parseISO(done.date), 'EEEE d MMMM')}</b>.
              </>
            ) : (
              <>
                You're dropping it off{' '}
                <b className="text-slate-900">{format(parseISO(done.date), 'EEEE d MMMM')}</b>.
              </>
            )}
          </p>
          {done.posting && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Send it to</p>
              <address className="not-italic text-[15px] leading-relaxed text-slate-900 font-medium">
                {WORKSHOP_ADDRESS.map(line => <span key={line} className="block">{line}</span>)}
              </address>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={copyAddress}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 active:bg-slate-100">
                  {copiedAddr ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      Copy address
                    </>
                  )}
                </button>
                {canShare && (
                  <button type="button" onClick={shareAddress}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 active:bg-slate-100">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                    </svg>
                    Share
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                Pop your name inside the box so I know whose it is.
              </p>
            </div>
          )}

          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            I'll confirm on WhatsApp shortly{done.posting ? ', with this address again' : ''}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-black">
        <div className="max-w-md mx-auto px-5 py-6 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-11 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-[17px] leading-tight tracking-tight">Flow State Suspension Ltd</h1>
            <p className="text-slate-400 text-xs mt-1">Book a Service</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-5 py-6 space-y-6">

        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your details</h2>
          <Field label="Name" required>
            <input className={inputCls} value={form.name} onChange={e => setField('name', e.target.value)}
              autoComplete="name" placeholder="Your full name" />
          </Field>
          <Field label="Phone" required hint="So I can confirm on WhatsApp">
            <input className={inputCls} value={form.phone} onChange={e => setField('phone', e.target.value)}
              type="tel" autoComplete="tel" placeholder="07…" />
          </Field>
          <Field label="Email">
            <input className={inputCls} value={form.email} onChange={e => setField('email', e.target.value)}
              type="email" autoComplete="email" placeholder="Optional" />
          </Field>
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">What are we working on?</h2>
            <button type="button" onClick={addItem} className="text-xs font-bold text-sky-600 active:text-sky-700">
              + Add another
            </button>
          </div>

          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Unit {i + 1}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)}
                    className="text-[11px] font-semibold text-slate-400 active:text-red-500">
                    Remove
                  </button>
                )}
              </div>

              <Field label="Brand" required>
                <select className={inputCls} value={item.brand}
                  onChange={e => { setItem(i, 'brand', e.target.value); setItem(i, 'model', '') }}>
                  <option value="">Choose…</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Model">
                {modelsFor(item.brand).length > 0 ? (
                  <>
                    <select className={inputCls}
                      value={modelsFor(item.brand).includes(item.model) || !item.model ? item.model : OTHER_MODEL}
                      onChange={e => setItem(i, 'model', e.target.value === OTHER_MODEL ? ' ' : e.target.value)}>
                      <option value="">Choose…</option>
                      {modelsFor(item.brand).map(m => <option key={m} value={m}>{m}</option>)}
                      <option value={OTHER_MODEL}>Not listed…</option>
                    </select>
                    {item.model && !modelsFor(item.brand).includes(item.model) && (
                      <input className={`${inputCls} mt-2`} value={item.model.trim()}
                        onChange={e => setItem(i, 'model', e.target.value || ' ')}
                        placeholder="Which model?" autoFocus />
                    )}
                  </>
                ) : (
                  <input className={inputCls} value={item.model}
                    onChange={e => setItem(i, 'model', e.target.value)}
                    placeholder={item.brand ? 'Model' : 'Choose a brand first'} disabled={!item.brand} />
                )}
              </Field>

              <Field label="Serial number"
                hint="Usually found on the back of the fork crown, or on the shock body">
                <input className={inputCls} value={item.serial_number}
                  onChange={e => setItem(i, 'serial_number', e.target.value)} placeholder="Optional" />
              </Field>

              <Field label="What's it doing?" hint="Any symptoms, or the service you want">
                <textarea className={inputCls} rows={2} value={item.notes}
                  onChange={e => setItem(i, 'notes', e.target.value)}
                  placeholder="e.g. losing air, creaking, due a full service" />
              </Field>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drop It or Send It</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['dropoff', 'Drop It', 'Bring it to the workshop'],
              ['post', 'Send It', 'By post or courier'],
            ].map(([id, label, sub]) => {
              const on = form.delivery_method === id
              return (
                <button key={id} type="button" onClick={() => setField('delivery_method', id)}
                  aria-pressed={on}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    on ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20' : 'border-slate-200 bg-white active:bg-slate-50'
                  }`}>
                  <p className={`text-[14px] font-bold ${on ? 'text-sky-700' : 'text-slate-800'}`}>{label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                </button>
              )
            })}
          </div>

          {posting && (
            <Field label="Return address" required
              hint="Where we send it back to when it's done">
              <textarea className={inputCls} rows={4} value={form.return_address}
                onChange={e => setField('return_address', e.target.value)}
                autoComplete="street-address"
                placeholder={'Street\nTown\nPostcode'} />
            </Field>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {posting ? 'What day will it land by?' : 'Drop-off day'}
            </h2>
            {turnaround && (
              <p className="text-[11px] text-slate-500 mt-1">
                Turnaround right now is around{' '}
                <b className="font-semibold text-slate-700">
                  {turnaround === 1 ? '1 day' : `1–${turnaround} days`}
                </b>.
              </p>
            )}
          </div>
          {closures === null ? (
            <p className="text-sm text-slate-400">Loading available days…</p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <MonthGrid
                month={month}
                onPrev={() => setMonth(m => subMonths(m, 1))}
                onNext={() => setMonth(m => addMonths(m, 1))}
                canPrev={format(month, 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
                canNext={format(month, 'yyyy-MM') < format(addDays(new Date(), BOOKING_HORIZON_DAYS), 'yyyy-MM')}
                getDay={dateStr => ({
                  selected: form.slot_date === dateStr,
                  disabled: dateStr < todayStr || dateStr > horizonStr || closures.includes(dateStr),
                })}
                onDayClick={dateStr => setField('slot_date', dateStr)}
                availableTone="green"
              />
              <p className="text-[12px] mt-3 pt-3 border-t border-slate-100 text-slate-600">
                {form.slot_date ? (
                  <>
                    {posting ? 'Landing by ' : 'Dropping off '}
                    <b className="text-slate-900">{format(parseISO(form.slot_date), 'EEEE d MMMM')}</b>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className="w-3 h-3 rounded border border-green-300 bg-green-50 block shrink-0" />
                    {posting
                      ? 'Pick the day it should reach me by'
                      : 'Green days are available — tap one to choose it'}
                  </span>
                )}
              </p>
            </div>
          )}
        </section>

        <section>
          <Field label="Anything else?">
            <textarea className={inputCls} rows={3} value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Riding style, weight, setup preferences — anything useful" />
          </Field>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting}
          className="w-full rounded-xl bg-sky-500 py-3.5 text-[15px] font-bold text-white active:bg-sky-600 disabled:opacity-50 transition-colors">
          {submitting ? 'Sending…' : 'Request booking'}
        </button>

        <div className="pb-6" />
      </form>
    </div>
  )
}
