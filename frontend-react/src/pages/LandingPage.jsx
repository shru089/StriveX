import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StriveXLogo from '../components/StriveXLogo'
import Toast, { showToast } from '../components/Toast'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { login, signup, continueAsGuest, loading, isAuthenticated } = useAuth()
  const [modal, setModal] = useState(null) // 'login' | 'signup' | null
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  // If already logged in, redirect
  useEffect(() => {
    if (!loading && isAuthenticated) {
      const u = JSON.parse(localStorage.getItem('sx_current_user') || '{}')
      navigate(u?.wake_time ? '/dashboard' : '/onboarding', { replace: true })
    }
  }, [isAuthenticated, loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (modal === 'login') await login(form.email, form.password)
      else await signup(form.email, form.password)
    } catch (err) {
      const msg = err?.response?.data?.error || 'Something went wrong'
      setError(msg)
      showToast(msg, 'error')
    }
  }

  const features = [
    { icon: '⚡', title: 'Replan My Day', desc: 'One button. StriveX reshuffles every remaining task around your current time — in under 2 seconds.', tag: 'PRD Core' },
    { icon: '⌨️', title: 'NLP Command Bar', desc: 'Press Ctrl+K and say "move gym to 6pm" or "add 2 hours deep work". Your schedule updates instantly.' },
    { icon: '📊', title: 'Feasibility Score', desc: 'Live 0–100% probability you\'ll hit your deadline. Color-coded risk levels with consequence messaging.' },
    { icon: '🧠', title: 'Behavioral Intelligence', desc: 'Tracks when you skip, hover, and start late. Builds a 30-day behavioral profile and auto-adjusts your schedule to match your real-world productivity patterns.', tag: 'Stage 4 · Live' },
    { icon: '🔥', title: 'XP & Levels', desc: 'Earn XP per completed task, maintain streaks, and level up. Difficulty multipliers reward hard work.' },
    { icon: '🔒', title: 'Privacy First', desc: 'Your behavioral data stays on your device. We never sell or share your productivity patterns.' },
  ]

  return (
    <div className="landing">
      <Toast />
      {/* Galaxy Background */}
      <div className="bg-galaxy" />
      <div className="bg-galaxy-2" />
      <div className="bg-nebula bg-nebula-1" />
      <div className="bg-nebula bg-nebula-2" />
      <div className="bg-nebula bg-nebula-3" />
      <div className="bg-grid" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <StriveXLogo size={28} />
          <span>StriveX</span>
        </div>
        <div className="nav-actions">
          <button className="nav-link" onClick={() => setModal('login')}>Sign In</button>
          <button className="nav-cta" onClick={() => setModal('signup')}>Get Started Free →</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            <span>Powered by Behavioral AI</span>
          </div>
          <h1 className="hero-title">
            The Decision Engine<br />
            <span className="hero-title-gradient">that runs your day.</span>
          </h1>
          <p className="hero-subtitle">
            StriveX eliminates decision fatigue. It breaks your goals into an intelligent daily schedule,
            adapts in real-time, and learns your productivity patterns —
            so you <strong>stop planning</strong> and <strong>start achieving</strong>.
          </p>
          <div className="cta-buttons">
            <button className="btn btn-primary" onClick={() => setModal('signup')}>
              Start Free — No Credit Card
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <button className="btn btn-secondary" onClick={continueAsGuest}>👤 Try as Guest</button>
          </div>
          <div className="hero-stats">
            {[['72%','Avg Goal Completion'],['< 2s','Replan Time'],['30-day','Behavioral Profile'],['0','Decisions to Make']].map(([n,l]) => (
              <div key={l} className="stat"><div className="stat-number">{n}</div><div className="stat-label">{l}</div></div>
            ))}
          </div>
        </div>

        {/* Hero Visual */}
        <div className="hero-visual">
          <div className="preview-card preview-main">
            <div className="preview-header">
              <div className="preview-dot red"/><div className="preview-dot amber"/><div className="preview-dot green"/>
              <span className="preview-title">Today's Schedule</span>
            </div>
            <div className="preview-body">
              <div className="preview-task done">
                <div className="preview-task-dot"/><div className="preview-task-info"><span>Python Basics: Functions</span><span className="preview-time">09:00 – 12:00</span></div><div className="preview-check">✓</div>
              </div>
              <div className="preview-task active">
                <div className="preview-task-dot active-dot"/><div className="preview-task-info"><span>Python: OOP Concepts</span><span className="preview-time">13:00 – 17:00</span></div>
                <div className="preview-progress-mini"><div className="preview-progress-fill" style={{width:'40%'}}/></div>
              </div>
              <div className="preview-task">
                <div className="preview-task-dot ghost-dot"/><div className="preview-task-info"><span>Practice Project 1</span><span className="preview-time">19:00 – 22:00</span></div><span className="preview-ghost">👻</span>
              </div>
            </div>
          </div>
          <div className="floating-card card-1"><div className="fc-icon">⚡</div><div className="fc-text"><div className="fc-title">Day Replanned</div><div className="fc-sub">3 tasks moved · 87% feasible</div></div></div>
          <div className="floating-card card-2"><div className="fc-icon">🧠</div><div className="fc-text"><div className="fc-title">Pattern Detected</div><div className="fc-sub">You focus best 9–11 AM</div></div></div>
          <div className="floating-card card-4"><div className="fc-icon">🔥</div><div className="fc-text"><div className="fc-title">14 Day Streak</div><div className="fc-sub">+150 XP today · Level 4</div></div></div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-section">
        <div className="section-label">How It Works</div>
        <h2 className="section-title">Three steps to <span className="gradient-text">zero decision fatigue</span></h2>
        <div className="steps-grid">
          {[
            { n:'01', icon:'🎯', t:'Set Your Goal', d:"Tell StriveX what you want to achieve and your deadline." },
            { n:'02', icon:'⚡', t:'Let It Decide', d:"Every morning your schedule is already made. Replan in under 2 seconds.", active: true },
            { n:'03', icon:'🧠', t:'It Learns You', d:"After 7 days, StriveX knows your peak hours and adapts automatically." },
          ].map((s, i) => (<>
            <div key={s.n} className={`step-card${s.active ? ' active' : ''}`}>
              <div className="step-number">{s.n}</div>
              <div className="step-icon">{s.icon}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
            {i < 2 && <div key={`conn-${i}`} className="step-connector" />}
          </>))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="section-label">Features</div>
        <h2 className="section-title">Everything a <span className="gradient-text">proactive OS</span> needs</h2>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className={`feature-card${f.tag ? ' feature-large' : ''}`}>
              <div className={f.tag ? 'feature-icon-large' : 'feature-icon'}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              {f.tag && <div className="feature-tag">{f.tag}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="proof-section">
        <div className="proof-cards">
          {[
            { q:'"Finally stopped missing deadlines. StriveX just tells me what to do."', name:'Arjun M.', role:'CS Student, 3rd Year', letter:'A' },
            { q:'"The replan button alone is worth it. My whole day reshuffles in 2 seconds."', name:'Shreya K.', role:'Product Manager', letter:'S', highlight: true },
            { q:'"Built a 21-day streak studying for DSA. The XP system makes it a game."', name:'Rohan D.', role:'SDE Prep', letter:'R' },
          ].map(p => (
            <div key={p.name} className={`proof-card${p.highlight ? ' proof-card-highlight' : ''}`}>
              <div className="proof-quote">{p.q}</div>
              <div className="proof-author">
                <div className="proof-avatar">{p.letter}</div>
                <div><div className="proof-name">{p.name}</div><div className="proof-role">{p.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-glow" />
        <h2>Stop deciding. Start doing.</h2>
        <p>Join thousands building real momentum — no subscriptions, no setup.</p>
        <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
          <button className="btn btn-primary btn-xl" onClick={() => setModal('signup')}>Start Free Today →</button>
          <button className="btn btn-secondary" onClick={continueAsGuest}>👤 Continue as Guest</button>
        </div>
      </section>

      {/* Auth Modal */}
      {modal && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-content">
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            <div className="auth-logo"><StriveXLogo size={32} /><span>StriveX</span></div>
            <h2>{modal === 'login' ? 'Welcome back' : 'Get started free'}</h2>
            <p className="form-subtitle">{modal === 'login' ? 'Sign in to continue your journey' : 'Your intelligent schedule is 60 seconds away'}</p>

            <div style={{display:'flex',gap:'8px',flexDirection:'column'}}>
              <button className="btn-google" onClick={() => { setModal(null); showToast('Configure GOOGLE_CLIENT_ID in backend/.env to enable Google Sign-In', 'info') }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
              <button className="btn-secondary" style={{width:'100%',padding:'10px',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',cursor:'pointer'}} onClick={() => { setModal(null); continueAsGuest() }}>👤 Continue as Guest — No account needed</button>
            </div>
            <div className="auth-divider"><span>or sign up with email</span></div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" required placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" required placeholder="••••••••" minLength={6} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
              </div>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Please wait…' : modal === 'login' ? 'Sign In →' : 'Create Account →'}
              </button>
            </form>
            <p className="form-switch">
              {modal === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <a href="#" onClick={e => { e.preventDefault(); setModal(modal === 'login' ? 'signup' : 'login') }}>
                {modal === 'login' ? 'Sign up free' : 'Sign in'}
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
