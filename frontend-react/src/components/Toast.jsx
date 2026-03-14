import { useState, useCallback } from 'react'
import './Toast.css'

let _showToast = null
export const showToast = (msg, type = 'info') => _showToast?.(msg, type)

export default function Toast() {
  const [toast, setToast] = useState(null)

  _showToast = useCallback((msg, type) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  if (!toast) return null
  return (
    <div className={`toast toast-${toast.type}`}>
      {toast.msg}
    </div>
  )
}
