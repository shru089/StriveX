import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast, { showToast } from '../components/Toast'
import db from '../db'
import './ProductivityZonePage.css'

// ── Scenes with animation types and icons ────────────────────────────────────
const SCENES = [
  { id: 'dark',    label: 'Cosmos',     icon: '🌌', gradient: 'linear-gradient(135deg, #0d0d1a 0%, #1a0d2e 50%, #0d1a27 100%)', animType: 'stars' },
  { id: 'aurora',  label: 'Aurora',     icon: '✨', gradient: 'linear-gradient(135deg, #0a1628 0%, #0d2b1e 40%, #1a0d2e 100%)', animType: 'aurora' },
  { id: 'sunset',  label: 'Sunset',     icon: '🌅', gradient: 'linear-gradient(135deg, #1a0a0a 0%, #2e1500 50%, #1a0d2e 100%)', animType: 'particles' },
  { id: 'ocean',   label: 'Ocean',      icon: '🌊', gradient: 'linear-gradient(135deg, #040d1a 0%, #0a1e2e 50%, #041a2e 100%)', animType: 'waves' },
  { id: 'forest',  label: 'Forest',     icon: '🌲', gradient: 'linear-gradient(135deg, #040d0a 0%, #0a1e14 50%, #040d0a 100%)', animType: 'fireflies' },
  { id: 'cafe',    label: 'Café',       icon: '☕', gradient: 'linear-gradient(135deg, #1a1208 0%, #2e2010 50%, #1a1208 100%)', animType: 'steam' },
]

// ── Sound channels (procedural Web Audio) with improved icons ────────────────
const SOUNDS = [
  { id: 'rain',   label: 'Rain',     icon: '🌧️', color: '#60a5fa', desc: 'Gentle rainfall' },
  { id: 'white',  label: 'White',    icon: '💫', color: '#e5e7eb', desc: 'Neutral noise' },
  { id: 'brown',  label: 'Brown',    icon: '🍂', color: '#a16207', desc: 'Deep rumble' },
  { id: 'fire',   label: 'Fire',     icon: '🔥', color: '#f97316', desc: 'Crackling flames' },
  { id: 'forest', label: 'Forest',   icon: '🦗', color: '#22c55e', desc: 'Nature sounds' },
  { id: 'waves',  label: 'Waves',    icon: '🌊', color: '#0ea5e9', desc: 'Ocean waves' },
]

