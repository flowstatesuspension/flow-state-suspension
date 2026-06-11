import { STATUS_CONFIG } from '../constants'

export default function StatusBadge({ status, small = false }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}
      style={{ backgroundColor: cfg.light, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <span
        className="rounded-full mr-1.5"
        style={{ width: small ? 6 : 7, height: small ? 6 : 7, backgroundColor: cfg.bg, flexShrink: 0 }}
      />
      {cfg.label}
    </span>
  )
}
