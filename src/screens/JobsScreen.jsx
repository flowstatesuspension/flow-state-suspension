import { useState } from 'react'
import GanttWeekView from '../components/GanttWeekView'
import MonthCalendar from '../components/MonthCalendar'
import JobModal from '../components/JobModal'
import StatusBadge from '../components/StatusBadge'

export default function JobsScreen({ jobs, customers, loading, saveJob, deleteJob }) {
  const [calView, setCalView] = useState('week')   // 'week' | 'month'
  const [viewMode, setViewMode] = useState('work') // 'work' | 'booking'
  const [selectedJob, setSelectedJob] = useState(null)
  const [showModal, setShowModal] = useState(false)

  function openNew() { setSelectedJob(null); setShowModal(true) }
  function openJob(job) { setSelectedJob(job); setShowModal(true) }
  function closeModal() { setShowModal(false); setSelectedJob(null) }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-900 safe-top shrink-0">
        <div className="px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white font-bold text-lg tracking-tight">Flow State</h1>
            <span className="text-slate-400 text-xs">{jobs.length} jobs</span>
          </div>

          {/* View toggles */}
          <div className="flex gap-2 pb-3">
            {/* Cal/Gantt toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5">
              {[['week', 'Week'], ['month', 'Month']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCalView(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    calView === id ? 'bg-white text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Work/Booking sub-toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5">
              {[['work', 'Work'], ['booking', 'Booking']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === id ? 'bg-sky-500 text-white' : 'text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full" />
          </div>
        ) : calView === 'week' ? (
          <GanttWeekView jobs={jobs} onJobClick={openJob} viewMode={viewMode} />
        ) : (
          <MonthCalendar jobs={jobs} onJobClick={openJob} viewMode={viewMode} />
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed right-5 bottom-24 w-13 h-13 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-lg flex items-center justify-center z-30 transition-colors"
        style={{ width: 52, height: 52 }}
        aria-label="Add job"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Job modal */}
      {showModal && (
        <JobModal
          job={selectedJob}
          customers={customers}
          onSave={saveJob}
          onDelete={deleteJob}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
