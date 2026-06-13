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

function SectionHeader({ title }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2 mt-6 first:mt-0">{title}</p>
}

function Card({ children }) {
  return <div className="bg-white rounded-2xl divide-y divide-slate-100 mx-4 shadow-sm overflow-hidden">{children}</div>
}

function FieldRow({ label, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-sm text-slate-600 w-36 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', prefix, suffix, placeholder }) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-2.5 text-slate-400 text-sm pointer-events-none">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
        style={prefix ? { paddingLeft: '1.5rem' } : suffix ? { paddingRight: '2rem' } : {}}
      />
      {suffix && <span className="absolute right-2.5 text-slate-400 text-sm pointer-events-none">{suffix}</span>}
    </div>
  )
}

function SaveBadge({ saved }) {
  return saved ? <span className="text-xs text-green-600 font-medium ml-2">Saved</span> : null
}

// ── Service price list editor ─────────────────────────────────────────────────
function ServicePriceEditor({ servicePrices, brands, onChange }) {
  const [editing, setEditing] = useState(null) // null | 'new' | row id
  const [form, setForm] = useState({ brand: '', service: '', price: '' })

  function openNew() {
    setForm({ brand: brands[0] || '', service: '', price: '' })
    setEditing('new')
  }

  function openEdit(row) {
    setForm({ brand: row.brand, service: row.service, price: String(row.price) })
    setEditing(row.id)
  }

  function cancel() { setEditing(null) }

  function commit() {
    if (!form.service.trim() || !form.price) return
    if (editing === 'new') {
      onChange([...servicePrices, { id: String(Date.now()), ...form, price: parseFloat(form.price) }])
    } else {
      onChange(servicePrices.map(r => r.id === editing ? { ...r, ...form, price: parseFloat(form.price) } : r))
    }
    setEditing(null)
  }

  function remove(id) {
    onChange(servicePrices.filter(r => r.id !== id))
  }

  const grouped = brands.reduce((acc, b) => {
    acc[b] = servicePrices.filter(r => r.brand === b)
    return acc
  }, {})

  return (
    <div>
      {editing && (
        <div className="mx-4 mb-3 bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-sky-700 mb-1">{editing === 'new' ? 'Add Service' : 'Edit Service'}</p>
          <select
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
          >
            {brands.map(b => <option key={b}>{b}</option>)}
          </select>
          <input
            value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
            placeholder="Service name (e.g. 36 Full Service)"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
            <input
              type="number" min="0" step="0.01"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={cancel} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600">Cancel</button>
            <button onClick={commit} className="flex-1 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold">
              {editing === 'new' ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <Card>
        {Object.entries(grouped).map(([brand, rows]) => rows.length > 0 && (
          <div key={brand}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-1">{brand}</p>
            {rows.map(row => (
              <div key={row.id} className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-50">
                <span className="flex-1 text-sm text-slate-700">{row.service}</span>
                <span className="text-sm font-semibold text-slate-900">£{row.price}</span>
                <button onClick={() => openEdit(row)} className="text-sky-500 text-xs font-medium ml-2">Edit</button>
                <button onClick={() => remove(row.id)} className="text-red-400 text-xs font-medium">✕</button>
              </div>
            ))}
          </div>
        ))}
        <button
          onClick={openNew}
          className="w-full px-4 py-3 text-left text-sm text-sky-600 font-semibold flex items-center gap-2"
        >
          <span className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-base leading-none">+</span>
          Add Service
        </button>
      </Card>
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

  function remove(b) {
    onChange(brands.filter(x => x !== b))
  }

  return (
    <Card>
      {brands.map(b => (
        <div key={b} className="flex items-center gap-3 px-4 py-3">
          <span className="flex-1 text-sm text-slate-700">{b}</span>
          <button onClick={() => remove(b)} className="text-red-400 text-xs font-medium">Remove</button>
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
    </Card>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen({ jobs, customers, settings, updateSettings }) {
  const [exporting, setExporting] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [saved, setSaved] = useState({})

  function patch(key, value) {
    updateSettings({ [key]: value })
    setSaved(s => ({ ...s, [key]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 1500)
  }

  function exportJobs() {
    setExporting('jobs')
    const rows = jobs.flatMap(j =>
      (j.units || []).map(u => ({
        job_id: j.id,
        customer: j.customers?.name || '',
        drop_off_date: j.drop_off_date || '',
        pickup_date: j.pickup_date || '',
        notes: j.notes || '',
        brand: u.brand || '',
        model: u.model || '',
        price: u.price ?? '',
        status: u.status || '',
        serial_number: u.serial_number || '',
        parts_notes: u.parts_notes || '',
      }))
    )
    exportCSV(`flowstate-jobs-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    setTimeout(() => setExporting(null), 1000)
  }

  function exportCustomers() {
    setExporting('customers')
    const rows = customers.map(c => ({ id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || '' }))
    exportCSV(`flowstate-customers-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    setTimeout(() => setExporting(null), 1000)
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
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

      <div className="flex-1 overflow-y-auto pb-8 max-w-2xl mx-auto w-full">

        {/* Workshop */}
        <SectionHeader title="Workshop" />
        <Card>
          <FieldRow label="Business Name">
            <TextInput
              value={settings.workshopName}
              onChange={v => patch('workshopName', v)}
              placeholder="Your workshop name"
            />
          </FieldRow>
          <FieldRow label="Revenue Target">
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                prefix="£"
                value={settings.revenueTarget}
                onChange={v => patch('revenueTarget', parseFloat(v) || 0)}
                placeholder="3000"
              />
              <SaveBadge saved={saved.revenueTarget} />
            </div>
          </FieldRow>
          <FieldRow label="Turnaround Days">
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                suffix="days"
                value={settings.turnaroundDays}
                onChange={v => patch('turnaroundDays', parseInt(v) || 1)}
                placeholder="3"
              />
              <SaveBadge saved={saved.turnaroundDays} />
            </div>
          </FieldRow>
        </Card>

        {/* Brands */}
        <SectionHeader title="Brands" />
        <BrandEditor
          brands={settings.brands}
          onChange={v => patch('brands', v)}
        />

        {/* Service Prices */}
        <SectionHeader title="Service Price List" />
        <p className="text-xs text-slate-400 px-4 mb-3">Quick-pick when adding units to a job — autofills brand, service, and price.</p>
        <ServicePriceEditor
          servicePrices={settings.servicePrices}
          brands={settings.brands}
          onChange={v => patch('servicePrices', v)}
        />

        {/* Data */}
        <SectionHeader title="Data & Backup" />
        <Card>
          <button onClick={exportJobs} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <span className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Export Jobs</p>
              <p className="text-xs text-slate-400">{jobs.length} jobs · {jobs.flatMap(j => j.units || []).length} units</p>
            </div>
            {exporting === 'jobs' ? <span className="text-xs text-green-600 font-medium">Downloading…</span> : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            )}
          </button>
          <button onClick={exportCustomers} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Export Customers</p>
              <p className="text-xs text-slate-400">{customers.length} customers</p>
            </div>
            {exporting === 'customers' ? <span className="text-xs text-green-600 font-medium">Downloading…</span> : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            )}
          </button>
        </Card>

        {/* Coming soon */}
        <SectionHeader title="Coming Soon" />
        <Card>
          {[
            ['Service Reminders', 'Notify customers when their job is ready'],
            ['Staff Accounts', 'Invite team members with role-based access'],
            ['Invoicing', 'Generate and send PDF invoices from jobs'],
            ['Parts Ordering', 'Track parts orders and link to jobs'],
          ].map(([label, sub]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5 opacity-50">
              <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </span>
              <div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{sub}</p>
              </div>
            </div>
          ))}
        </Card>

        {/* Account */}
        <SectionHeader title="Account" />
        <Card>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <span className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            </span>
            <p className="text-sm font-medium text-red-500">{signingOut ? 'Signing out…' : 'Sign Out'}</p>
          </button>
        </Card>

        <p className="text-center text-xs text-slate-300 pt-6">Flow State Suspension · Work Flow</p>
      </div>
    </div>
  )
}
