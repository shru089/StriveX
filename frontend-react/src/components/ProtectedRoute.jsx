import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, isGuest, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'rgba(255,255,255,0.4)'}}>Loading…</div>
  // Allow both logged-in users AND guests
  if (!user && !isGuest) return <Navigate to="/" replace />
  return children
}
