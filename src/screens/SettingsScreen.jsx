import { useState } from 'react'
import { supabase } from '../lib/supabase'

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

// ── Accordion section ─────────────────────────────────────────────────────────
function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mx-4 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
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
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
        style={prefix ? { paddingLeft: '1.5rem' } : suffix ? { paddingRight: `${suffix.length * 0.6 + 1.5}rem` } : {}}
      />
      {suffix && <span className="absolute right-2.5 text-slate-400 text-sm pointer-events-none">{suffix}</span>}
    </div>
  )
}

// ── Brand list editor ─────────────────────────────────────────────────────────
function BrandEditor({ brands, onChange }) {
  const [newBrand, setNewBrand] = useState('')
  function add() {
    const b = newBrand.trim()
    if (!b || brands.includes(b)) return
    onChange([...brands, b])
    setNewBrand('')
  }
  return (
    <div>
      {brands.map(b => (
        <div key={b} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
          <span className="flex-1 text-sm text-slate-700">{b}</span>
          <button onClick={() => onChange(brands.filter(x => x !== b))} className="text-red-400 text-xs font-medium">Remove</button>
        </div>
      ))}
      <div className="flex gap-2 px-4 py-3">
        <input
          value={newBrand}
          onChange={e => setNewBrand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="New brand…"
          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
        />
        <button onClick={add} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold">Add</button>
      </div>
    </div>
  )
}

// ── Model list editor (per brand) ────────────────────────────────────────────
function ModelEditor({ brands, models, settingsModels, onChange }) {
  const [activeBrand, setActiveBrand] = useState(brands[0] || '')
  const [newModel, setNewModel] = useState('')

  // models = merged (DB + settings), settingsModels = only the user-added ones
  // onChange updates settingsModels only
  const currentModels = models[activeBrand] || []

  function addModel() {
    const m = newModel.trim()
    if (!m || currentModels.includes(m)) return
    const updated = { ...settingsModels, [activeBrand]: [...(settingsModels[activeBrand] || []), m] }
    onChange(updated)
    setNewModel('')
  }

  function removeModel(m) {
    // Remove from settings models; if it only existed in DB we can't truly remove it
    // so we store a "deleted" list per brand
    const updated = {
      ...settingsModels,
      [activeBrand]: (settingsModels[activeBrand] || []).filter(x => x !== m),
      [`_deleted_${activeBrand}`]: [...(settingsModels[`_deleted_${activeBrand}`] || []), m],
    }
    onChange(updated)
  }

  return (
    <div>
      {/* Brand tabs */}
      <div className="flex gap-1 flex-wrap px-4 py-3 border-b border-slate-100">
        {brands.map(b => (
          <button key={b} onClick={() => setActiveBrand(b)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeBrand === b ? 'bg-sky-500 text-white border-sky-500' : 'text-slate-500 border-slate-200'}`}>
            {b}
          </button>
        ))}
      </div>
      {/* Model list */}
      <div className="max-h-48 overflow-y-auto">
        {currentModels.length === 0 && (
          <p className="text-xs text-slate-400 px-4 py-3">No models yet for {activeBrand}</p>
        )}
        {currentModels.map(m => (
          <div key={m} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50">
            <span className="flex-1 text-sm text-slate-700">{m}</span>
            <button onClick={() => removeModel(m)} className="text-red-400 text-xs font-medium">Remove</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-4 py-3">
        <input
          value={newModel}
          onChange={e => setNewModel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addModel()}
          placeholder={`New ${activeBrand} model…`}
          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
        />
        <button onClick={addModel} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold">Add</button>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen({ jobs, customers, settings, updateSettings }) {
  const [exporting, setExporting] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

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

        {/* Workshop */}
        <Accordion defaultOpen title="Workshop" icon={
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.65-5.65 2.496-3.03c.317-.384.74-.626 1.208-.766m0 0a3 3 0 1 1 5.468 2.598c-.317.384-.74.626-1.208.766m-5.268-2.598-.496.375" /></svg>
        }>
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
        </Accordion>

        {/* Brands */}
        <Accordion title="Brands" icon={
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>
        }>
          <BrandEditor brands={settings.brands} onChange={v => patch('brands', v)} />
        </Accordion>

        {/* Models */}
        <Accordion title="Models" icon={
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
        }>
          <p className="text-xs text-slate-400 px-4 pt-3 pb-1">Models are auto-populated from your job history. Add extras or remove unwanted ones per brand.</p>
          <ModelEditor
            brands={settings.brands}
            models={settings.models}
            settingsModels={settings.models}
            onChange={v => patch('models', v)}
          />
        </Accordion>

        {/* Data */}
        <Accordion title="Data & Backup" icon={
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
        }>
          <button onClick={exportJobs} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 border-b border-slate-50">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Export Jobs</p>
              <p className="text-xs text-slate-400">{jobs.length} jobs · {jobs.flatMap(j => j.units || []).length} units</p>
            </div>
            {exporting === 'jobs'
              ? <span className="text-xs text-green-600 font-medium">Downloading…</span>
              : <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            }
          </button>
          <button onClick={exportCustomers} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Export Customers</p>
              <p className="text-xs text-slate-400">{customers.length} customers</p>
            </div>
            {exporting === 'customers'
              ? <span className="text-xs text-green-600 font-medium">Downloading…</span>
              : <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            }
          </button>
        </Accordion>

        {/* Coming soon */}
        <Accordion title="Coming Soon" icon={
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
        }>
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

        {/* Account */}
        <Accordion title="Account" icon={
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
        }>
          <button
            onClick={async () => { await supabase.auth.signOut() }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50"
          >
            <p className="text-sm font-medium text-red-500">Sign Out</p>
          </button>
        </Accordion>

        <p className="text-center text-xs text-slate-300 pt-2">Flow State Suspension · Work Flow</p>
      </div>
    </div>
  )
}
