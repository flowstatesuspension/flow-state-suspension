import { useState, useEffect, useRef } from 'react'
import { format, addDays } from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

const TODAY = format(new Date(), 'yyyy-MM-dd')

function blankUnit() {
  return { id: null, brand: '', model: '', serial_number: '', status: 'booked_in', parts_notes: '', price: '' }
}

function formatPhone(raw) {
  if (!raw) return null
  return raw.replace(/[\s\-().]/g, '')
}

function jobTotal(units) {
  return units.reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

export default function JobModal({ job, customers, onSave, onDelete, onClose, settings }) {
  const isNew = !job?.id
  const nameRef = useRef(null)
  const phoneRef = useRef(null)
  const turnaroundDays = settings?.turnaroundDays ?? 3
  const brands = settings?.brands?.length ? settings.brands : ['Fox', 'Rockshox', 'Postage', 'Other']
  const allModels = settings?.models ?? {}
  const defaultUnitPrice = String(settings?.defaultUnitPrice ?? 120)
  const defaultPickup = format(addDays(new Date(), turnaroundDays), 'yyyy-MM-dd')
  const statusConfig = settings?.statusConfig ?? STATUS_CONFIG
  const statusOrder = settings?.statusOrder ?? STATUS_ORDER

  const [form, setForm] = useState({
    customer_name: job?.customers?.name || '',
    customer_email: job?.customers?.email || '',
    customer_phone: job?.customers?.phone || '',
    drop_off_date: job?.drop_off_date || TODAY,
    pickup_date: job?.pickup_date || defaultPickup,
    notes: job?.notes || '',
  })
  const [units, setUnits] = useState(
    job?.units?.length ? job.units.map(u => ({
      id: u.id,
      brand: u.brand || '',
      model: u.model || '',
      serial_number: u.serial_number || '',
      status: u.status || 'booked_in',
      parts_notes: u.parts_notes || '',
      price: u.price != null ? String(u.price) : '',
    })) : [{ ...blankUnit(), price: defaultUnitPrice }]
  )
  const [nameSuggestions, setNameSuggestions] = useState([])
  const [hasTypedName, setHasTypedName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)
  const [copiedSerial, setCopiedSerial] = useState(null)
  const [noPhoneWarning, setNoPhoneWarning] = useState(false)

  useEffect(() => {
    if (!hasTypedName || !form.customer_name.trim()) { setNameSuggestions([]); return }
    const q = form.customer_name.toLowerCase()
    setNameSuggestions(customers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5))
  }, [form.customer_name, customers, hasTypedName])

  function pickCustomer(c) {
    setForm(f => ({ ...f, customer_name: c.name, customer_email: c.email || '', customer_phone: c.phone || '' }))
    setNameSuggestions([])
    setHasTypedName(false)
  }

  function setField(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val }
      if (key === 'drop_off_date') {
        const newPickup = format(addDays(new Date(val), turnaroundDays), 'yyyy-MM-dd')
        if (f.pickup_date === defaultPickup || f.pickup_date <= val) next.pickup_date = newPickup
      }
      return next
    })
  }

  function setUnitField(idx, key, val) {
    setUnits(us => us.map((u, i) => i === idx ? { ...u, [key]: val } : u))
  }

  function addUnit() { setUnits(us => [...us, { ...blankUnit(), price: defaultUnitPrice }]) }
  function removeUnit(idx) { setUnits(us => us.filter((_, i) => i !== idx)) }

  function handleWhatsApp() {
    const phone = formatPhone(form.customer_phone)
    if (!phone) {
      setNoPhoneWarning(true)
      phoneRef.current?.focus()
      return
    }
    setNoPhoneWarning(false)
    window.open(`https://wa.me/${phone}`, '_blank')
  }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return }
    if (!form.drop_off_date) { setError('Drop-off date is required'); return }
    if (units.some(u => !u.brand.trim())) { setError('Each unit needs a brand'); return }
    setSaving(true); setError(null)
    try {
      await onSave({ ...form, id: job?.id }, units)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(job.id); onClose() }
    catch (e) { setError(e.message); setDeleting(false) }
  }

  const total = jobTotal(units)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-2xl md:rounded-2xl flex flex-col max-h-[92vh] md:max-h-[88vh] w-full md:w-[480px] md:shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 safe-top md:pt-3">
          <button onClick={onClose} className="text-sky-600 font-medium text-sm">Cancel</button>
          <h2 className="font-bold text-slate-900">{isNew ? 'New Job' : 'Edit Job'}</h2>
          <button onClick={handleSave} disabled={saving} className="text-sky-600 font-semibold text-sm disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* Customer */}
          <div className="space-y-2">
            <div className="relative">
              <input
                ref={nameRef}
                value={form.customer_name}
                onChange={e => { setHasTypedName(true); setField('customer_name', e.target.value) }}
                placeholder="Customer name *"
                className="input w-full"
              />
              {nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-10 overflow-hidden">
                  {nameSuggestions.map(c => (
                    <button key={c.id} onClick={() => pickCustomer(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50 flex flex-col">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input value={form.customer_email} onChange={e => setField('customer_email', e.target.value)} placeholder="Email" type="email" className="input w-full" />
            <div className="flex gap-2 items-center">
              <input
                ref={phoneRef}
                value={form.customer_phone}
                onChange={e => { setField('customer_phone', e.target.value); setNoPhoneWarning(false) }}
                placeholder="Phone (e.g. +447700900000)"
                type="tel"
                className={`input flex-1 ${noPhoneWarning ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}
              />
              <button
                type="button"
                onClick={handleWhatsApp}
                title={form.customer_phone ? `WhatsApp ${form.customer_phone}` : 'Add phone number to use WhatsApp'}
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.885a.5.5 0 0 0 .612.612l6.03-1.474A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.2-1.444l-.373-.222-3.868.945.965-3.868-.241-.384A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              </button>
            </div>
            {noPhoneWarning && <p className="text-xs text-amber-600 font-medium">Add a phone number to use WhatsApp</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-400 mb-1 pl-0.5">Drop-off *</p>
              <input type="date" value={form.drop_off_date} onChange={e => setField('drop_off_date', e.target.value)} className="input w-full" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1 pl-0.5">Pickup</p>
              <input type="date" value={form.pickup_date} onChange={e => setField('pickup_date', e.target.value)} className="input w-full" />
            </div>
          </div>

          {/* Notes */}
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Job notes…" rows={2} className="input w-full resize-none" />

          {/* Units */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</span>
              <button onClick={addUnit} className="text-sky-600 text-sm font-semibold">+ Add Unit</button>
            </div>

            <div className="space-y-3">
              {units.map((unit, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Unit {idx + 1}</span>
                    {units.length > 1 && <button onClick={() => removeUnit(idx)} className="text-red-400 text-xs font-medium">Remove</button>}
                  </div>

                  {/* 2×2 grid: Brand | Model / Serial | £Price */}
                  <div className="grid grid-cols-2 gap-2">
                    <select value={unit.brand} onChange={e => { setUnitField(idx, 'brand', e.target.value); setUnitField(idx, 'model', '') }} className="input">
                      <option value="">Brand *</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {allModels[unit.brand]?.length > 0 ? (
                      <select value={unit.model} onChange={e => setUnitField(idx, 'model', e.target.value)} className="input">
                        <option value="">Model</option>
                        {allModels[unit.brand].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input value={unit.model} onChange={e => setUnitField(idx, 'model', e.target.value)} placeholder="Model" className="input" />
                    )}
                    <div className="relative">
                      <input value={unit.serial_number} onChange={e => setUnitField(idx, 'serial_number', e.target.value)} placeholder="Serial" className="input w-full pr-8" />
                      {unit.serial_number && (
                        <button type="button" onClick={() => {
                          navigator.clipboard.writeText(unit.serial_number)
                          setCopiedSerial(idx)
                          setTimeout(() => setCopiedSerial(c => c === idx ? null : c), 1500)
                        }} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded" title="Copy serial">
                          {copiedSerial === idx
                            ? <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                            : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                          }
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">£</span>
                      <input type="number" min="0" step="0.01" value={unit.price} onChange={e => setUnitField(idx, 'price', e.target.value)} placeholder="0" className="input w-full pl-6" />
                    </div>
                  </div>

                  {/* Status — single line, compact pills */}
                  <div className="flex gap-1 flex-nowrap">
                    {statusOrder.map(s => {
                      const cfg = statusConfig[s]
                      const active = unit.status === s
                      return (
                        <button key={s} onClick={() => setUnitField(idx, 'status', s)}
                          className="flex-1 rounded-full px-1 py-1 text-[10px] font-semibold border transition-all text-center leading-tight"
                          style={active ? { backgroundColor: cfg.bg, color: '#fff', borderColor: cfg.bg } : { backgroundColor: '#fff', color: cfg.text, borderColor: cfg.border }}
                        >{cfg.label}</button>
                      )
                    })}
                  </div>

                  <textarea value={unit.parts_notes} onChange={e => setUnitField(idx, 'parts_notes', e.target.value)} placeholder="Parts / notes…" rows={2} className="input w-full resize-none text-xs" />
                </div>
              ))}
            </div>

            {/* Job total */}
            {units.length > 0 && (
              <div className="flex items-center justify-between mt-3 px-3 py-2.5 bg-slate-100 rounded-xl">
                <span className="text-sm font-semibold text-slate-600">Job Total</span>
                <span className="text-lg font-bold text-slate-900">£{total.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Delete */}
          {!isNew && (
            <section className="pt-2 border-t border-slate-100">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="w-full py-2.5 text-red-500 text-sm font-medium rounded-xl border border-red-200 hover:bg-red-50">Delete Job</button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 text-center font-medium">Are you sure? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-slate-600 text-sm font-medium rounded-xl border border-slate-200">Cancel</button>
                    <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 text-white bg-red-500 text-sm font-semibold rounded-xl disabled:opacity-40">
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <style>{`
        .input { display:block; width:100%; border:1px solid #e2e8f0; border-radius:0.5rem; padding:0.5rem 0.625rem; font-size:0.875rem; background:white; color:#0f172a; outline:none; box-sizing:border-box; }
        .input.pl-6 { padding-left:1.5rem; }
        .input.pr-8 { padding-right:2rem; }
        .input:focus { border-color:#38bdf8; box-shadow:0 0 0 2px rgba(56,189,248,0.2); }
        .input::placeholder { color:#94a3b8; }
      `}</style>
    </div>
  )
}
