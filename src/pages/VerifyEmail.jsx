import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  // "Back to Login" must reach the login screen even if a stale session token
  // exists — otherwise <PublicRoute> bounces a logged-in user to the dashboard.
  // Clearing the session first guarantees the login form is shown.
  const backToLogin = () => {
    try { logout() } catch (e) { /* ignore */ }
    navigate('/login')
  }
  const params = new URLSearchParams(location.search)
  const initialEmail = location.state?.email || params.get('email') || ''
  const devCode = location.state?.devCode

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!email || !code) {
      setError('Enter your email and the 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    try {
      await axios.post('/api/auth/verify-email', { email: email.trim().toLowerCase(), code: code.trim() })
      toast.success('Email verified! Please log in.')
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || !email) {
      if (!email) setError('Enter your email first')
      return
    }
    try {
      const res = await axios.post('/api/auth/resend-verification', { email: email.trim().toLowerCase() })
      toast.success('A new code has been sent.')
      setCooldown(60)
      if (res.data?.devCode) toast(`Dev code: ${res.data.devCode}`, { icon: <Wrench size={18} strokeWidth={2} />, duration: 8000 })
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code.')
      if (err.response?.status === 429) setCooldown(60)
    }
  }

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-container">
        <div className="auth-card glass">
          <div className="auth-logo">
            <img src="/images/nextlevel-logo.jpg" alt="NEXT_LEVEL" className="auth-logo-img" />
            <h1 className="gradient-text">Verify Your Email</h1>
            <p className="tagline">Enter the 6-digit code we sent you</p>
          </div>

          {error && <div className="auth-error animate-fade-in">{error}</div>}
          {devCode && (
            <div
              className="auth-error animate-fade-in"
              style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
            >
              Dev mode — your code is <strong>{devCode}</strong>
            </div>
          )}

          <form className="auth-form" onSubmit={handleVerify}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
              />
            </div>

            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
              />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          <div className="auth-footer">
            Didn't get the code?{' '}
            <a
              onClick={handleResend}
              style={{
                color: cooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-primary)',
                fontWeight: 700,
                cursor: cooldown > 0 ? 'default' : 'pointer'
              }}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </a>
            <div style={{ marginTop: '8px' }}>
              <a onClick={backToLogin} style={{ color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}>Back to Login</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
