import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ORDER } from '../constants'

function exportCSV(filename, rows) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const lines = [keys.join(','), ...rows.map(r =>
    keys.map(k => {
      const v = String(r[k] ?? '')
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(',')
  )]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Accordion ─────────────────────────────────────────────────────────────────
function Accordion({ title, icon, children }) {
  const key = `accordion_${title}`
  const [open, setOpen] = useState(() => {
    const stored = sessionStorage.getItem(key)
    return stored === null ? false : stored === 'true'
  })
  function toggle() {
    setOpen(o => { sessionStorage.setItem(key, !o); return !o })
  }
  return (
    <div className="mx-4 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-4 text-left">
        <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        <svg viewBox="0 0 24 24" className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

// ── Shared inline-edit row ────────────────────────────────────────────────────
function EditableRow({ value, onSave, onRemove, saving, children }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  async function commit() {
    if (!draft.trim() || draft.trim() === value) { setEditing(false); return }
    await onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 bg-sky-50">
        {children ? (
          <div className="flex-1">{children(draft, setDraft)}</div>
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 border border-sky-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        )}
        <button onClick={commit} disabled={saving} className="text-sky-600 text-xs font-semibold px-2 py-1 rounded-lg bg-sky-100 disabled:opacity-40">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={() => { setDraft(value); setEditing(false) }} className="text-slate-400 text-xs font-medium">Cancel</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="flex-1 text-sm text-slate-700">{value}</span>
      <button onClick={() => { setDraft(value); setEditing(true) }} className="text-sky-500 text-xs font-medium">Edit</button>
      {onRemove && <button onClick={onRemove} className="text-red-400 text-xs font-medium">Remove</button>}
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 w-40 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function InlineInput({ value, onChange, type = 'text', prefix, suffix, placeholder }) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-2.5 text-slate-400 text-sm pointer-events-none">{prefix}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
        style={prefix ? { paddingLeft: '1.5rem' } : {}} />
      {suffix && <span className="absolute right-2.5 text-slate-400 text-sm pointer-events-none">{suffix}</span>}
    </div>
  )
}

// ── Brand editor ──────────────────────────────────────────────────────────────
function BrandEditor({ brands, onChange }) {
  const [newBrand, setNewBrand] = useState('')
  const [saving, setSaving] = useState(null)

  async function renameBrand(oldVal, newVal) {
    setSaving(oldVal)
    await supabase.from('units').update({ brand: newVal }).eq('brand', oldVal)
    onChange(brands.map(b => b === oldVal ? newVal : b))
    setSaving(null)
  }

  function add() {
    const b = newBrand.trim()
    if (!b || brands.includes(b)) return
    onChange([...brands, b])
    setNewBrand('')
  }

  return (
    <div>
      {brands.map(b => (
        <EditableRow key={b} value={b} saving={saving === b}
          onSave={v => renameBrand(b, v)}
          onRemove={() => onChange(brands.filter(x => x !== b))}
        />
      ))}
      <div className="flex gap-2 px-4 py-3">
        <input value={newBrand} onChange={e => setNewBrand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="New brand…"
          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
        <button onClick={add} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold">Add</button>
      </div>
    </div>
  )
}

// ── Model editor ──────────────────────────────────────────────────────────────
function ModelEditor({ brands, models, settingsModels, onChange }) {
  const [activeBrand, setActiveBrand] = useState(brands[0] || '')
  const [newModel, setNewModel] = useState('')
  const [saving, setSaving] = useState(null)

  const currentModels = models[activeBrand] || []

  async function renameModel(oldVal, newVal) {
    setSaving(oldVal)
    await supabase.from('units').update({ model: newVal }).eq('brand', activeBrand).eq('model', oldVal)
    const updated = {
      ...settingsModels,
      [activeBrand]: (settingsModels[activeBrand] || []).map(m => m === oldVal ? newVal : m),
      // also rename in deleted list if present
      [`_deleted_${activeBrand}`]: (settingsModels[`_deleted_${activeBrand}`] || []).filter(m => m !== oldVal),
    }
    onChange(updated)
    setSaving(null)
  }

  function addModel() {
    const m = newModel.trim()
    if (!m || currentModels.includes(m)) return
    onChange({ ...settingsModels, [activeBrand]: [...(settingsModels[activeBrand] || []), m] })
    setNewModel('')
  }

  function removeModel(m) {
    onChange({
      ...settingsModels,
      [activeBrand]: (settingsModels[activeBrand] || []).filter(x => x !== m),
      [`_deleted_${activeBrand}`]: [...(settingsModels[`_deleted_${activeBrand}`] || []), m],
    })
  }

  return (
    <div>
      <div className="flex gap-1 flex-wrap px-4 py-3 border-b border-slate-100">
        {brands.map(b => (
          <button key={b} onClick={() => setActiveBrand(b)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeBrand === b ? 'bg-sky-500 text-white border-sky-500' : 'text-slate-500 border-slate-200'}`}>
            {b}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 px-4 pt-2 pb-1">Auto-populated from job history. Rename or remove below.</p>
      <div className="max-h-56 overflow-y-auto">
        {currentModels.length === 0 && (
          <p className="text-xs text-slate-400 px-4 py-3">No models for {activeBrand}</p>
        )}
        {currentModels.map(m => (
          <EditableRow key={m} value={m} saving={saving === m}
            onSave={v => renameModel(m, v)}
            onRemove={() => removeModel(m)}
          />
        ))}
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-slate-100">
        <input value={newModel} onChange={e => setNewModel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addModel()}
          placeholder={`New ${activeBrand} model…`}
          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
        <button onClick={addModel} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold">Add</button>
      </div>
    </div>
  )
}

// ── Status editor ────────────────────────────────────────────────────────────
function StatusEditor({ statusConfig, statusLabels, onChange }) {
  const [saving, setSaving] = useState(null)

  async function renameStatus(key, newLabel) {
    setSaving(key)
    onChange({ ...statusLabels, [key]: newLabel })
    setSaving(null)
  }

  return (
    <div>
      {STATUS_ORDER.map(key => {
        const cfg = statusConfig[key]
        return (
          <EditableRow key={key} value={cfg.label} saving={saving === key}
            onSave={v => renameStatus(key, v)}
          >
            {(draft, setDraft) => (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.bg }} />
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') {} }}
                  className="flex-1 border border-sky-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
            )}
          </EditableRow>
        )
      })}
      <p className="text-xs text-slate-400 px-4 py-3">Colour coding is fixed. Only the label is editable.</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsScreen({ jobs, customers, settings, updateSettings }) {
  const [exporting, setExporting] = useState(null)

  function patch(key, value) { updateSettings({ [key]: value }) }

  function exportJobs() {
    setExporting('jobs')
    exportCSV(`flowstate-jobs-${new Date().toISOString().slice(0, 10)}.csv`,
      jobs.flatMap(j => (j.units || []).map(u => ({
        job_id: j.id, customer: j.customers?.name || '',
        drop_off_date: j.drop_off_date || '', pickup_date: j.pickup_date || '',
        notes: j.notes || '', brand: u.brand || '', model: u.model || '',
        price: u.price ?? '', status: u.status || '',
        serial_number: u.serial_number || '', parts_notes: u.parts_notes || '',
      })))
    )
    setTimeout(() => setExporting(null), 1000)
  }

  function exportCustomers() {
    setExporting('customers')
    exportCSV(`flowstate-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      customers.map(c => ({ id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || '' }))
    )
    setTimeout(() => setExporting(null), 1000)
  }

  const iconWorkshop = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.65-5.65 2.496-3.03c.317-.384.74-.626 1.208-.766m0 0a3 3 0 1 1 5.468 2.598c-.317.384-.74.626-1.208.766m-5.268-2.598-.496.375" /></svg>
  const iconTag = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>
  const iconList = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
  const iconStatus = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
  const iconDb = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
  const iconClock = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
  const iconUser = <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work Flow</h1>
            <p className="text-slate-400 text-xs mt-1">Settings</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 pb-8 max-w-2xl mx-auto w-full">

        <Accordion title="Workshop" icon={iconWorkshop}>
          <FieldRow label="Business Name">
            <InlineInput value={settings.workshopName} onChange={v => patch('workshopName', v)} placeholder="Your workshop name" />
          </FieldRow>
          <FieldRow label="Revenue Target">
            <InlineInput type="number" prefix="£" value={settings.revenueTarget} onChange={v => patch('revenueTarget', parseFloat(v) || 0)} placeholder="3000" />
          </FieldRow>
          <FieldRow label="Default Turnaround">
            <InlineInput type="number" suffix="days" value={settings.turnaroundDays} onChange={v => patch('turnaroundDays', parseInt(v) || 1)} placeholder="3" />
          </FieldRow>
          <FieldRow label="Default Unit Price">
            <InlineInput type="number" prefix="£" value={settings.defaultUnitPrice} onChange={v => patch('defaultUnitPrice', parseFloat(v) || 0)} placeholder="120" />
          </FieldRow>
          <FieldRow label="Weekly Capacity">
            <InlineInput type="number" suffix="units/wk" value={settings.weeklyCapacity} onChange={v => patch('weeklyCapacity', parseInt(v) || 1)} placeholder="8" />
          </FieldRow>
        </Accordion>

        <Accordion title="Statuses" icon={iconStatus}>
          <StatusEditor
            statusConfig={settings.statusConfig}
            statusLabels={settings.statusLabels}
            onChange={v => patch('statusLabels', v)}
          />
        </Accordion>

        <Accordion title="Brands" icon={iconTag}>
          <BrandEditor brands={settings.brands} onChange={v => patch('brands', v)} />
        </Accordion>

        <Accordion title="Models" icon={iconList}>
          <ModelEditor
            brands={settings.brands}
            models={settings.models}
            settingsModels={settings.models}
            onChange={v => patch('models', v)}
          />
        </Accordion>

        <Accordion title="Data & Backup" icon={iconDb}>
          <button onClick={exportJobs} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 border-b border-slate-50">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Export Jobs</p>
              <p className="text-xs text-slate-400">{jobs.length} jobs · {jobs.flatMap(j => j.units || []).length} units</p>
            </div>
            {exporting === 'jobs' ? <span className="text-xs text-green-600 font-medium">Downloading…</span>
              : <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
          </button>
          <button onClick={exportCustomers} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Export Customers</p>
              <p className="text-xs text-slate-400">{customers.length} customers</p>
            </div>
            {exporting === 'customers' ? <span className="text-xs text-green-600 font-medium">Downloading…</span>
              : <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
          </button>
        </Accordion>

        <Accordion title="Coming Soon" icon={iconClock}>
          {[
            ['Service Reminders', 'Notify customers when their job is ready'],
            ['Staff Accounts', 'Invite team members with role-based access'],
            ['Invoicing', 'Generate and send PDF invoices from jobs'],
            ['Parts Ordering', 'Track parts orders and link to jobs'],
          ].map(([label, sub]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 opacity-50">
              <div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{sub}</p>
              </div>
            </div>
          ))}
        </Accordion>

        <Accordion title="Account" icon={iconUser}>
          <button onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center px-4 py-3.5 text-left active:bg-slate-50">
            <p className="text-sm font-medium text-red-500">Sign Out</p>
          </button>
        </Accordion>

        <p className="text-center text-xs text-slate-300 pt-2">Flow State Suspension · Work Flow</p>
      </div>
    </div>
  )
}
