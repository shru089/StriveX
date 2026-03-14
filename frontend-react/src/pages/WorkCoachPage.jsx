import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StriveXLogo from '../components/StriveXLogo'
import Toast, { showToast } from '../components/Toast'
import { generateWorkPlan, isAvailable as aiAvailable } from '../gemini'
import db from '../db'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import './WorkCoachPage.css'

const ROLES = ['Software Engineer', 'Product Manager', 'Data Scientist', 'Designer', 'Student', 'Founder/CEO', 'Marketing', 'Sales', 'Researcher', 'Consultant']

const PRI_LABEL = { 1: '🔴 High', 2: '🟡 Medium', 3: '🟢 Low' }

export default function WorkCoachPage() {
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [currentWork, setCurrentWork] = useState('')
  const [blockers, setBlockers] = useState('')
  const [plan, setPlan] = useState(null)
  const [tasks, setTasks] = useState([])
  const [aiPowered, setAiPowered] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [addingTasks, setAddingTasks] = useState(false)

  const effectiveRole = role === '__custom__' ? customRole : role
  const progress = (step / 4) * 100

  const generatePlan = async () => {
    if (!effectiveRole || !currentWork.trim()) {
      showToast('Please fill in your role and current work.', 'error')
      return
    }
    setLoading(true)
    try {
      let result = null

      // Try Gemini first (frontend, free tier)
      if (aiAvailable()) {
        result = await generateWorkPlan(effectiveRole, currentWork, blockers)
      }

      // Try backend next (if logged in)
      if (!result && !isGuest) {
        try {
          const res = await api.post('/work-coach', { role: effectiveRole, current_work: currentWork, blockers })
          result = res.data
        } catch { /* backend also down */ }
      }

      // Smart fallback — always works
      if (!result) {
        result = generateSmartFallback(effectiveRole, currentWork, blockers)
      }

      const t = result.tasks || []
      setPlan(result.coaching_text || result.guidance || '')
      setTasks(t)
      setAiPowered(Boolean(result.ai_powered))
      setSelectedTasks(new Set(t.map((_, i) => i)))
      setStep(4)
    } catch (e) {
      showToast('Something went wrong. Please try again.', 'error')
    } finally { setLoading(false) }
  }

  /** Always-available rule-based fallback */
  function generateSmartFallback(role, work, blockers) {
    const lines = work.split('.').filter(Boolean).slice(0, 3)
    const tasks = lines.map((line, i) => ({
      title: `Work on: ${line.trim().slice(0, 60)}`,
      description: 'Break this down into smaller steps and track progress.',
      priority: i === 0 ? 1 : 2,
      estimated_minutes: 45
    }))
    if (blockers) {
      tasks.push({ title: `Address blocker: ${blockers.slice(0, 60)}`, description: 'Resolve this before moving forward.', priority: 1, estimated_minutes: 30 })
    }
    return {
      coaching_text: `As a ${role}, your focus should be on making consistent progress. Break your work into smaller chunks and tackle the highest-priority item first. Your existing commitments are respected — these tasks work alongside your current schedule.`,
      tasks,
      ai_powered: false
    }
  }

  const addTasksToTodo = async () => {
    const selected = tasks.filter((_, i) => selectedTasks.has(i))
    if (!selected.length) return showToast('Select at least one task.', 'error')
    setAddingTasks(true)
    try {
      // Always save to localStorage first
      const added = db.addTodosBulk(selected.map(t => ({
        title: t.title,
        description: t.description || '',
        priority: t.priority || 2,
        source: 'ai',
        category: 'AI Task'
      })))

      // Also sync to backend if logged in
      if (!isGuest) {
        api.post('/todos/bulk', { tasks: selected.map(t => ({ ...t, source: 'ai' })) }).catch(() => { })
      }

      showToast(`✅ Added ${added.length} task${added.length !== 1 ? 's' : ''} to your To-Do list!`, 'success')
      setTimeout(() => navigate('/dashboard?view=todo'), 1500)
    } catch { showToast('Could not add tasks', 'error') }
    finally { setAddingTasks(false) }
  }

  const toggleTask = (i) => setSelectedTasks(prev => {
    const s = new Set(prev)
    s.has(i) ? s.delete(i) : s.add(i)
    return s
  })

  return (
    <div className="wc-page">
      <Toast />
      <div className="bg-grid" />
      <div className="bg-glow bg-glow-1" />

      <div className="wc-container">
        {/* Header */}
        <div className="wc-header">
          <button className="wc-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="wc-logo"><StriveXLogo size={22} /><span>AI Work Coach</span></div>
          <div className="wc-ai-badge">
            {aiAvailable() ? <span className="ai-badge-on">✨ Gemini AI</span> : <span className="ai-badge-off">🤖 Smart Scheduler</span>}
          </div>
        </div>

        {/* Progress */}
        <div className="ob-progress">
          <div className="ob-progress-bar"><div className="ob-progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="ob-progress-label">Step {step} of 4</span>
        </div>

        {/* AI unavailable notice */}
        {!aiAvailable() && step < 4 && (
          <div className="wc-ai-notice">
            🤖 AI is offline — Smart Scheduler will handle this instead. <strong>Your schedule still works perfectly.</strong>
          </div>
        )}

        <div className="wc-robot">🤖</div>

        <div className="wc-card glass-card">
          {/* STEP 1 — Role */}
          {step === 1 && (
            <div className="wc-step">
              <div className="ob-step-header">
                <div className="step-chip">Step 1 — Your Role</div>
                <h2>What best describes you?</h2>
                <p>I'll tailor my coaching to your specific context without interfering with your existing work.</p>
              </div>
              <div className="role-grid">
                {ROLES.map(r => (
                  <button key={r} className={`liquid-btn${role === r ? ' selected' : ''}`}
                    onClick={() => { setRole(r); setCustomRole('') }}>{r}</button>
                ))}
                <button className={`liquid-btn${role === '__custom__' ? ' selected' : ''}`}
                  onClick={() => setRole('__custom__')}>+ Custom</button>
              </div>
              {role === '__custom__' && (
                <input className="wc-input" placeholder="e.g. Freelance Graphic Designer"
                  value={customRole} onChange={e => setCustomRole(e.target.value)} autoFocus />
              )}
              <div className="wc-nav">
                <div />
                <button className="btn-ob-next" onClick={() => setStep(2)} disabled={!effectiveRole}>Continue →</button>
              </div>
            </div>
          )}

          {/* STEP 2 — Current Work */}
          {step === 2 && (
            <div className="wc-step">
              <div className="ob-step-header">
                <div className="step-chip">Step 2 — Current Work</div>
                <h2>What are you working on?</h2>
                <p>Tell me your current project or tasks. <strong>AI will add to your work — not replace it.</strong></p>
              </div>
              <textarea className="wc-textarea" rows={5}
                placeholder={`e.g. I'm building a SaaS dashboard. Working on authentication and chart components.`}
                value={currentWork} onChange={e => setCurrentWork(e.target.value)} />
              <div className="wc-nav">
                <button className="btn-ob-back" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-ob-next" onClick={() => setStep(3)} disabled={!currentWork.trim()}>Continue →</button>
              </div>
            </div>
          )}

          {/* STEP 3 — Blockers */}
          {step === 3 && (
            <div className="wc-step">
              <div className="ob-step-header">
                <div className="step-chip">Step 3 — Blockers (optional)</div>
                <h2>What's in your way?</h2>
                <p>Any challenges, uncertainties, or distractions?</p>
              </div>
              <textarea className="wc-textarea" rows={4}
                placeholder="e.g. Unsure how to implement OAuth. Distracted by notifications."
                value={blockers} onChange={e => setBlockers(e.target.value)} />
              <div className="wc-nav">
                <button className="btn-ob-back" onClick={() => setStep(2)}>← Back</button>
                <button className="btn-ob-next" onClick={generatePlan} disabled={loading}>
                  {loading
                    ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />Generating your plan…</>
                    : '✨ Generate My Plan →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — AI Plan */}
          {step === 4 && plan !== null && (
            <div className="wc-step">
              <div className="ob-step-header">
                <div className="step-chip">Step 4 — Your Action Plan</div>
                <h2>{aiPowered ? '✨ AI-Enhanced Plan' : '⚡ Smart Plan'}</h2>
                {aiPowered && <p className="wc-ai-note">🤖 Generated by Gemini AI — works alongside your existing commitments</p>}
                {!aiPowered && <p className="wc-ai-note">⚡ Generated by Smart Scheduler — AI was unavailable but your plan is still great!</p>}
              </div>

              {plan && (
                <div className="wc-coaching-text">
                  {plan.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} style={line.startsWith('#') ? { fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' } : { color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.7' }}>
                      {line.replace(/^#+\s*/, '')}
                    </p>
                  ))}
                </div>
              )}

              {tasks.length > 0 && (
                <>
                  <h3 className="wc-tasks-title">Select tasks to add to your To-Do List:</h3>
                  <div className="wc-tasks-list">
                    {tasks.map((t, i) => (
                      <label key={i} className={`wc-task-item${selectedTasks.has(i) ? ' selected' : ''}`}>
                        <input type="checkbox" checked={selectedTasks.has(i)} onChange={() => toggleTask(i)} className="sr-only" />
                        <div className="wc-task-check">{selectedTasks.has(i) ? '✓' : ''}</div>
                        <div className="wc-task-content">
                          <div className="wc-task-title">{t.title}</div>
                          {t.description && <div className="wc-task-desc">{t.description}</div>}
                          <span className={`todo-priority-chip p${t.priority}`}>{PRI_LABEL[t.priority] || '🟡 Medium'}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="wc-action-row">
                    <span className="wc-selected-count">{selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected</span>
                    <button className="btn-ob-next" onClick={addTasksToTodo} disabled={addingTasks || selectedTasks.size === 0}>
                      {addingTasks ? 'Adding…' : `Add ${selectedTasks.size} to To-Do →`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
