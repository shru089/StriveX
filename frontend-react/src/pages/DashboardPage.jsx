import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Toast, { showToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import AchievementBadges from '../components/AchievementBadges'
import db from '../db'
import api from '../api'
import { generateNudge } from '../gemini'
import { WeeklyCompletionChart, XPAreaChart, GoalRadialChart } from '../components/Charts'
import './DashboardPage.css'

// ── Time utils ────────────────────────────────────────────────────────────────
function getGreeting(h) {
  if (h < 5) return { g: 'Good night', emoji: '🌙' }
  if (h < 12) return { g: 'Good morning', emoji: '☀️' }
  if (h < 17) return { g: 'Good afternoon', emoji: '⚡' }
  return { g: 'Good evening', emoji: '🌆' }
}

function daysLeft(deadline) {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000)
  return diff
}

function urgencyClass(days) {
  if (days === null) return ''
  if (days < 0) return 'overdue'
  if (days <= 7) return 'urgent'
  if (days <= 21) return 'warning'
  return 'safe'
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function isBlockActive(block) {
  const now = new Date()
  const [h, m] = (block.time || '').split(':').map(Number)
  if (isNaN(h)) return false
  const blockMin = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const dur = block.duration || 60
  return nowMin >= blockMin && nowMin < blockMin + dur
}

function isPast(block) {
  const now = new Date()
  const [h, m] = (block.time || '').split(':').map(Number)
  if (isNaN(h)) return false
  const blockMin = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= blockMin + (block.duration || 60)
}

const BLOCK_COLORS = {
  task: { bg: 'rgba(94,106,210,0.12)', border: '#5e6ad2', dot: '#667eea' },
  break: { bg: 'rgba(16,185,129,0.10)', border: '#10b981', dot: '#34d399' },
  buffer: { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', dot: '#fbbf24' },
  focus: { bg: 'rgba(240,147,251,0.10)', border: '#f093fb', dot: '#f093fb' },
  meal: { bg: 'rgba(251,146,60,0.10)', border: '#fb923c', dot: '#fb923c' },
}

// ── Live clock ────────────────────────────────────────────────────────────────
function useLiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setT(new Date()), 1000); return () => clearInterval(iv) }, [])
  return t
}

// ── Priority config ───────────────────────────────────────────────────────────
const PRI = { 1: { txt: 'High', col: '#ef4444' }, 2: { txt: 'Med', col: '#f59e0b' }, 3: { txt: 'Low', col: '#10b981' } }