// ── Web Audio noise generator - Enhanced for better quality ─────────────────
function makeNoise(ctx, type) {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(2, sr * 5, sr) // Stereo buffer
  const dL = buf.getChannelData(0)
  const dR = buf.getChannelData(1)
  
  if (type === 'white' || type === 'rain') {
    for (let i = 0; i < dL.length; i++) {
      dL[i] = Math.random() * 2 - 1
      dR[i] = Math.random() * 2 - 1
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type === 'rain' ? 'bandpass' : 'highshelf'
    if (type === 'rain') { 
      f.frequency.value = 3000
      f.Q.value = 0.7 
    } else { 
      f.frequency.value = 5000
      f.gain.value = -10 
    }
    src.connect(f)
    return { src, out: f }
  }
  
  if (type === 'brown') {
    let lastL = 0, lastR = 0
    for (let i = 0; i < dL.length; i++) {
      const wL = Math.random() * 2 - 1
      const wR = Math.random() * 2 - 1
      dL[i] = (lastL + 0.02 * wL) / 1.02
      dR[i] = (lastR + 0.02 * wR) / 1.02
      lastL = dL[i]
      lastR = dR[i]
      dL[i] *= 4.5
      dR[i] *= 4.5
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 500
    f.Q.value = 0.5
    src.connect(f)
    return { src, out: f }
  }
  
  if (type === 'fire') {
    // Pink noise for fire crackling
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0
    for (let i = 0; i < dL.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.76160 * b5 - w * 0.0168980
      dL[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.12
      dR[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.12
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = 400
    f.gain.value = 6
    f.Q.value = 1.2
    src.connect(f)
    return { src, out: f }
  }
  
  if (type === 'forest') {
    // Softer pink noise for nature
    let b0=0, b1=0, b2=0
    for (let i = 0; i < dL.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.998 * b0 + w * 0.06
      b1 = 0.993 * b1 + w * 0.08
      b2 = 0.970 * b2 + w * 0.16
      dL[i] = (b0 + b1 + b2 + w * 0.5) * 0.15
      dR[i] = (b0 + b1 + b2 + w * 0.5) * 0.15
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = 1200
    f.gain.value = -3
    src.connect(f)
    return { src, out: f }
  }
  
  // waves - using modulated sine waves
  for (let i = 0; i < dL.length; i++) {
    const t = i / sr
    const wave1 = Math.sin(2 * Math.PI * 0.1 * t + Math.sin(2 * Math.PI * 0.03 * t) * 3)
    const wave2 = Math.sin(2 * Math.PI * 0.15 * t + Math.sin(2 * Math.PI * 0.02 * t) * 2)
    dL[i] = (wave1 + wave2) * 0.3 * (0.5 + 0.5 * Math.random())
    dR[i] = (wave1 - wave2) * 0.3 * (0.5 + 0.5 * Math.random())
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 600
  f.Q.value = 0.8
  src.connect(f)
  return { src, out: f }
}

// ── Alarm Audio: plays a gentle bell tone ────────────────────────────────────
function playAlarmTone(ctx) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5)
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 2)
  // Ring 3 times
  setTimeout(() => playAlarmTone(ctx), 2200)
  setTimeout(() => playAlarmTone(ctx), 4400)
}

// ── Enhanced Canvas particle background with mouse interaction ────────────────
function useParticles(canvasRef, scene) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let mouseX = 0, mouseY = 0
    
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    
    // Track mouse
    const handleMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    canvas.addEventListener('mousemove', handleMouseMove)
    
    // Particle config based on scene
    const getConfig = () => {
      switch(scene?.animType) {
        case 'stars': return { count: 150, speed: 0.3, size: [0.5, 2], connection: true }
        case 'aurora': return { count: 80, speed: 0.5, size: [1, 3], connection: false, drift: true }
        case 'particles': return { count: 100, speed: 0.4, size: [1, 2.5], connection: true }
        case 'waves': return { count: 60, speed: 0.6, size: [2, 4], connection: false, wave: true }
        case 'fireflies': return { count: 120, speed: 0.2, size: [1, 2], connection: false, glow: true }
        case 'steam': return { count: 40, speed: 0.15, size: [2, 5], connection: false, rise: true }
        default: return { count: 100, speed: 0.3, size: [1, 2], connection: true }
      }
    }
    
    const config = getConfig()
    const particles = Array.from({ length: config.count }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * (config.size[1] - config.size[0]) + config.size[0],
      vx: (Math.random() - 0.5) * config.speed,
      vy: config.rise ? -Math.random() * config.speed * 0.5 : (Math.random() - 0.5) * config.speed,
      opacity: Math.random() * 0.5 + 0.3,
      phase: Math.random() * Math.PI * 2,
      originalY: Math.random() * window.innerHeight
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach((p, i) => {
        // Movement
        if (config.wave) {
          p.x += Math.sin(p.phase) * 0.3
          p.y += Math.cos(p.phase) * 0.2
          p.phase += 0.02
        } else if (config.drift) {
          p.x += Math.sin(Date.now() * 0.001 + p.phase) * 0.5
          p.y += p.vy
        } else {
          p.x += p.vx
          p.y += p.vy
        }
        
        // Mouse interaction - particles flee from cursor
        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150) {
          const angle = Math.atan2(dy, dx)
          p.x -= Math.cos(angle) * 2
          p.y -= Math.sin(angle) * 2
        }
        
        // Wrap around screen
        if (p.x < -50) p.x = canvas.width + 50
        if (p.x > canvas.width + 50) p.x = -50
        if (p.y < -50) p.y = canvas.height + 50
        if (p.y > canvas.height + 50) p.y = -50
        
        // Draw particle
        ctx.beginPath()
        if (config.glow) {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2)
          gradient.addColorStop(0, `rgba(160, 200, 100, ${p.opacity})`)
          gradient.addColorStop(1, 'rgba(160, 200, 100, 0)')
          ctx.fillStyle = gradient
          ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2)
        } else {
          ctx.fillStyle = `rgba(160, 180, 255, ${p.opacity})`
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        }
        ctx.fill()
        
        // Draw connections
        if (config.connection) {
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j]
            const dx = p.x - p2.x
            const dy = p.y - p2.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 120) {
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
              ctx.lineTo(p2.x, p2.y)
              ctx.strokeStyle = `rgba(160, 180, 255, ${0.15 * (1 - dist / 120)})`
              ctx.lineWidth = 0.5
              ctx.stroke()
            }
          }
        }
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouseMove)
    }
  }, [scene])
}

