import { useEffect, useRef } from 'react'
import './LiquidNotif.css'

/**
 * LiquidNotif — premium glassmorphism "Coming Soon" notification panel.
 *
 * Props:
 *   show       boolean  — whether to display
 *   onDismiss  fn       — called when dismissed
 *   title      string   — feature name (e.g. "Cloud Sync")
 *   icon       string   — emoji icon
 *   desc       string   — short description of what's coming
 *   eta        string   — optional ETA hint (e.g. "Q2 2025")
 *   anchor     'bottom-left' | 'bottom-right' | 'top-right'  — position
 */
export default function LiquidNotif({
  show, onDismiss,
  title = 'Coming Soon',
  icon = '🚀',
  desc = 'This feature is under development.',
  eta,
  anchor = 'bottom-left',
}) {
  const ref = useRef(null)

  // Dismiss on Escape or outside click
  useEffect(() => {
    if (!show) return
    const onKey = e => { if (e.key === 'Escape') onDismiss?.() }
    const onOut = e => { if (ref.current && !ref.current.contains(e.target)) onDismiss?.() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => document.addEventListener('mousedown', onOut), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOut)
    }
  }, [show, onDismiss])

  if (!show) return null

  return (
    <div className={`lnotif lnotif-${anchor}`} ref={ref} role="dialog" aria-modal="true">
      {/* Glass background layers */}
      <div className="lnotif-bg" />
      <div className="lnotif-shimmer" />

      {/* Content */}
      <div className="lnotif-inner">
        {/* Icon with glow ring */}
        <div className="lnotif-icon-wrap">
          <div className="lnotif-icon-glow" />
          <span className="lnotif-icon">{icon}</span>
        </div>

        <div className="lnotif-body">
          {/* Badge */}
          <div className="lnotif-badge">✨ Coming Soon</div>
          <div className="lnotif-title">{title}</div>
          <div className="lnotif-desc">{desc}</div>
          {eta && <div className="lnotif-eta">⏱ Expected: {eta}</div>}
        </div>

        <button className="lnotif-close" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>

      {/* Bottom progress bar — animated shimmer */}
      <div className="lnotif-progress" />
    </div>
  )
}