export default function DashboardPage() {
  const { user, isGuest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const now = useLiveClock()
  const params = new URLSearchParams(location.search)
  const initView = params.get('view') || 'today'

  const [view, setView] = useState(initView)
  const [schedule, setSchedule] = useState(null)
  const [goals, setGoals] = useState([])
  const [todos, setTodos] = useState([])
  const [nudge, setNudge] = useState('')
  const [ghostMode, setGhostMode] = useState(false)
  const [replanning, setReplanning] = useState(false)
  const [todoInput, setTodoInput] = useState('')
  const [todoPriority, setTodoPriority] = useState(2)
  const [loading, setLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState([])
  const [levelInfo, setLevelInfo] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  // Calendar
  const [calDate, setCalDate] = useState(new Date())
  const [calMode, setCalMode] = useState('week')
  const [events, setEvents] = useState(() => JSON.parse(localStorage.getItem('sx_cal_events') || '[]'))
  const [alarmTime, setAlarmTime] = useState('')
  const [alarmLabel, setAlarmLabel] = useState('')
  const [newEventTitle, setNewEventTitle] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)

  const { g: greeting, emoji: greetEmoji } = getGreeting(now.getHours())
  const displayName = user?.email?.split('@')[0] || 'Explorer'

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Hydrate ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setTodos(db.getTodos())
    setGoals(db.getGoals())
    setSchedule(db.getSchedule())

    const fetches = []

    if (!isGuest) {
      fetches.push(api.get('/schedule/today').then(r => { setSchedule(r.data); db.saveSchedule(r.data) }).catch(() => { }))
      fetches.push(api.get('/goals').then(r => { setGoals(r.data); db.saveGoals(r.data) }).catch(() => { }))
      fetches.push(api.get('/todos').then(r => {
        const cloud = r.data || []
        const localOnly = db.getTodos().filter(t => String(t.id).startsWith('local_'))
        const merged = [...cloud, ...localOnly]
        setTodos(merged); db.saveTodos(merged)
      }).catch(() => { }))
      // Fetch weekly analytics for charts
      fetches.push(api.get('/analytics/weekly').then(r => {
        if (r.data?.completion_trend) setWeeklyData(r.data.completion_trend)
        if (r.data?.level_info) setLevelInfo(r.data.level_info)
      }).catch(() => { }))
    }

    Promise.allSettled(fetches).finally(() => setLoading(false))

    generateNudge(db.getGoals(), db.getTodos().filter(t => t.completed).length, 0).then(setNudge).catch(() => {
      setNudge('Progress, not perfection. Every task counts.')
    })
  }, [])

  // ── Todo ops ─────────────────────────────────────────────────────────────────
  const addTodo = async () => {
    if (!todoInput.trim()) return
    const today = new Date().toISOString().split('T')[0]
    const fresh = db.addTodo({ title: todoInput.trim(), priority: todoPriority, due_date: today })
    setTodos(db.getTodos()); setTodoInput('')
    if (!isGuest) api.post('/todos', { title: fresh.title, priority: fresh.priority, due_date: today }).catch(() => { })
  }

  const toggleTodo = id => {
    const t = todos.find(x => x.id === id || x.id === String(id))
    if (!t) return
    db.updateTodo(id, { completed: !t.completed }); setTodos(db.getTodos())
    if (!isGuest && !String(id).startsWith('local_')) api.patch(`/todos/${id}`, { completed: !t.completed }).catch(() => { })
  }

  const deleteTodo = id => {
    db.deleteTodo(id); setTodos(db.getTodos())
    if (!isGuest && !String(id).startsWith('local_')) api.delete(`/todos/${id}`).catch(() => { })
  }

  const replan = async () => {
    setReplanning(true)
    try {
      const res = await api.post('/schedule/replan')
      setSchedule(res.data); db.saveSchedule(res.data)
      showToast('📅 Schedule updated!', 'success')
    } catch { showToast('Smart schedule is ready — AI offline', 'info') }
    finally { setReplanning(false) }
  }

  // ── Calendar ─────────────────────────────────────────────────────────────────
  const saveEvent = () => {
    if (!newEventTitle.trim() || !selectedDay) return
    const next = [...events, { id: Date.now(), title: newEventTitle, date: selectedDay }]
    setEvents(next); localStorage.setItem('sx_cal_events', JSON.stringify(next)); setNewEventTitle('')
  }

  const setAlarm = () => {
    if (!alarmTime) return
    if (Notification?.permission === 'default') Notification.requestPermission()
    db.addAlarm({ time: alarmTime, label: alarmLabel || 'Alarm' })
    showToast(`⏰ Alarm set for ${alarmTime}`, 'success')
    setAlarmTime(''); setAlarmLabel('')
  }

  const { year, month, first, total } = (() => {
    const y = calDate.getFullYear(), m = calDate.getMonth()
    return { year: y, month: m, first: new Date(y, m, 1).getDay(), total: new Date(y, m + 1, 0).getDate() }
  })()

  // ── Derived data ──────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTodos = todos.filter(t => !t.due_date || t.due_date === todayStr || t.due_date?.startsWith(todayStr))
  const completedToday = todos.filter(t => t.completed).length
  const blocks = schedule?.time_blocks || []
  const activeBlock = blocks.find(isBlockActive)

  // ── Ghost Mode ────────────────────────────────────────────────────────────────
  if (ghostMode) {
    return (
      <div className="ghost-mode">
        <div className="ghost-bg" />
        <div className="ghost-orb ghost-orb-1" />
        <div className="ghost-orb ghost-orb-2" />
        <div className="ghost-centre">
          <div className="ghost-icon-large">👻</div>
          <h1 className="ghost-heading">Ghost Mode</h1>
          <p className="ghost-task">{activeBlock?.title || 'Deep Focus Session'}</p>
          <div className="ghost-time">
            {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}
          </div>
          <p className="ghost-sub">Distractions blocked. You're in the zone.</p>
          <button className="ghost-exit-btn" onClick={() => setGhostMode(false)}>Exit Ghost Mode</button>
        </div>
      </div>
    )
  }

  // ── Dashboard Skeleton ────────────────────────────────────────────────────────
  const DashSkeleton = () => (
    <div className="today-view">
      <div className="sk-hero">
        <div className="sk-hero-left">
          <div className="skeleton sk-line short" />
          <div className="skeleton" style={{ height: 44, width: 160, borderRadius: 8 }} />
          <div className="skeleton sk-line medium" />
        </div>
        <div className="sk-hero-right">
          <div className="skeleton" style={{ height: 32, width: 140, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 56, width: 160, borderRadius: 12 }} />
        </div>
      </div>
      <div className="skeleton sk-insight" />
      <div className="today-grid">
        <div className="sk-card">
          <div className="skeleton sk-line short" />
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />)}
        </div>
        <div className="sk-card">
          <div className="skeleton sk-line short" />
          <div className="skeleton" style={{ height: 42, borderRadius: 10 }} />
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 42, borderRadius: 10 }} />)}
          <div className="skeleton sk-line medium" style={{ marginTop: 20 }} />
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      </div>
    </div>
  )

  return (
    <div className="db-page">
      <Toast />
      {/* Online/Offline indicator */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(245, 158, 11, 0.9)',
          backdropFilter: 'blur(12px)',
          padding: '10px 20px',
          borderRadius: '12px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)'
        }}>
          <span>⚠️</span>
          <span>You're offline — Changes saved locally</span>
        </div>
      )}
      <Sidebar activeView={view} onViewChange={setView} />

      <main className="db-main">

        {/* ════════════════ TODAY VIEW ════════════════ */}
        {view === 'today' && loading && <DashSkeleton />}
        {view === 'today' && !loading && (
          <div className="today-view">
            {/* ── HERO HEADER ── */}
            <div className="hero-header">
              <div className="hero-left">
                <div className="hero-greeting">
                  <span className="hero-emoji">{greetEmoji}</span>
                  <span>{greeting}, <strong>{displayName}</strong></span>
                </div>
                <div className="hero-time">
                  {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                  <span className="hero-seconds">:{String(now.getSeconds()).padStart(2, '0')}</span>
                </div>
                <div className="hero-date">
                  {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div className="hero-right">
                <div className="hero-actions">
                  <button className={`btn-ghost${ghostMode ? ' on' : ''}`} onClick={() => setGhostMode(true)}>
                    👻 Ghost Mode
                  </button>
                  <button className="btn-replan" onClick={replan} disabled={replanning}>
                    {replanning ? <span className="spinner" /> : '⚡'}
                    {replanning ? 'Replanning…' : 'Replan Day'}
                  </button>
                </div>
                {/* Mini stats */}
                <div className="hero-stats">
                  <div className="hstat">
                    <div className="hstat-val">{completedToday}</div>
                    <div className="hstat-lbl">Done</div>
                  </div>
                  <div className="hstat-div" />
                  <div className="hstat">
                    <div className="hstat-val">{todayTodos.filter(t => !t.completed).length}</div>
                    <div className="hstat-lbl">Left</div>
                  </div>
                  <div className="hstat-div" />
                  <div className="hstat">
                    <div className="hstat-val">{goals.length}</div>
                    <div className="hstat-lbl">Goals</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── AI INSIGHT CARD ── */}
            {nudge && (
              <div className="ai-insight-card">
                <div className="ai-insight-glow" />
                <div className="ai-insight-inner">
                  <div className="ai-insight-icon">🤖</div>
                  <div className="ai-insight-body">
                    <div className="ai-insight-label">AI Insight</div>
                    <p className="ai-insight-text">{nudge}</p>
                  </div>
                  {activeBlock && (
                    <div className="ai-now-chip">
                      <div className="ai-now-dot" />
                      <span>Now: {activeBlock.title}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 2-COLUMN LAYOUT ── */}
            <div className="today-grid">
              {/* ─ SCHEDULE COLUMN ─ */}
              <div className="today-col">
                <div className="section-header-row">
                  <h2 className="section-title">📅 Today's Schedule</h2>
                  {blocks.length > 0 && <span className="section-badge">{blocks.length} blocks</span>}
                </div>

                {blocks.length > 0 ? (
                  <div className="timeline">
                    {blocks.map((block, i) => {
                      const colors = BLOCK_COLORS[block.type] || BLOCK_COLORS.task
                      const active = isBlockActive(block)
                      const past = isPast(block)
                      return (
                        <div key={i} className={`tblock${active ? ' tblock-active' : ''}${past ? ' tblock-past' : ''}`}
                          style={{ '--bc': colors.border, '--bg': colors.bg }}>
                          <div className="tblock-connector">
                            <div className="tblock-dot" style={{ background: active ? colors.dot : past ? 'rgba(255,255,255,0.15)' : colors.dot, boxShadow: active ? `0 0 12px ${colors.dot}` : 'none' }} />
                            {i < blocks.length - 1 && <div className="tblock-line" />}
                          </div>
                          <div className="tblock-card" style={{ background: colors.bg, borderLeft: `3px solid ${active ? colors.border : past ? 'rgba(255,255,255,0.08)' : colors.border + '70'}` }}>
                            <div className="tblock-time">{fmtTime(block.time)}</div>
                            <div className="tblock-body">
                              <div className="tblock-title">{block.title || block.type}</div>
                              {block.duration && <div className="tblock-dur">{block.duration} min</div>}
                            </div>
                            {active && <div className="tblock-live"><span className="live-dot" />Live</div>}
                            <div className="tblock-type-chip" style={{ background: colors.bg, color: colors.border }}>{block.type}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="es-icon">📅</div>
                    <h3>No schedule yet</h3>
                    <p>Generate your AI-powered daily schedule based on your goals.</p>
                    <div className="es-actions">
                      <button className="es-btn-primary" onClick={() => setView('goals')}>🎯 Add a Goal First</button>
                      <button className="es-btn-secondary" onClick={replan}>⚡ Generate Schedule</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─ RIGHT COLUMN: TASKS + GOALS ─ */}
              <div className="today-col">
                {/* Today's Tasks */}
                <div className="section-header-row">
                  <h2 className="section-title">✅ Today's Tasks</h2>
                  {todayTodos.length > 0 && (
                    <span className="section-badge">{todayTodos.filter(t => t.completed).length}/{todayTodos.length}</span>
                  )}
                </div>
                <div className="task-add-row">
                  <input className="task-quick-input" placeholder="Add task for today…" value={todoInput}
                    onChange={e => setTodoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} />
                  <select className="task-pri-select" value={todoPriority} onChange={e => setTodoPriority(+e.target.value)}>
                    <option value={1}>🔴</option><option value={2}>🟡</option><option value={3}>🟢</option>
                  </select>
                  <button className="task-add-btn" onClick={addTodo}>+</button>
                </div>

                {todayTodos.length === 0 ? (
                  <div className="empty-mini">
                    <span>🎉</span> Clean slate! Add tasks above or generate from
                    <button className="inline-link" onClick={() => navigate('/work-coach')}>AI Work Coach</button>
                  </div>
                ) : (
                  <div className="task-list">
                    {todayTodos.map(t => (
                      <div key={t.id} className={`task-item${t.completed ? ' done' : ''}`}>
                        <button className="task-cb" onClick={() => toggleTodo(t.id)}>
                          {t.completed ? '✓' : ''}
                        </button>
                        <span className="task-title">{t.title}</span>
                        <div className="task-right">
                          <span className="task-pri" style={{ color: PRI[t.priority]?.col }}>●</span>
                          {t.source === 'ai' && <span className="task-ai">AI</span>}
                          <button className="task-del" onClick={() => deleteTodo(t.id)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Goals Overview */}
                <div className="section-header-row" style={{ marginTop: 28 }}>
                  <h2 className="section-title">🎯 Active Goals</h2>
                  <button className="section-link" onClick={() => setView('goals')}>View all →</button>
                </div>

                {goals.length === 0 ? (
                  <div className="empty-mini">
                    <span>🎯</span> No goals yet.
                    <button className="inline-link" onClick={() => setView('goals')}>Add your first goal →</button>
                  </div>
                ) : (
                  <div className="goals-strip">
                    {goals.slice(0, 4).map((g, i) => {
                      const dl = g.deadline || g.end_date
                      const days = daysLeft(dl)
                      const uc = urgencyClass(days)
                      return (
                        <div key={g.id || i} className="goal-mini-card">
                          <div className="goal-mini-header">
                            <span className="goal-mini-title">{g.title}</span>
                            {dl && (
                              <span className={`deadline-badge ${uc}`}>
                                {days === null ? '—' : days < 0 ? 'Overdue' : days === 0 ? 'Today!' : `${days}d left`}
                              </span>
                            )}
                          </div>
                          <div className="goal-mini-bar">
                            <div className="goal-mini-fill" style={{ width: `${g.progress || 0}%` }} />
                          </div>
                          <div className="goal-mini-meta">
                            <span>{g.progress || 0}% complete</span>
                            {dl && <span className="goal-mini-date">Due {new Date(dl).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── ACHIEVEMENT BADGES SECTION ── */}
            <AchievementBadges />
          </div>
        )}

        {/* ════════════════ GOALS VIEW ════════════════ */}
        {view === 'goals' && (
          <div className="full-view">
            <div className="fv-header">
              <h1 className="fv-title">🎯 My Goals</h1>
              <p className="fv-sub">Track everything with deadlines and progress</p>
            </div>
            {goals.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon">🎯</div>
                <h3>No goals yet</h3>
                <p>Add goals on the onboarding page or via AI Work Coach.</p>
              </div>
            ) : (
              <div className="goals-full-grid">
                {goals.map((g, i) => {
                  const dl = g.deadline || g.end_date
                  const days = daysLeft(dl)
                  const uc = urgencyClass(days)
                  return (
                    <div key={g.id || i} className="goal-full-card">
                      <div className="gfc-top">
                        <div>
                          <div className="gfc-title">{g.title}</div>
                          {g.description && <div className="gfc-desc">{g.description}</div>}
                        </div>
                        {dl && <span className={`deadline-badge ${uc} deadline-lg`}>
                          {days === null ? '—' : days < 0 ? 'Overdue' : days === 0 ? 'Due Today!' : `${days} days`}
                        </span>}
                      </div>
                      <div className="gfc-bar"><div className="gfc-fill" style={{ width: `${g.progress || 0}%` }} /></div>
                      <div className="gfc-meta">
                        <span>{g.progress || 0}% complete</span>
                        {dl && <span>📅 {new Date(dl).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>}
                        {g.estimated_hours && <span>⏱ {g.estimated_hours}h estimated</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ TODO VIEW ════════════════ */}
        {view === 'todo' && (
          <div className="full-view">
            <div className="fv-header">
              <h1 className="fv-title">✅ All Tasks</h1>
              <p className="fv-sub">{todos.filter(t => t.completed).length} of {todos.length} completed</p>
            </div>
            <div className="todo-full-add">
              <input className="tfa-input" placeholder="Add task… (Enter to save)" value={todoInput}
                onChange={e => setTodoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} />
              <select className="task-pri-select" value={todoPriority} onChange={e => setTodoPriority(+e.target.value)}>
                <option value={1}>🔴 High</option><option value={2}>🟡 Medium</option><option value={3}>🟢 Low</option>
              </select>
              <button className="task-add-btn" onClick={addTodo}>Add</button>
            </div>
            {todos.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon">✅</div><h3>All clear!</h3>
                <p>Add tasks above or use AI Work Coach for smart suggestions.</p>
              </div>
            ) : (
              <div className="task-full-list">
                {todos.map(t => (
                  <div key={t.id} className={`task-full-item${t.completed ? ' done' : ''}`}>
                    <button className="tfcb" onClick={() => toggleTodo(t.id)}>{t.completed ? '✓' : ''}</button>
                    <div className="tf-body">
                      <span className="tf-title">{t.title}</span>
                      <div className="tf-meta">
                        <span className="tf-pri" style={{ background: `${PRI[t.priority]?.col}20`, color: PRI[t.priority]?.col }}>{PRI[t.priority]?.txt}</span>
                        {t.source === 'ai' && <span className="tf-ai">✨ AI</span>}
                        {t.due_date && <span className="tf-due">📅 {t.due_date}</span>}
                        {t.category && <span className="tf-cat">{t.category}</span>}
                      </div>
                    </div>
                    <button className="task-del" onClick={() => deleteTodo(t.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ CALENDAR VIEW ════════════════ */}
        {view === 'calendar' && (() => {
          const today    = new Date()
          const year     = calDate.getFullYear()
          const month    = calDate.getMonth()
          const total    = new Date(year, month + 1, 0).getDate()
          const first    = new Date(year, month, 1).getDay()

          // Build the week starting Sunday
          const startOfWeek = new Date(calDate)
          startOfWeek.setDate(calDate.getDate() - calDate.getDay())
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); return d
          })
          const HOURS        = Array.from({ length: 17 }, (_, i) => i + 7) // 7  AM – 11  PM
          const PX_PER_MIN   = 1.15

          const blocks     = schedule?.blocks || []
          const feasibility = schedule?.feasibility_score ?? null

          const TASK_COLORS = [
            { bg: 'rgba(80,80,200,0.82)',   border: '#667eea', label: 'Goal task' },
            { bg: 'rgba(10,100,70,0.82)',   border: '#10b981', label: 'Practice' },
            { bg: 'rgba(140,90,0,0.82)',    border: '#f59e0b', label: 'Deep work' },
            { bg: 'rgba(50,50,60,0.82)',    border: '#6b7280', label: 'Ghost mode' },
          ]
          function blockColor(b) {
            if (b.type === 'break' || b.type === 'meal') return TASK_COLORS[1]
            if (b.type === 'focus')  return TASK_COLORS[2]
            if (b.type === 'buffer') return TASK_COLORS[3]
            return TASK_COLORS[0]
          }
          function timeToMin(t) {
            if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m
          }
          function addMin(t, dur) {
            const total = timeToMin(t) + dur
            return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
          }

          const nowMin  = now.getHours() * 60 + now.getMinutes()
          const nowTopPx = (nowMin - 7 * 60) * PX_PER_MIN
          const isThisWeek = weekDays.some(d => d.toDateString() === today.toDateString())
          const gridH   = HOURS.length * 60 * PX_PER_MIN

          return (
            <div className="full-view cal-full">
              {/* ── Top bar ── */}
              <div className="cal-topbar">
                <div className="cal-topbar-left">
                  <button className="cal-nav-btn" onClick={() => {
                    if (calMode === 'week') { const d = new Date(calDate); d.setDate(d.getDate()-7); setCalDate(d) }
                    else setCalDate(new Date(year, month-1, 1))
                  }}>&#8249;</button>
                  <span className="cal-month">
                    {calMode === 'week'
                      ? `${weekDays[0].toLocaleString('en',{month:'short',day:'numeric'})} – ${weekDays[6].toLocaleString('en',{month:'short',day:'numeric',year:'numeric'})}`
                      : new Date(year, month).toLocaleString('en', {month:'long',year:'numeric'})}
                  </span>
                  <button className="cal-nav-btn" onClick={() => {
                    if (calMode === 'week') { const d = new Date(calDate); d.setDate(d.getDate()+7); setCalDate(d) }
                    else setCalDate(new Date(year, month+1, 1))
                  }}>&#8250;</button>
                  <button className="cal-today-btn" onClick={() => setCalDate(new Date())}>Today</button>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className={`liquid-btn${calMode==='week'?' selected':''}`} onClick={() => setCalMode('week')}>Week</button>
                  <button className={`liquid-btn${calMode==='month'?' selected':''}`} onClick={() => setCalMode('month')}>Month</button>
                </div>
              </div>

              {/* ══════════ WEEK VIEW ══════════ */}
              {calMode === 'week' && (
                <div className="week-view">
                  {/* Day tabs + feasibility ring */}
                  <div className="week-day-tabs">
                    <div className="week-time-gutter" />
                    {weekDays.map((d, i) => {
                      const isToday = d.toDateString() === today.toDateString()
                      return (
                        <div key={i} className={`week-day-tab${isToday?' today':''}`} onClick={() => setCalDate(d)}>
                          <span className="wdt-name">{d.toLocaleString('en',{weekday:'short'})}</span>
                          <span className="wdt-num">{d.getDate()}</span>
                        </div>
                      )
                    })}
                    {feasibility !== null && (
                      <div className="feasibility-ring-wrap">
                        <svg width="56" height="56" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
                          <circle cx="28" cy="28" r="22" fill="none"
                            stroke={feasibility>=75?'#10b981':feasibility>=50?'#f59e0b':'#ef4444'}
                            strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${2*Math.PI*22}`}
                            strokeDashoffset={`${2*Math.PI*22*(1-feasibility/100)}`}
                            transform="rotate(-90 28 28)"
                            style={{transition:'stroke-dashoffset 0.8s ease'}}
                          />
                        </svg>
                        <div className="feasibility-pct">{Math.round(feasibility)}%</div>
                        <div className="feasibility-lbl">Feasibility</div>
                      </div>
                    )}
                  </div>

                  {/* Time grid */}
                  <div className="week-grid-scroll">
                    <div className="week-grid" style={{height:`${gridH}px`}}>
                      {/* Hour lines */}
                      {HOURS.map(h => (
                        <div key={h} className="week-hour-row" style={{top:`${(h-7)*60*PX_PER_MIN}px`}}>
                          <div className="week-time-label">
                            {h===12?'12 PM':h<12?`${h} AM`:`${h-12} PM`}
                          </div>
                          <div className="week-hour-line" />
                        </div>
                      ))}
                      {/* Now line */}
                      {isThisWeek && nowTopPx > 0 && nowTopPx < gridH && (
                        <div className="week-now-line" style={{top:`${nowTopPx}px`}}>
                          <div className="week-now-dot" />
                        </div>
                      )}
                      {/* Columns */}
                      <div className="week-cols">
                        <div className="week-time-gutter" />
                        {weekDays.map((d, di) => {
                          const isToday = d.toDateString() === today.toDateString()
                          const ds = d.toISOString().split('T')[0]
                          const dayEvents = events.filter(e => e.date === ds)
                          return (
                            <div key={di} className={`week-col${isToday?' today-col':''}`}>
                              {/* Schedule blocks shown on today */}
                              {isToday && blocks.map((b, bi) => {
                                const startMin = timeToMin(b.time)
                                const dur = b.duration || 60
                                const top = (startMin - 7*60) * PX_PER_MIN
                                const height = Math.max(dur * PX_PER_MIN, 22)
                                if (top < 0 || top > gridH) return null
                                const col = blockColor(b)
                                return (
                                  <div key={bi} className="week-block"
                                    style={{top:`${top}px`,height:`${height}px`,background:col.bg,borderLeft:`3px solid ${col.border}`}}>
                                    <div className="wb-title">{b.label||b.task||'Block'}</div>
                                    <div className="wb-time">{fmt12(b.time)} – {fmt12(addMin(b.time,dur))}{b.goal?` · ${b.goal}`:''}</div>
                                  </div>
                                )
                              })}
                              {/* Calendar events (absolute at top) */}
                              {dayEvents.map((e, ei) => (
                                <div key={ei} className="week-block week-block-event"
                                  style={{top:`${ei*34+4}px`,height:'28px',background:'rgba(94,106,210,0.25)',borderLeft:'3px solid #667eea'}}>
                                  <div className="wb-title">📌 {e.title}</div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="week-legend">
                    {TASK_COLORS.map(c => (
                      <span key={c.label} className="wl-item">
                        <span className="wl-dot" style={{background:c.border}} />{c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════════ MONTH VIEW ══════════ */}
              {calMode === 'month' && (
                <div className="month-view">
                  <div className="cal-grid">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="cal-day-name">{d}</div>)}
                    {Array.from({length:first}).map((_,i)=><div key={`e${i}`}/>)}
                    {Array.from({length:total}).map((_,i)=>{
                      const day=i+1
                      const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                      const hasEv=events.some(e=>e.date===ds)
                      const isToday=today.toDateString()===new Date(year,month,day).toDateString()
                      return(
                        <div key={day} className={`cal-day${isToday?' today':''}${selectedDay===ds?' sel':''}${hasEv?' has-ev':''}`}
                          onClick={()=>setSelectedDay(selectedDay===ds?null:ds)}>
                          {day}{hasEv&&<span className="cal-dot"/>}
                        </div>
                      )
                    })}
                  </div>
                  {selectedDay&&(
                    <div className="month-event-panel">
                      <h3>📌 {selectedDay}</h3>
                      <div className="cal-ev-add">
                        <input placeholder="Event title…" value={newEventTitle} onChange={e=>setNewEventTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveEvent()}/>
                        <button onClick={saveEvent}>Add</button>
                      </div>
                      {events.filter(e=>e.date===selectedDay).map(e=>(<div key={e.id} className="cal-ev-item">📌 {e.title}</div>))}
                      {events.filter(e=>e.date===selectedDay).length===0&&<p style={{color:'rgba(255,255,255,0.3)',fontSize:'13px'}}>No events — add one above</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Alarm — both views */}
              <div className="alarm-panel" style={{marginTop:16}}>
                <h3>⏰ Set Alarm</h3>
                <div className="alarm-fields">
                  <input type="time" value={alarmTime} onChange={e=>setAlarmTime(e.target.value)} className="alarm-input"/>
                  <input type="text" placeholder="Label (optional)" value={alarmLabel} onChange={e=>setAlarmLabel(e.target.value)} className="alarm-input"/>
                  <button className="alarm-set-btn" onClick={setAlarm}>Set</button>
                </div>
                <p className="alarm-note">💡 Alarm rings in Focus Zone with 3 audio bells</p>
              </div>
            </div>
          )
        })()}


        {/* ════════════════ ANALYTICS VIEW ════════════════ */}
        {view === 'analytics' && (
          <div className="full-view">
            <div className="fv-header">
              <h1 className="fv-title">📊 Analytics</h1>
              <p className="fv-sub">Your productivity at a glance</p>
            </div>

            {/* ── Stat chips ── */}
            <div className="analytics-grid">
              {[
                { val: todos.filter(t => t.completed).length, lbl: 'Tasks Completed', icon: '✅', col: '#10b981' },
                { val: goals.length, lbl: 'Active Goals', icon: '🎯', col: '#5e6ad2' },
                { val: todos.filter(t => t.source === 'ai').length, lbl: 'AI Tasks', icon: '✨', col: '#f093fb' },
                { val: todos.length > 0 ? `${Math.round(todos.filter(t => t.completed).length / todos.length * 100)}%` : '0%', lbl: 'Completion Rate', icon: '📈', col: '#f59e0b' },
              ].map(c => (
                <div key={c.lbl} className="analytics-card">
                  <div className="ac-icon" style={{ color: c.col }}>{c.icon}</div>
                  <div className="ac-val" style={{ color: c.col }}>{c.val}</div>
                  <div className="ac-lbl">{c.lbl}</div>
                </div>
              ))}
            </div>

            {/* ── Charts ── */}
            <div className="charts-grid">
              <WeeklyCompletionChart data={weeklyData} />
              <XPAreaChart
                currentXP={user?.xp || 0}
                levelInfo={levelInfo || { level: 1, title: 'Newcomer', xp_to_next: 100 }}
              />
            </div>
            {goals.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <GoalRadialChart goals={goals} />
              </div>
            )}
            {goals.length === 0 && !loading && (
              <div className="analytics-coming-soon" style={{ marginTop: 16 }}>
                <span>🎯</span>
                <h3>No goals yet</h3>
                <p>Add goals to see your progress charts and goal velocity here.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
