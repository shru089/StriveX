import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StriveXLogo from './StriveXLogo'
import { showToast } from './Toast'
import LiquidNotif from './LiquidNotif'
import db from '../db'
import './Sidebar.css'

const NAV = [
  { key: 'today',     icon: '⚡', label: 'Today' },
  { key: 'goals',     icon: '🎯', label: 'Goals' },
  { key: 'todo',      icon: '✅', label: 'To-Do' },
  { key: 'calendar',  icon: '📅', label: 'Calendar' },
  { key: 'analytics', icon: '📊', label: 'Analytics' },
]

// Features with "coming soon" notification config
const COMING_SOON = {
  sync: {
    icon: '☁️',
    title: 'Cloud Sync',
    desc: 'Sync your goals, tasks, and schedule across all your devices in real-time.',
    eta: 'Q2 2025',
  },
  export: {
    icon: '📤',
    title: 'Export & Backup',
    desc: 'Download your entire StriveX data as JSON or PDF report.',
    eta: 'Q2 2025',
  },
  teams: {
    icon: '👥',
    title: 'Team Mode',
    desc: 'Share goals and track accountability with friends or teammates.',
    eta: 'Q3 2025',
  },
  widgets: {
    icon: '🧩',
    title: 'Home Screen Widgets',
    desc: 'Quick-glance widgets for your schedule and streak on Android & iOS.',
    eta: 'Q3 2025',
  },
}

export default function Sidebar({ activeView, onViewChange }) {
  const { user, isGuest, logout } = useAuth()
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [notif, setNotif] = useState(null) // key from COMING_SOON

  const showNotif = (key) => setNotif(key)
  const hideNotif = () => setNotif(null)

  const handleSync = async () => {
    if (isGuest) {
      showNotif('sync')
      return
    }
    // Show coming-soon for all users since cloud sync is not fully live
    showNotif('sync')
  }

  const displayName = user?.email?.split('@')[0] || 'Guest'
  const level = user?.level || 1
  const xp   = user?.xp   || 0

  const active = notif ? COMING_SOON[notif] : null

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <StriveXLogo size={20} />
        <span>StriveX</span>
      </div>

      {/* Guest banner */}
      {isGuest && (
        <div className="sidebar-guest-banner">
          <span>👤 Guest Mode</span>
          <button className="sidebar-signin-btn" onClick={() => navigate('/')}>Sign in</button>
        </div>
      )}

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">DASHBOARD</div>
        {NAV.map(item => (
          <button
            key={item.key}
            className={`sidebar-nav-item${activeView === item.key ? ' active' : ''}`}
            onClick={() => onViewChange(item.key)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {activeView === item.key && <span className="sidebar-active-dot" />}
          </button>
        ))}

        <div className="sidebar-nav-label" style={{ marginTop: 24 }}>TOOLS</div>
        <button className="sidebar-nav-item" onClick={() => navigate('/work-coach')}>
          <span className="sidebar-nav-icon">🤖</span>
          <span>AI Work Coach</span>
        </button>
        <button className="sidebar-nav-item" onClick={() => navigate('/focus-zone')}>
          <span className="sidebar-nav-icon">🌿</span>
          <span>Focus Zone</span>
        </button>

        <div className="sidebar-nav-label" style={{ marginTop: 24 }}>SOON</div>
        <button className="sidebar-nav-item sidebar-nav-item--soon" onClick={() => showNotif('export')}>
          <span className="sidebar-nav-icon">📤</span>
          <span>Export</span>
          <span className="soon-pill">Soon</span>
        </button>
        <button className="sidebar-nav-item sidebar-nav-item--soon" onClick={() => showNotif('teams')}>
          <span className="sidebar-nav-icon">👥</span>
          <span>Team Mode</span>
          <span className="soon-pill">Soon</span>
        </button>
        <button className="sidebar-nav-item sidebar-nav-item--soon" onClick={() => showNotif('widgets')}>
          <span className="sidebar-nav-icon">🧩</span>
          <span>Widgets</span>
          <span className="soon-pill">Soon</span>
        </button>
      </nav>

      {/* User profile */}
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-profile">
            <div className="sidebar-avatar">{displayName[0]?.toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{displayName}</div>
              <div className="sidebar-level">Level {level} · {xp} XP</div>
            </div>
          </div>
        )}

        <button
          className={`sidebar-sync-btn${syncing ? ' syncing' : ''}`}
          onClick={handleSync}
          title="Cloud Sync — Coming Soon"
        >
          <span className="sidebar-sync-icon">{syncing ? '⟳' : '☁️'}</span>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>

        <button className="sidebar-logout" onClick={logout}>
          {isGuest ? '← Exit' : '⏏ Sign out'}
        </button>
      </div>

      {/* Liquid Coming Soon Notification */}
      {active && (
        <LiquidNotif
          show
          onDismiss={hideNotif}
          icon={active.icon}
          title={active.title}
          desc={active.desc}
          eta={active.eta}
          anchor="bottom-left"
        />
      )}
    </aside>
  )
}
