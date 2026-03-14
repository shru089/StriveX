import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StriveXLogo from '../components/StriveXLogo'
import api from '../api'
import './OnboardingPage.css'

const ENERGY_OPTIONS = [
  { value: 'morning', emoji: '🌅', title: 'Morning', desc: '6 AM – Noon' },
  { value: 'afternoon', emoji: '☀️', title: 'Afternoon', desc: '12 PM – 6 PM' },
  { value: 'night', emoji: '🌙', title: 'Night Owl', desc: '6 PM – 2 AM' },
]
const STYLE_OPTIONS = [
  { value: 'deep', emoji: '🔬', title: 'Deep Worker', desc: 'Long blocks, fewer tasks, maximum focus' },
  { value: 'varied', emoji: '🎯', title: 'Varied Sprinter', desc: 'Shorter sessions, more tasks, regular breaks' },
  { value: 'flexible', emoji: '🌊', title: 'Flexible', desc: 'Let StriveX decide based on my patterns' },
  { value: 'deadline', emoji: '⚡', title: 'Deadline Driven', desc: 'Light until deadlines near, then heavy' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [s1, setS1] = useState({ wakeTime: '07:00', sleepTime: '23:00', energyType: 'morning' })
  const [s2, setS2] = useState({ peakStart: '09:00', peakEnd: '12:00', workStyle: 'deep' })
  const [commitments, setCommitments] = useState([])
  const [newCommit, setNewCommit] = useState({ title: '', startTime: '09:00', endTime: '17:00' })
  const [s4, setS4] = useState({ title: '', description: '', deadline: '', totalHours: '' })
  const [feasPct, setFeasPct] = useState(null)

  const progress = (step / 4) * 100

  // Compute live feasibility preview
  useEffect(() => {
    if (s4.deadline && s4.totalHours) {
      const days = Math.ceil((new Date(s4.deadline) - new Date()) / 86400000)
      const dailyAvailableHrs = 4
      const possible = days * dailyAvailableHrs
      const pct = Math.min(100, Math.round((possible / parseFloat(s4.totalHours)) * 100))
      setFeasPct(pct)
    } else setFeasPct(null)
  }, [s4.deadline, s4.totalHours])

  const addCommitment = () => {
    if (!newCommit.title.trim()) return
    setCommitments(c => [...c, { ...newCommit, id: Date.now() }])
    setNewCommit(c => ({ ...c, title: '' }))
  }

  const finish = async () => {
    if (!s4.title || !s4.deadline || !s4.totalHours) {
      return alert('Please fill in your goal title, deadline, and hours.')
    }
    setLoading(true)
    try {
      // 1. Save user profile
      const profileRes = await api.post('/onboarding/profile', {
        wake_time: s1.wakeTime,
        sleep_time: s1.sleepTime,
        energy_type: s1.energyType,
        peak_start: s2.peakStart,
        peak_end: s2.peakEnd,
        work_style: s2.workStyle
      })
      if (profileRes.data?.user) updateUser(profileRes.data.user)

      // 2. Add commitments (send all at once)
      if (commitments.length > 0) {
        await api.post('/onboarding/commitments', {
          commitments: commitments.map(c => ({
            title: c.title,
            start_time: c.startTime,
            end_time: c.endTime,
            recurring: true
          }))
        }).catch(() => {})
      }

      // 3. Create first goal
      await api.post('/goals', {
        title: s4.title,
        description: s4.description,
        deadline: s4.deadline,
        estimated_hours: parseFloat(s4.totalHours)
      })

      navigate('/dashboard', { replace: true })
    } catch (e) {
      alert(e?.response?.data?.error || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="ob-page">
      <div className="bg-grid" />
      <div className="bg-glow bg-glow-1" />

      <div className="ob-container">
        {/* Logo */}
        <div className="ob-logo"><StriveXLogo size={28} /><span>StriveX</span></div>

        {/* Progress */}
        <div className="ob-progress">
          <div className="ob-progress-bar"><div className="ob-progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="ob-progress-label">Step {step} of 4</span>
        </div>

        {/* Step 1 — Rhythm */}
        {step === 1 && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="step-chip">Step 1 — Rhythm</div>
              <h2>When does your day run?</h2>
              <p>StriveX builds around your actual life, not an ideal version of it.</p>
            </div>
            <div className="time-row">
              <div className="ob-form-group">
                <label>⏰ Wake up time</label>
                <input type="time" value={s1.wakeTime} onChange={e => setS1(s => ({...s, wakeTime: e.target.value}))} />
              </div>
              <div className="ob-form-group">
                <label>🌙 Sleep time</label>
                <input type="time" value={s1.sleepTime} onChange={e => setS1(s => ({...s, sleepTime: e.target.value}))} />
              </div>
            </div>
            <div className="ob-form-group">
              <label>⚡ When is your energy highest?</label>
              <div className="energy-cards">
                {ENERGY_OPTIONS.map(opt => (
                  <label key={opt.value} className={`energy-card-label${s1.energyType === opt.value ? ' selected' : ''}`}>
                    <input type="radio" name="energyType" value={opt.value} checked={s1.energyType === opt.value}
                      onChange={() => setS1(s => ({...s, energyType: opt.value}))} className="sr-only" />
                    <div className="energy-card-emoji">{opt.emoji}</div>
                    <div className="energy-card-title">{opt.title}</div>
                    <div className="energy-card-desc">{opt.desc}</div>
                  </label>
                ))}
              </div>
            </div>
            <div className="ob-nav">
              <div />
              <button className="btn-ob-next" onClick={() => setStep(2)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Peak */}
        {step === 2 && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="step-chip">Step 2 — Peak Performance</div>
              <h2>Define your focus window</h2>
              <p>StriveX schedules your hardest tasks inside your peak window.</p>
            </div>
            <div className="ob-form-group">
              <label>🎯 Peak focus hours</label>
              <div className="peak-hours-row">
                <div className="ob-form-group" style={{marginBottom:0}}>
                  <label>Start</label>
                  <input type="time" value={s2.peakStart} onChange={e => setS2(s=>({...s, peakStart: e.target.value}))} />
                </div>
                <div className="ob-form-group" style={{marginBottom:0}}>
                  <label>End</label>
                  <input type="time" value={s2.peakEnd} onChange={e => setS2(s=>({...s, peakEnd: e.target.value}))} />
                </div>
              </div>
              <div className="peak-hint">💡 Difficulty-4+ tasks auto-schedule here</div>
            </div>
            <div className="ob-form-group">
              <label>🧠 Your productivity style</label>
              <div className="priority-cards">
                {STYLE_OPTIONS.map(opt => (
                  <label key={opt.value} className={`priority-card-label${s2.workStyle === opt.value ? ' selected' : ''}`}>
                    <input type="radio" name="workStyle" value={opt.value} checked={s2.workStyle === opt.value}
                      onChange={() => setS2(s=>({...s, workStyle: opt.value}))} className="sr-only" />
                    <div className="priority-card-emoji">{opt.emoji}</div>
                    <div>
                      <div className="priority-card-title">{opt.title}</div>
                      <div className="priority-card-desc">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="ob-nav">
              <button className="btn-ob-back" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-ob-next" onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Commitments */}
        {step === 3 && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="step-chip">Step 3 — Fixed Commitments</div>
              <h2>What's already on your plate?</h2>
              <p>Add recurring events — college, gym, etc. StriveX won't schedule over these.</p>
            </div>
            <div className="commitment-list">
              {commitments.map(c => (
                <div key={c.id} className="commitment-item">
                  <span>{c.title}</span>
                  <span className="commit-time">{c.startTime} – {c.endTime}</span>
                  <button onClick={() => setCommitments(list => list.filter(x => x.id !== c.id))}>✕</button>
                </div>
              ))}
            </div>
            <div className="commitment-inline">
              <div className="ob-form-group" style={{marginBottom:0}}>
                <label>Activity</label>
                <input type="text" placeholder="e.g. College, Gym" value={newCommit.title}
                  onChange={e => setNewCommit(c=>({...c, title: e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && addCommitment()} />
              </div>
              <div className="ob-form-group" style={{marginBottom:0}}>
                <label>From</label>
                <input type="time" value={newCommit.startTime} onChange={e => setNewCommit(c=>({...c, startTime: e.target.value}))} />
              </div>
              <div className="ob-form-group" style={{marginBottom:0}}>
                <label>To</label>
                <input type="time" value={newCommit.endTime} onChange={e => setNewCommit(c=>({...c, endTime: e.target.value}))} />
              </div>
              <button className="btn-add-commit" onClick={addCommitment}>+</button>
            </div>
            <div className="ob-nav">
              <button className="btn-ob-back" onClick={() => setStep(2)}>← Back</button>
              <div style={{display:'flex', gap:'12px'}}>
                <button className="btn-ob-skip" onClick={() => setStep(4)}>Skip</button>
                <button className="btn-ob-next" onClick={() => setStep(4)}>Continue →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — First Goal */}
        {step === 4 && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="step-chip">Step 4 — First Goal</div>
              <h2>What do you want to achieve?</h2>
              <p>StriveX will build your smart daily schedule and show a live feasibility score.</p>
            </div>
            <div className="ob-form-group">
              <label>Goal title</label>
              <input type="text" placeholder="e.g. Master Python, Crack FAANG DSA" value={s4.title}
                onChange={e => setS4(s=>({...s, title: e.target.value}))} />
            </div>
            <div className="ob-form-group">
              <label>Description (optional)</label>
              <input type="text" placeholder="What does success look like?" value={s4.description}
                onChange={e => setS4(s=>({...s, description: e.target.value}))} />
            </div>
            <div className="time-row">
              <div className="ob-form-group">
                <label>📅 Deadline</label>
                <input type="date" value={s4.deadline} min={new Date().toISOString().split('T')[0]}
                  onChange={e => setS4(s=>({...s, deadline: e.target.value}))} />
              </div>
              <div className="ob-form-group">
                <label>⏱ Total hours needed</label>
                <input type="number" placeholder="e.g. 40" min="1" max="500" value={s4.totalHours}
                  onChange={e => setS4(s=>({...s, totalHours: e.target.value}))} />
              </div>
            </div>
            {feasPct !== null && (
              <div className={`feasibility-preview ${feasPct >= 70 ? 'risk-low' : feasPct >= 40 ? 'risk-medium' : 'risk-high'}`}>
                <div className="feas-score">{feasPct}%</div>
                <div className="feas-label">Feasibility Score</div>
                <div className="feas-msg">
                  {feasPct >= 70 ? '✅ Very achievable — great timeline!' : feasPct >= 40 ? '⚠️ Tight but doable if you stay consistent.' : '🚨 Very tight. Consider extending your deadline.'}
                </div>
              </div>
            )}
            <div className="ob-nav">
              <button className="btn-ob-back" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-ob-next" onClick={finish} disabled={loading}>
                {loading ? 'Building schedule…' : 'Launch StriveX 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
