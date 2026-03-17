import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import InstallPrompt from './components/InstallPrompt'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import WorkCoachPage from './pages/WorkCoachPage'
import ProductivityZonePage from './pages/ProductivityZonePage'
import BillingPage from './pages/BillingPage'
import './styles/globals.css'

export default function App() {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts()

  return (
    <BrowserRouter>
      <AuthProvider>
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={
            <ProtectedRoute><OnboardingPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/work-coach" element={
            <ProtectedRoute><WorkCoachPage /></ProtectedRoute>
          } />
          <Route path="/focus-zone" element={
            <ProtectedRoute><ProductivityZonePage /></ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute><BillingPage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
