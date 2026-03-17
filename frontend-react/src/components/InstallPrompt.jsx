import { useState, useEffect } from 'react'
import './InstallPrompt.css'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show prompt after 5 seconds if not installed
      setTimeout(() => setShow(true), 5000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShow(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setShow(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('sx_dismissed_install', 'true')
  }

  if (!show || localStorage.getItem('sx_dismissed_install')) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-icon">📲</div>
        <div className="install-text">
          <strong>Install StriveX</strong>
          <p>Get the app experience on your home screen</p>
        </div>
        <div className="install-actions">
          <button className="install-btn" onClick={handleInstall}>Install</button>
          <button className="dismiss-btn" onClick={handleDismiss}>Not now</button>
        </div>
      </div>
    </div>
  )
}
