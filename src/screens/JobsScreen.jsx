import { useState } from 'react'
import GanttWeekView from '../components/GanttWeekView'
import MonthCalendar from '../components/MonthCalendar'
import JobModal from '../components/JobModal'

export default function JobsScreen({ jobs, customers, loading, saveJob, deleteJob }) {
  const [calView, setCalView] = useState('week')
  const [viewMode, setViewMode] = useState('work')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showModal, setShowModal] = useState(false)

  function openNew() { setSelectedJob(null); setShowModal(true) }
  function openJob(job) { setSelectedJob(job); setShowModal(true) }
  function closeModal() { setShowModal(false); setSelectedJob(null) }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top shrink-0" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-lg tracking-tight" style={{ color: '#b5ce3a' }}>Flow State</h1>
            <span className="text-slate-500 text-xs">{jobs.length} jobs</span>
          </div>

          <div className="flex gap-2">
            {/* Week/Month toggle */}
            <div className="flex rounded-lg p-0.5" style={{ backgroundColor: '#1a1a1a' }}>
              {[['week', 'Week'], ['month', 'Month']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCalView(id)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={calView === id ? { backgroundColor: '#b5ce3a', color: '#0a0a0a' } : { color: '#6b7280' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Work/Booking toggle */}
            <div className="flex rounded-lg p-0.5" style={{ backgroundColor: '#1a1a1a' }}>
              {[['work', 'Work'], ['booking', 'Booking']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={viewMode === id ? { backgroundColor: '#b5ce3a', color: '#0a0a0a' } : { color: '#6b7280' }}
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
            <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: '#b5ce3a', borderTopColor: 'transparent' }} />
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
        className="fixed right-5 bottom-24 flex items-center justify-center rounded-full shadow-lg z-30 transition-opacity hover:opacity-90"
        style={{ width: 52, height: 52, backgroundColor: '#b5ce3a' }}
        aria-label="Add job"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#0a0a0a" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

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