// ── Draggable wrapper ─────────────────────────────────────────────────────────
function Draggable({ children, defaultPos }) {
  const [pos, setPos] = useState(defaultPos)
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    const sx = e.clientX - pos.x, sy = e.clientY - pos.y
    const move = (ev) => setPos({ x: ev.clientX - sx, y: ev.clientY - sy })
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }, [pos])
  return <div style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 10 }}>{children({ onDrag: onMouseDown })}</div>
}

// ── Pomodoro Widget ───────────────────────────────────────────────────────────
function PomodoroWidget({ onDrag }) {
  const [mode, setMode] = useState('focus')
  const [secs, setSecs] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const ivRef = useRef()
  const MODES = { focus: 25*60, short: 5*60, long: 15*60 }
  const total = MODES[mode], pct = secs / total * 100
  const circ = 2 * Math.PI * 52
  const dash = circ * (1 - pct/100)
  const mins = String(Math.floor(secs/60)).padStart(2,'0')
  const s = String(secs % 60).padStart(2,'0')

  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => setSecs(x => {
        if (x <= 1) { 
          clearInterval(ivRef.current) 
          setRunning(false)
          showToast(mode === 'focus' ? '🍅 Session done!' : '⏰ Break over!', 'success')
          if(mode==='focus') {
            setSessions(n=>n+1)
            // Play completion sound
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
              osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
              osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2) // G5
              gain.gain.setValueAtTime(0.3, ctx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
              osc.start()
              osc.stop(ctx.currentTime + 0.6)
            } catch(e) { console.log('Audio play failed:', e) }
          }
          return 0 
        }
        return x - 1
      }), 1000)
    } else clearInterval(ivRef.current)
    return () => clearInterval(ivRef.current)
  }, [running, mode])

  const switchMode = (m) => { setMode(m); setSecs(MODES[m]); setRunning(false); clearInterval(ivRef.current) }

  return (
    <div className="pz-widget liquid-widget" onMouseDown={onDrag}>
      <div className="pz-handle">⠿ Pomodoro</div>
      <div className="pz-mode-tabs">
        {[['focus','🍅'],['short','😌'],['long','🛌']].map(([m,ic]) => (
          <button key={m} className={`pz-tab${mode===m?' active':''}`} onClick={() => switchMode(m)}>{ic} {m}</button>
        ))}
      </div>
      <div className="pz-ring">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
          <circle cx="65" cy="65" r="52" fill="none" stroke="url(#pomG)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={dash} transform="rotate(-90 65 65)"
            style={{transition:'stroke-dashoffset 1s linear'}}/>
          <defs><linearGradient id="pomG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#667eea"/><stop offset="100%" stopColor="#f093fb"/>
          </linearGradient></defs>
        </svg>
        <div className="pz-timer">{mins}:{s}</div>
      </div>
      <div className="pz-sessions">{[...Array(4)].map((_,i)=><div key={i} className={`pz-pip${i<sessions%4?' lit':''}`}/>)}</div>
      <div className="pz-controls">
        <button className="pz-btn-sm" onClick={() => { setSecs(MODES[mode]); setRunning(false) }}>↺</button>
        <button className="pz-btn-play" onClick={() => setRunning(r => !r)}>{running ? '⏸' : '▶'}</button>
        <button className="pz-btn-sm" onClick={() => switchMode(mode==='focus'?'short':'focus')}>⏭</button>
      </div>
    </div>
  )
}

