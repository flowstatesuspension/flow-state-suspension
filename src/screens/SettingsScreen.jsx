import { useState } from 'react'
import { supabase } from '../lib/supabase'

function exportCSV(filename, rows) {
  const keys = Object.keys(rows[0])
  const lines = [keys.join(','), ...rows.map(r =>
    keys.map(k => {
      const v = r[k] ?? ''
      return String(v).includes(',') || String(v).includes('"') ? `"${String(v).replace(/"/g, '""')}"` : v
    }).join(',')
  )]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">{title}</p>
      <div className="bg-white rounded-2xl divide-y divide-slate-100 mx-4 shadow-sm">
        {children}
      </div>
    </div>
  )
}

function Row({ icon, label, sublabel, onClick, danger, chevron = true, rightEl }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-slate-50 ${danger ? 'text-red-500' : 'text-slate-800'}`}
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50' : 'bg-slate-100'}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-slate-800'}`}>{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      {rightEl}
      {chevron && !rightEl && (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </button>
  )
}

export default function SettingsScreen({ jobs, customers }) {
  const [exporting, setExporting] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

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
    if (rows.length === 0) { setExporting(null); return }
    const date = new Date().toISOString().slice(0, 10)
    exportCSV(`flowstate-jobs-${date}.csv`, rows)
    setTimeout(() => setExporting(null), 1000)
  }

  function exportCustomers() {
    setExporting('customers')
    const rows = customers.map(c => ({
      id: c.id,
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
    }))
    if (rows.length === 0) { setExporting(null); return }
    const date = new Date().toISOString().slice(0, 10)
    exportCSV(`flowstate-customers-${date}.csv`, rows)
    setTimeout(() => setExporting(null), 1000)
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work Flow</h1>
            <p className="text-slate-400 text-xs mt-1">Settings</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-6 max-w-2xl mx-auto w-full">

        <Section title="Data & Backup">
          <Row
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
            label="Export Jobs"
            sublabel={`${jobs.length} jobs · ${jobs.flatMap(j => j.units || []).length} units`}
            onClick={exportJobs}
            rightEl={exporting === 'jobs' ? <span className="text-xs text-green-600 font-medium">Downloading…</span> : null}
          />
          <Row
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
            label="Export Customers"
            sublabel={`${customers.length} customers`}
            onClick={exportCustomers}
            rightEl={exporting === 'customers' ? <span className="text-xs text-green-600 font-medium">Downloading…</span> : null}
          />
        </Section>

        <Section title="Workshop">
          <Row
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" /></svg>}
            label="Service Pricing"
            sublabel="Coming soon — manage default service rates"
            onClick={() => {}}
          />
          <Row
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
            label="Staff & Access"
            sublabel="Coming soon — invite team members"
            onClick={() => {}}
          />
          <Row
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>}
            label="Customer Notifications"
            sublabel="Coming soon — job ready SMS/email alerts"
            onClick={() => {}}
          />
        </Section>

        <Section title="Account">
          <Row
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>}
            label={signingOut ? 'Signing out…' : 'Sign Out'}
            onClick={signOut}
            danger
            chevron={false}
          />
        </Section>

        <p className="text-center text-xs text-slate-300 pb-8">Flow State Suspension · Work Flow</p>
      </div>
    </div>
  )
}
