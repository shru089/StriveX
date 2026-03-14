import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import db from '../db'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const savedUser = localStorage.getItem('sx_current_user')
    if (token && savedUser) {
      try {
        const u = JSON.parse(savedUser)
        setUser(u)
        // Hydrate localStorage from backend in background
        db.hydrateFromCloud().catch(() => {})
      } catch { localStorage.removeItem('sx_current_user') }
    } else {
      // Check if guest session active
      const guestActive = localStorage.getItem('sx_guest_mode') === '1'
      if (guestActive) setIsGuest(true)
    }
    setLoading(false)
  }, [])

  /** Start as guest — no sign in needed */
  const continueAsGuest = () => {
    localStorage.setItem('sx_guest_mode', '1')
    setIsGuest(true)
    navigate('/dashboard')
  }

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', res.data.access_token)
    if (res.data.refresh_token) localStorage.setItem('refresh_token', res.data.refresh_token)
    const u = res.data.user
    setUser(u)
    setIsGuest(false)
    localStorage.removeItem('sx_guest_mode')
    localStorage.setItem('sx_current_user', JSON.stringify(u))
    // Hydrate cloud data into localStorage
    await db.hydrateFromCloud()
    if (!u.onboarding_complete) navigate('/onboarding')
    else navigate('/dashboard')
    return u
  }

  const signup = async (email, password) => {
    const res = await api.post('/auth/register', { email, password })
    localStorage.setItem('access_token', res.data.access_token)
    if (res.data.refresh_token) localStorage.setItem('refresh_token', res.data.refresh_token)
    const u = res.data.user
    setUser(u)
    setIsGuest(false)
    localStorage.removeItem('sx_guest_mode')
    localStorage.setItem('sx_current_user', JSON.stringify(u))
    navigate('/onboarding')
    return u
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('sx_current_user')
    localStorage.removeItem('sx_guest_mode')
    setUser(null)
    setIsGuest(false)
    navigate('/')
  }

  const updateUser = (u) => {
    setUser(u)
    localStorage.setItem('sx_current_user', JSON.stringify(u))
  }

  const isAuthenticated = Boolean(user || isGuest)

  return (
    <AuthContext.Provider value={{ user, isGuest, loading, isAuthenticated, login, signup, logout, updateUser, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  )
}