// ── Clock + Alarm Widget ──────────────────────────────────────────────────────
function ClockWidget({ onDrag, audioCtx }) {
  const [time, setTime] = useState(new Date())
  const [alarms, setAlarms] = useState(() => db.getAlarms())
  const [alarmTime, setAlarmTime] = useState('')
  const [alarmLabel, setAlarmLabel] = useState('')
  const [ringing, setRinging] = useState(null)

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date()
      setTime(now)
      const cur = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const fresh = db.getAlarms()
      setAlarms(fresh)
      const triggered = fresh.find(a => !a.done && a.time === cur)
      if (triggered) {
        db.dismissAlarm(triggered.id)
        setRinging(triggered)
        if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); playAlarmTone(audioCtx) }
        if (Notification?.permission === 'granted') new Notification(`⏰ ${triggered.label || 'Alarm'}`)
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [audioCtx])

  const h = time.getHours()%12, m = time.getMinutes(), sec = time.getSeconds()

  const addAlarm = () => {
    if (!alarmTime) return
    if (Notification?.permission === 'default') Notification.requestPermission()
    db.addAlarm({ time: alarmTime, label: alarmLabel || 'Alarm' })
    setAlarms(db.getAlarms())
    showToast(`⏰ Alarm set for ${alarmTime}`, 'success')
    setAlarmTime(''); setAlarmLabel('')
  }

  return (
    <>
      {ringing && (
        <div className="alarm-ring-modal" onClick={() => setRinging(null)}>
          <div className="alarm-ring-inner">
            <div className="alarm-ring-icon">⏰</div>
            <div className="alarm-ring-label">{ringing.label}</div>
            <button>Dismiss</button>
          </div>
        </div>
      )}
      <div className="pz-widget pz-clock liquid-widget" onMouseDown={onDrag}>
        <div className="pz-handle">⠿ Clock</div>
        <svg className="clock-svg" viewBox="0 0 100 100">
          {[...Array(12)].map((_,i) => {
            const a=(i*30)*Math.PI/180
            return <line key={i} x1={50+44*Math.sin(a)} y1={50-44*Math.cos(a)} x2={50+40*Math.sin(a)} y2={50-40*Math.cos(a)} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
          })}
          <line x1="50" y1="50" x2={50+24*Math.sin(h*30*Math.PI/180+(m*0.5)*Math.PI/180)} y2={50-24*Math.cos(h*30*Math.PI/180+(m*0.5)*Math.PI/180)} stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
          <line x1="50" y1="50" x2={50+34*Math.sin(m*6*Math.PI/180)} y2={50-34*Math.cos(m*6*Math.PI/180)} stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="50" y1="50" x2={50+37*Math.sin(sec*6*Math.PI/180)} y2={50-37*Math.cos(sec*6*Math.PI/180)} stroke="#667eea" strokeWidth="1" strokeLinecap="round"/>
          <circle cx="50" cy="50" r="2" fill="#fff"/>
        </svg>
        <div className="pz-digital">{String(time.getHours()).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(sec).padStart(2,'0')}</div>
        <div className="pz-date">{time.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
        <div className="pz-alarm-add">
          <input type="time" value={alarmTime} onChange={e => setAlarmTime(e.target.value)} className="pz-alarm-input" />
          <input type="text" placeholder="Label" value={alarmLabel} onChange={e => setAlarmLabel(e.target.value)} className="pz-alarm-input" style={{flex:1}} onMouseDown={e => e.stopPropagation()} />
          <button className="pz-alarm-set" onClick={addAlarm}>Set</button>
        </div>
        {alarms.filter(a=>!a.done).slice(0,3).map(a => (
          <div key={a.id} className="pz-alarm-item">⏰ {a.time} — {a.label}</div>
        ))}
      </div>
    </>
  )
}

