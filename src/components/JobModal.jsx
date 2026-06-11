import { useState, useEffect, useRef, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'
import StatusBadge from './StatusBadge'

const TODAY = format(new Date(), 'yyyy-MM-dd')
const DEFAULT_PICKUP = format(addDays(new Date(), 3), 'yyyy-MM-dd')

function blankUnit() {
  return { id: null, brand: '', model: '', serial_number: '', status: 'booked_in', parts_notes: '' }
}

export default function JobModal({ job, customers, onSave, onDelete, onClose }) {
  const isNew = !job?.id
  const nameRef = useRef(null)

  const [form, setForm] = useState({
    customer_name: job?.customers?.name || '',
    customer_email: job?.customers?.email || '',
    customer_phone: job?.customers?.phone || '',
    drop_off_date: job?.drop_off_date || TODAY,
    pickup_date: job?.pickup_date || DEFAULT_PICKUP,
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
    })) : [blankUnit()]
  )
  const [nameSuggestions, setNameSuggestions] = useState([])
  const [copiedSerial, setCopiedSerial] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!form.customer_name.trim()) { setNameSuggestions([]); return }
    const q = form.customer_name.toLowerCase()
    const matches = customers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5)
    setNameSuggestions(matches)
  }, [form.customer_name, customers])

  function pickCustomer(c) {
    setForm(f => ({ ...f, customer_name: c.name, customer_email: c.email || '', customer_phone: c.phone || '' }))
    setNameSuggestions([])
  }

  function setField(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val }
      if (key === 'drop_off_date') {
        const newPickup = format(addDays(new Date(val), 3), 'yyyy-MM-dd')
        if (f.pickup_date === DEFAULT_PICKUP || f.pickup_date <= val) next.pickup_date = newPickup
      }
      return next
    })
  }

  function setUnitField(idx, key, val) {
    setUnits(us => us.map((u, i) => i === idx ? { ...u, [key]: val } : u))
  }

  function addUnit() { setUnits(us => [...us, blankUnit()]) }
  function removeUnit(idx) { setUnits(us => us.filter((_, i) => i !== idx)) }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return }
    if (!form.drop_off_date) { setError('Drop-off date is required'); return }
    if (units.some(u => !u.brand.trim())) { setError('Each unit needs a brand'); return }
    setSaving(true)
    setError(null)
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
    try {
      await onDelete(job.id)
      onClose()
    } catch (e) {
      setError(e.message)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <button onClick={onClose} className="text-sky-600 font-medium text-sm">Cancel</button>
          <h2 className="font-bold text-slate-900">{isNew ? 'New Job' : 'Edit Job'}</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sky-600 font-semibold text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Customer */}
          <section>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Customer</label>
            <div className="relative">
              <input
                ref={nameRef}
                value={form.customer_name}
                onChange={e => setField('customer_name', e.target.value)}
                placeholder="Customer name *"
                className="input w-full"
              />
              {nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-10 overflow-hidden">
                  {nameSuggestions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50 flex flex-col"
                    >
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={form.customer_email}
              onChange={e => setField('customer_email', e.target.value)}
              placeholder="Email"
              type="email"
              className="input w-full mt-2"
            />
            <input
              value={form.customer_phone}
              onChange={e => setField('customer_phone', e.target.value)}
              placeholder="Phone"
              type="tel"
              className="input w-full mt-2"
            />
          </section>

          {/* Dates */}
          <section>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dates</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Drop-off *</label>
                <input type="date" value={form.drop_off_date} onChange={e => setField('drop_off_date', e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Pickup</label>
                <input type="date" value={form.pickup_date} onChange={e => setField('pickup_date', e.target.value)} className="input w-full" />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Job Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Any notes about this job…"
              rows={2}
              className="input w-full resize-none"
            />
          </section>

          {/* Units */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</label>
              <button onClick={addUnit} className="text-sky-600 text-sm font-semibold">+ Add Unit</button>
            </div>

            <div className="space-y-4">
              {units.map((unit, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Unit {idx + 1}</span>
                    {units.length > 1 && (
                      <button onClick={() => removeUnit(idx)} className="text-red-400 text-xs font-medium">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={unit.brand} onChange={e => setUnitField(idx, 'brand', e.target.value)} placeholder="Brand *" className="input" />
                    <input value={unit.model} onChange={e => setUnitField(idx, 'model', e.target.value)} placeholder="Model" className="input" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input value={unit.serial_number} onChange={e => setUnitField(idx, 'serial_number', e.target.value)} placeholder="Serial number" className="input flex-1" />
                    {unit.serial_number && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(unit.serial_number)
                          setCopiedSerial(idx)
                          setTimeout(() => setCopiedSerial(c => c === idx ? null : c), 1500)
                        }}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        title="Copy serial number"
                      >
                        {copiedSerial === idx ? (
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Status selector */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Status</label>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_ORDER.map(s => {
                        const cfg = STATUS_CONFIG[s]
                        const active = unit.status === s
                        return (
                          <button
                            key={s}
                            onClick={() => setUnitField(idx, 'status', s)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold border transition-all"
                            style={active ? {
                              backgroundColor: cfg.bg,
                              color: '#fff',
                              borderColor: cfg.bg,
                            } : {
                              backgroundColor: '#fff',
                              color: cfg.text,
                              borderColor: cfg.border,
                            }}
                          >
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <textarea
                    value={unit.parts_notes}
                    onChange={e => setUnitField(idx, 'parts_notes', e.target.value)}
                    placeholder="Parts / notes for this unit…"
                    rows={2}
                    className="input w-full resize-none text-xs"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Delete */}
          {!isNew && (
            <section className="pt-2 border-t border-slate-100">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="w-full py-2.5 text-red-500 text-sm font-medium rounded-xl border border-red-200 hover:bg-red-50">
                  Delete Job
                </button>
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
        .input {
          display: block;
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.625rem;
          font-size: 0.875rem;
          background: white;
          color: #0f172a;
          outline: none;
        }
        .input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 2px rgba(56,189,248,0.2);
        }
        .input::placeholder { color: #94a3b8; }
      `}</style>
    </div>
  )
}
