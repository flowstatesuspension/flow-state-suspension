import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import JobModal from '../components/JobModal'

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

function CustomerEditModal({ customer, onSave, onClose }) {
  const [form, setForm] = useState({ name: customer.name, email: customer.email || '', phone: customer.phone || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl flex flex-col w-full md:w-[420px] md:shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 safe-top md:pt-3">
          <button onClick={onClose} className="text-sky-600 font-medium text-sm">Cancel</button>
          <h2 className="font-bold text-slate-900">Edit Customer</h2>
          <button onClick={handleSave} disabled={saving} className="text-sky-600 font-semibold text-sm disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *" className="input w-full" />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="input w-full" />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" type="tel" className="input w-full" />
        </div>
      </div>
      <style>{`.input{display:block;width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.625rem;font-size:0.875rem;background:white;color:#0f172a;outline:none;}.input:focus{border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,0.2);}.input::placeholder{color:#94a3b8;}`}</style>
    </div>
  )
}

function CustomerDetail({ customer, jobs, customers, onBack, saveJob, deleteJob, updateCustomer, deleteCustomer }) {
  const custJobs = jobs.filter(j => j.customer_id === customer.id)
    .sort((a, b) => new Date(b.drop_off_date) - new Date(a.drop_off_date))
  const [editJob, setEditJob] = useState(null)
  const [showJobModal, setShowJobModal] = useState(false)
  const [showEditCustomer, setShowEditCustomer] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const lifetimeSpend = custJobs.reduce((sum, j) => sum + jobTotal(j), 0)

  async function handleDeleteCustomer() {
    setDeleting(true)
    try { await deleteCustomer(customer.id); onBack() }
    catch (e) { setDeleting(false) }
  }

  function handleWhatsApp() {
    if (!customer.phone) return
    const phone = customer.phone.replace(/[\s\-().]/g, '')
    window.open(`https://wa.me/${phone}`, '_blank')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900 safe-top shrink-0">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <button onClick={onBack} className="text-sky-400 text-sm font-medium flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Customers
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowEditCustomer(true)} className="text-sky-400 text-sm font-medium">Edit</button>
            {!confirmDelete
              ? <button onClick={() => setConfirmDelete(true)} className="text-red-400 text-sm font-medium">Delete</button>
              : <div className="flex gap-2 items-center">
                  <span className="text-xs text-red-300">Sure?</span>
                  <button onClick={() => setConfirmDelete(false)} className="text-slate-400 text-xs">No</button>
                  <button onClick={handleDeleteCustomer} disabled={deleting} className="text-red-400 text-xs font-semibold">{deleting ? '…' : 'Yes'}</button>
                </div>
            }
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {customer.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-xl truncate">{customer.name}</h2>
              {customer.email && <p className="text-slate-400 text-sm truncate">{customer.email}</p>}
            </div>
            {customer.phone && (
              <button onClick={handleWhatsApp} className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#25D366' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.885a.5.5 0 0 0 .612.612l6.03-1.474A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.2-1.444l-.373-.222-3.868.945.965-3.868-.241-.384A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              </button>
            )}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="text-center">
              <p className="text-white font-bold text-lg">{custJobs.length}</p>
              <p className="text-slate-400 text-xs">Jobs</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">£{lifetimeSpend.toFixed(0)}</p>
              <p className="text-slate-400 text-xs">Lifetime spend</p>
            </div>
            {custJobs.length > 0 && (
              <div className="text-center">
                <p className="text-white font-bold text-lg">£{(lifetimeSpend / custJobs.length).toFixed(0)}</p>
                <p className="text-slate-400 text-xs">Avg per job</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-3">
        {custJobs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No jobs yet</p>
        ) : (
          custJobs.map(job => (
            <button key={job.id} onClick={() => { setEditJob(job); setShowJobModal(true) }}
              className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-sky-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  {job.drop_off_date ? format(parseISO(job.drop_off_date), 'd MMM yyyy') : '—'}
                  {job.pickup_date ? ` → ${format(parseISO(job.pickup_date), 'd MMM')}` : ''}
                </span>
                <span className="text-sm font-bold text-slate-800">£{jobTotal(job).toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {job.units?.map(u => <StatusBadge key={u.id} status={u.status} small />)}
              </div>
              {job.units?.length > 0 && (
                <p className="text-xs text-slate-600">{job.units.map(u => `${u.brand} ${u.model}`).join(' · ')}</p>
              )}
              {job.notes && <p className="text-xs text-slate-400 mt-1 truncate">{job.notes}</p>}
            </button>
          ))
        )}
      </div>

      {showJobModal && (
        <JobModal job={editJob} customers={customers} onSave={saveJob} onDelete={deleteJob} onClose={() => { setShowJobModal(false); setEditJob(null) }} />
      )}
      {showEditCustomer && (
        <CustomerEditModal customer={customer} onSave={data => updateCustomer(customer.id, data)} onClose={() => setShowEditCustomer(false)} />
      )}
    </div>
  )
}

export default function CustomersScreen({ customers, jobs, loading, saveJob, deleteJob, deleteCustomer, updateCustomer }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  if (selected) {
    return (
      <CustomerDetail
        customer={selected}
        jobs={jobs}
        customers={customers}
        onBack={() => setSelected(null)}
        saveJob={saveJob}
        deleteJob={deleteJob}
        updateCustomer={updateCustomer}
        deleteCustomer={deleteCustomer}
      />
    )
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  function custJobs(id) { return jobs.filter(j => j.customer_id === id) }
  function lifetimeSpend(id) { return custJobs(id).reduce((s, j) => s + jobTotal(j), 0) }
  function lastJob(id) {
    return custJobs(id).filter(j => j.drop_off_date).sort((a, b) => new Date(b.drop_off_date) - new Date(a.drop_off_date))[0] || null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900 safe-top shrink-0">
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white font-bold text-lg">Flow State Suspension : Workflow</h1>
            <span className="text-slate-400 text-xs">{customers.length} customers</span>
          </div>
          <div className="relative">
            <svg viewBox="0 0 24 24" className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
              className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">
            {search ? 'No customers match your search' : 'No customers yet — add a job to get started'}
          </p>
        ) : (
          filtered.map(c => {
            const lj = lastJob(c.id)
            const count = custJobs(c.id).length
            const spend = lifetimeSpend(c.id)
            return (
              <button key={c.id} onClick={() => setSelected(c)}
                className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-sky-300 transition-colors flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-base shrink-0">
                  {c.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {count} job{count !== 1 ? 's' : ''}
                    {lj ? ` · last ${format(parseISO(lj.drop_off_date), 'd MMM yyyy')}` : ''}
                  </p>
                </div>
                {spend > 0 && <span className="text-sm font-bold text-slate-700 shrink-0">£{spend.toFixed(0)}</span>}
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
