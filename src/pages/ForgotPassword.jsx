import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1: Email, 2: New Password
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const navigate = useNavigate()
  const { logout } = useAuth()

  // If arriving from the emailed reset link (/forgot-password?token=…), jump to step 2.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    if (t) { setResetToken(t); setStep(2) }
  }, [])

  // Reach login even if a session token exists (otherwise <PublicRoute> bounces).
  const backToLogin = () => {
    try { logout() } catch (e) { /* ignore */ }
    navigate('/login')
  }

  const handleCheckEmail = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post('/api/auth/forgot-password', {
        email: email.trim().toLowerCase()
      })
      setError('')
      if (response.data.resetToken) {
        // Local dev (no email configured): proceed straight to the reset step.
        setResetToken(response.data.resetToken)
        setMessage('')
        setStep(2)
      } else {
        setMessage(response.data.message || 'Reset link sent to your email. Open it to set a new password.')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No account found with this email.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token') || resetToken
    if (!token) {
      setError('Please open the reset link from your email to continue.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await axios.post('/api/auth/reset-password', { token, newPassword })
      setMessage('Password reset successful! Redirecting to login...')
      setTimeout(() => {
        navigate('/login')
      }, 1800)
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed or the link expired. Please request a new link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-container">
        <div className="auth-card glass">
          <div className="auth-logo">
            <img src="/images/nextlevel-logo.jpg" alt="NEXT_LEVEL" className="auth-logo-img" />
            <h1 className="gradient-text">Reset Password</h1>
            <p className="tagline">Recover your NEXT_LEVEL account</p>
          </div>

          {error && <div className="auth-error animate-fade-in">{error}</div>}
          {message && <div className="glass" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '20px', fontSize: '14px', fontWeight: '700', border: '1px solid var(--color-success)' }}>{message}</div>}

          {step === 1 ? (
            <form className="auth-form" onSubmit={handleCheckEmail}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleReset}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            Remembered your password? <a onClick={backToLogin} style={{ fontWeight: '700', cursor: 'pointer', color: 'var(--color-primary)' }}>Back to Login</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
