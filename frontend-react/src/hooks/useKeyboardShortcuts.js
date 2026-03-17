import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import db from '../db'
import { showToast } from '../components/Toast'

/**
 * Global keyboard shortcuts for StriveX
 * - Ctrl/Cmd + K: Quick search (future)
 * - Ctrl/Cmd + N: New task
 * - Ctrl/Cmd + D: Go to Dashboard
 * - Ctrl/Cmd + F: Go to Focus Zone
 * - Ctrl/Cmd + G: Go to Goals
 * - Ctrl/Cmd + T: Go to To-Do
 * - Ctrl/Cmd + C: Go to Calendar
 * - Ctrl/Cmd + E: Export data
 * - Ctrl/Cmd + H: Toggle Ghost Mode
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const mod = isMac ? e.metaKey : e.ctrlKey

      // Ctrl/Cmd + K: Quick action (placeholder for future search)
      if (mod && e.key === 'k') {
        e.preventDefault()
        showToast('⌨️ Keyboard shortcuts active! Press ? for help', 'info')
      }

      // Ctrl/Cmd + N: New task
      if (mod && e.key === 'n') {
        e.preventDefault()
        navigate('/dashboard?view=todo')
        setTimeout(() => {
          const input = document.querySelector('.task-quick-input')
          if (input) input.focus()
        }, 100)
        showToast('📝 Create new task', 'info')
      }

      // Ctrl/Cmd + D: Dashboard
      if (mod && e.key === 'd') {
        e.preventDefault()
        navigate('/dashboard?view=today')
        showToast('📊 Dashboard', 'success')
      }

      // Ctrl/Cmd + F: Focus Zone
      if (mod && e.key === 'f') {
        e.preventDefault()
        navigate('/focus-zone')
        showToast('🎯 Focus Zone', 'success')
      }

      // Ctrl/Cmd + G: Goals
      if (mod && e.key === 'g') {
        e.preventDefault()
        navigate('/dashboard?view=goals')
        showToast('🎯 Goals view', 'success')
      }

      // Ctrl/Cmd + T: To-Do
      if (mod && e.key === 't') {
        e.preventDefault()
        navigate('/dashboard?view=todo')
        showToast('✅ To-Do list', 'success')
      }

      // Ctrl/Cmd + C: Calendar
      if (mod && e.key === 'c') {
        e.preventDefault()
        navigate('/dashboard?view=calendar')
        showToast('📅 Calendar', 'success')
      }

      // Ctrl/Cmd + E: Export data
      if (mod && e.key === 'e') {
        e.preventDefault()
        exportAllData()
      }

      // Ctrl/Cmd + H: Ghost Mode (if on dashboard)
      if (mod && e.key === 'h') {
        e.preventDefault()
        const ghostBtn = document.querySelector('.btn-ghost')
        if (ghostBtn) ghostBtn.click()
        showToast('👻 Ghost Mode toggled', 'info')
      }

      // ?: Show shortcuts help
      if (e.key === '?' && !mod) {
        e.preventDefault()
        showShortcutsHelp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])
}

function exportAllData() {
  try {
    const data = {
      exported_at: new Date().toISOString(),
      todos: db.getTodos(),
      goals: db.getGoals(),
      schedule: db.getSchedule(),
      alarms: db.getAlarms(),
      profile: db.getProfile()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strivex-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    showToast('💾 Data exported successfully!', 'success')
  } catch (error) {
    showToast('❌ Export failed', 'error')
  }
}

function showShortcutsHelp() {
  const shortcuts = [
    { key: 'Ctrl+N', desc: 'New task' },
    { key: 'Ctrl+D', desc: 'Dashboard' },
    { key: 'Ctrl+F', desc: 'Focus Zone' },
    { key: 'Ctrl+G', desc: 'Goals' },
    { key: 'Ctrl+T', desc: 'To-Do' },
    { key: 'Ctrl+C', desc: 'Calendar' },
    { key: 'Ctrl+E', desc: 'Export data' },
    { key: 'Ctrl+H', desc: 'Ghost Mode' },
    { key: '?', desc: 'Show this help' }
  ]

  const helpText = `
⌨️ Keyboard Shortcuts:\n\n` +
    shortcuts.map(s => `${s.key.padEnd(10)} → ${s.desc}`).join('\n') +
    `\n\nPress any shortcut to activate`

  showToast(helpText, 'info', 8000)
}