// ── Sound Mixer Widget ────────────────────────────────────────────────────────
function SoundWidget({ onDrag }) {
  const ctxRef = useRef(null)
  const masterRef = useRef(null)
  const nodesRef = useRef({})
  const [vols, setVols] = useState(() => Object.fromEntries(SOUNDS.map(s => [s.id, 0.3])))
  const [active, setActive] = useState(() => Object.fromEntries(SOUNDS.map(s => [s.id, false])))
  const [master, setMaster] = useState(0.7)

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      masterRef.current = ctxRef.current.createGain()
      masterRef.current.gain.value = master
      masterRef.current.connect(ctxRef.current.destination)
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  const toggle = (id, type) => {
    if (active[id]) {
      nodesRef.current[id]?.src?.stop()
      nodesRef.current[id]?.out?.disconnect()
      delete nodesRef.current[id]
      setActive(a => ({...a, [id]: false}))
      showToast(`🔇 ${SOUNDS.find(s => s.id === id)?.label} disabled`, 'info')
    } else {
      const ctx = getCtx()
      try {
        const { src, out } = makeNoise(ctx, type)
        const gainNode = ctx.createGain()
        gainNode.gain.value = vols[id]
        out.connect(gainNode)
        gainNode.connect(masterRef.current)
        src.start(0)
        nodesRef.current[id] = { src, out, gainNode }
        setActive(a => ({...a, [id]: true}))
        showToast(`🔊 ${SOUNDS.find(s => s.id === id)?.label} enabled`, 'success')
      } catch(e) { 
        console.error('Audio error:', e)
        showToast('❌ Failed to play sound', 'error')
      }
    }
  }

  const setVol = (id, v) => {
    setVols(vs => ({...vs, [id]: v}))
    if (nodesRef.current[id]) nodesRef.current[id].gainNode.gain.value = v
  }

  return (
    <div className="pz-widget pz-sound liquid-widget" onMouseDown={onDrag}>
      <div className="pz-handle">⠿ Ambient Sounds</div>
      <div className="pz-sound-grid">
        {SOUNDS.map(s => (
          <div key={s.id} className="pz-sound-ch">
            <button 
              className={`pz-sound-btn${active[s.id]?' active':''}`}
              onClick={() => toggle(s.id, s.id)}
              style={active[s.id] ? { borderColor: s.color, boxShadow: `0 0 16px ${s.color}44`, background: `rgba(${s.color === '#60a5fa' ? '96,165,250' : s.color === '#e5e7eb' ? '229,231,235' : s.color === '#a16207' ? '161,98,7' : s.color === '#f97316' ? '249,115,22' : s.color === '#22c55e' ? '34,197,94' : '14,165,233'},0.15)` } : {}}>
              <span style={{fontSize: '16px'}}>{s.icon}</span>
              <span>{s.label}</span>
              {active[s.id] && <span className="pz-sound-dot" style={{background:s.color, boxShadow: `0 0 8px ${s.color}`}}/>}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={vols[s.id]}
              onChange={e => setVol(s.id, +e.target.value)} className="pz-slider"
              onMouseDown={e => e.stopPropagation()} />
          </div>
        ))}
      </div>
      <div className="pz-master">
        <span>🔊</span>
        <input type="range" min="0" max="1" step="0.05" value={master}
          onChange={e => { setMaster(+e.target.value); if(masterRef.current) masterRef.current.gain.value = +e.target.value }}
          className="pz-slider" onMouseDown={e => e.stopPropagation()} />
      </div>
    </div>
  )
}

