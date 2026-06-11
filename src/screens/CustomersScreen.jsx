import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import JobModal from '../components/JobModal'

function CustomerDetail({ customer, jobs, customers, onBack, saveJob, deleteJob }) {
  const custJobs = jobs.filter(j => j.customer_id === customer.id)
    .sort((a, b) => new Date(b.drop_off_date) - new Date(a.drop_off_date))
  const [editJob, setEditJob] = useState(null)
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900 safe-top shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <button onClick={onBack} className="text-sky-400 text-sm font-medium flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Customers
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-xl mb-2">
            {customer.name[0].toUpperCase()}
          </div>
          <h2 className="text-white font-bold text-xl">{customer.name}</h2>
          {customer.email && <p className="text-slate-400 text-sm">{customer.email}</p>}
          {customer.phone && <p className="text-slate-400 text-sm">{customer.phone}</p>}
          <p className="text-slate-500 text-xs mt-1">{custJobs.length} job{custJobs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-3">
        {custJobs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No jobs yet</p>
        ) : (
          custJobs.map(job => (
            <button
              key={job.id}
              onClick={() => { setEditJob(job); setShowModal(true) }}
              className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-sky-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  {job.drop_off_date ? format(parseISO(job.drop_off_date), 'd MMM yyyy') : '—'}
                  {job.pickup_date ? ` → ${format(parseISO(job.pickup_date), 'd MMM')}` : ''}
                </span>
                <span className="text-xs text-slate-400">{job.units?.length || 0} unit{job.units?.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {job.units?.map(u => (
                  <StatusBadge key={u.id} status={u.status} small />
                ))}
              </div>
              {job.units?.length > 0 && (
                <p className="text-xs text-slate-600 mt-1">
                  {job.units.map(u => `${u.brand} ${u.model}`).join(' · ')}
                </p>
              )}
              {job.notes && <p className="text-xs text-slate-400 mt-1 truncate">{job.notes}</p>}
            </button>
          ))
        )}
      </div>

      {showModal && (
        <JobModal
          job={editJob}
          customers={customers}
          onSave={saveJob}
          onDelete={deleteJob}
          onClose={() => { setShowModal(false); setEditJob(null) }}
        />
      )}
    </div>
  )
}

export default function CustomersScreen({ customers, jobs, loading, saveJob, deleteJob, deleteCustomer }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showNewJob, setShowNewJob] = useState(false)

  if (selected) {
    return (
      <CustomerDetail
        customer={selected}
        jobs={jobs}
        customers={customers}
        onBack={() => setSelected(null)}
        saveJob={saveJob}
        deleteJob={deleteJob}
      />
    )
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  function jobCount(customerId) {
    return jobs.filter(j => j.customer_id === customerId).length
  }

  function lastJob(customerId) {
    const cj = jobs
      .filter(j => j.customer_id === customerId && j.drop_off_date)
      .sort((a, b) => new Date(b.drop_off_date) - new Date(a.drop_off_date))
    return cj[0] || null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900 safe-top shrink-0">
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white font-bold text-lg">Customers</h1>
            <span className="text-slate-400 text-xs">{customers.length} total</span>
          </div>
          <div className="relative">
            <svg viewBox="0 0 24 24" className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
            />
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
            const count = jobCount(c.id)
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-sky-300 transition-colors flex items-center gap-3"
              >
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
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )
          })
        )}
      </div>

      {showNewJob && (
        <JobModal
          job={null}
          customers={customers}
          onSave={saveJob}
          onDelete={() => {}}
          onClose={() => setShowNewJob(false)}
        />
      )}
    </div>
  )
}
