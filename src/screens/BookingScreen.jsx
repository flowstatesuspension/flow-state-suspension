import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'

// Public booking form. Served at /book with no login.
//
// Writes only to booking_requests, which anonymous visitors can insert into and
// never read back — so this page cannot be used to find out who is a customer.
// Availability comes from booking_slots, which exposes dates and remaining
// places and nothing else.

const BRANDS = ['Fox', 'Rockshox', 'Öhlins', 'Marzocchi', 'DVO', 'Cane Creek', 'Manitou', 'Other']

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
  const [slots, setSlots] = useState(null) // null = loading
  const [form, setForm] = useState({ name: '', phone: '', email: '', slot_date: '', notes: '' })
  const [items, setItems] = useState([blankItem()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    async function loadSlots() {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const { data, error: err } = await supabase
        .from('booking_slots')
        .select('slot_date, capacity, booked_count')
        .gte('slot_date', todayStr)
        .order('slot_date')
      if (err) { setSlots([]); return }
      setSlots((data || []).filter(s => s.booked_count < s.capacity))
    }
    loadSlots()
  }, [])

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setItem(i, k, v) { setItems(us => us.map((u, n) => (n === i ? { ...u, [k]: v } : u))) }
  function addItem() { setItems(us => [...us, blankItem()]) }
  function removeItem(i) { setItems(us => us.filter((_, n) => n !== i)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim())  { setError('Please give us your name.'); return }
    if (!form.phone.trim()) { setError('Please give us a phone number so we can reach you.'); return }
    if (!form.slot_date)    { setError('Please choose a drop-off day.'); return }
    if (items.every(u => !u.brand.trim())) { setError('Please tell us what you are bringing in.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        slot_date: form.slot_date,
        notes: form.notes.trim() || null,
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
      setDone({ date: form.slot_date, name: form.name.trim() })
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
          <h1 className="text-xl font-bold text-slate-900">Booking sent</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Thanks {done.name.split(' ')[0]}. You've asked to drop off on{' '}
            <b className="text-slate-900">{format(parseISO(done.date), 'EEEE d MMMM')}</b>.
          </p>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            I'll confirm on WhatsApp shortly. Nothing is booked in until then.
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
            <h1 className="text-white font-bold text-lg leading-none tracking-tight">Book a service</h1>
            <p className="text-slate-400 text-xs mt-1.5">Flow State Suspension</p>
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
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">What's coming in</h2>
            <button type="button" onClick={addItem} className="text-xs font-bold text-sky-600 active:text-sky-700">
              + Add another
            </button>
          </div>

          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Item {i + 1}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)}
                    className="text-[11px] font-semibold text-slate-400 active:text-red-500">
                    Remove
                  </button>
                )}
              </div>

              <Field label="Brand" required>
                <select className={inputCls} value={item.brand} onChange={e => setItem(i, 'brand', e.target.value)}>
                  <option value="">Choose…</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Model" hint="e.g. 36 Factory, Pike Ultimate">
                <input className={inputCls} value={item.model} onChange={e => setItem(i, 'model', e.target.value)}
                  placeholder="If you know it" />
              </Field>

              <Field label="Serial number" hint="Usually on the lower leg or shock body — leave blank if you can't find it">
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
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drop-off day</h2>
          {slots === null ? (
            <p className="text-sm text-slate-400">Loading available days…</p>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800 font-semibold">No days open at the moment</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Drop me a message on WhatsApp and we'll sort something out.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map(s => {
                const selected = form.slot_date === s.slot_date
                const left = s.capacity - s.booked_count
                return (
                  <button key={s.slot_date} type="button" onClick={() => setField('slot_date', s.slot_date)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20' : 'border-slate-200 bg-white active:bg-slate-50'
                    }`}>
                    <p className={`text-[13px] font-bold ${selected ? 'text-sky-700' : 'text-slate-800'}`}>
                      {format(parseISO(s.slot_date), 'EEE d MMM')}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {left} {left === 1 ? 'place' : 'places'} left
                    </p>
                  </button>
                )
              })}
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

        <button type="submit" disabled={submitting || slots?.length === 0}
          className="w-full rounded-xl bg-sky-500 py-3.5 text-[15px] font-bold text-white active:bg-sky-600 disabled:opacity-50 transition-colors">
          {submitting ? 'Sending…' : 'Request booking'}
        </button>

        <p className="text-center text-[11px] text-slate-400 leading-relaxed pb-6">
          This sends a request, not a confirmed booking.<br />I'll come back to you on WhatsApp to confirm.
        </p>
      </form>
    </div>
  )
}