// ── Quick Todo Widget ─────────────────────────────────────────────────────────
function QuickTodoWidget({ onDrag }) {
  const [todos, setTodos] = useState(() => db.getTodos().slice(0,10))
  const [input, setInput] = useState('')

  const add = () => {
    if (!input.trim()) return
    db.addTodo({ title: input.trim(), priority: 2 })
    setTodos(db.getTodos().slice(0,10))
    setInput('')
  }

  const toggle = (id) => {
    const t = todos.find(x => x.id === id)
    if (t) db.updateTodo(id, { completed: !t.completed })
    setTodos(db.getTodos().slice(0,10))
  }

  return (
    <div className="pz-widget pz-todo liquid-widget" onMouseDown={onDrag}>
      <div className="pz-handle">⠿ Quick Tasks</div>
      <div className="pz-todo-add">
        <input className="pz-todo-input" placeholder="Add task…" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&add()}
          onMouseDown={e => e.stopPropagation()} />
        <button className="pz-todo-btn" onClick={add}>+</button>
      </div>
      {todos.map(t => (
        <div key={t.id} className={`pz-todo-item${t.completed?' done':''}`} onClick={() => toggle(t.id)}>
          <div className="pz-todo-cb">{t.completed?'✓':''}</div>
          <span>{t.title}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductivityZonePage() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [scene, setScene] = useState(SCENES[0])
  const [widgets, setWidgets] = useState({ pomodoro: true, clock: true, sound: true, todo: false })
  const audioCtxRef = useRef(null)

  // Pomodoro persistence
  useEffect(() => {
    const saved = localStorage.getItem('sx_pomodoro')
    if (saved) {
      const data = JSON.parse(saved)
      setMode(data.mode || 'focus')
      setSecs(data.secs || 25 * 60)
      setRunning(data.running || false)
      setSessions(data.sessions || 0)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('sx_pomodoro', JSON.stringify({ mode, secs, running, sessions }))
  }, [mode, secs, running, sessions])

  useParticles(canvasRef, scene)

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    return audioCtxRef.current
  }

  return (
    <div className="pz-page" style={{ background: scene.gradient }}>
      <Toast />
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pz-canvas" />
      {/* Ambient glow orbs */}
      <div className="pz-orb pz-orb-1" />
      <div className="pz-orb pz-orb-2" />
      <div className="pz-orb pz-orb-3" />

      {/* Widgets */}
      {widgets.pomodoro && <Draggable defaultPos={{x:40,y:70}}>{p=><PomodoroWidget {...p}/>}</Draggable>}
      {widgets.clock    && <Draggable defaultPos={{x:680,y:70}}>{p=><ClockWidget {...p} audioCtx={getAudioCtx()}/>}</Draggable>}
      {widgets.sound    && <Draggable defaultPos={{x:40,y:500}}>{p=><SoundWidget {...p}/>}</Draggable>}
      {widgets.todo     && <Draggable defaultPos={{x:680,y:400}}>{p=><QuickTodoWidget {...p}/>}</Draggable>}

      {/* Dock */}
      <div className="pz-dock liquid-dock">
        <button className="pz-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        
        <div className="pz-scenes">
          {SCENES.map(s => (
            <button key={s.id} className={`pz-scene${scene.id===s.id?' active':''}`}
              onClick={() => setScene(s)}>
              <span style={{fontSize: '16px'}}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="pz-widget-toggles">
          {[['pomodoro','🍅','Pomodoro'],['clock','🕐','Clock'],['sound','🎵','Sounds'],['todo','✅','Tasks']].map(([k,ic,lb]) => (
            <button key={k} className={`pz-toggle${widgets[k]?' active':''}`}
              onClick={() => setWidgets(w=>({...w,[k]:!w[k]}))} title={lb}>{ic}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
