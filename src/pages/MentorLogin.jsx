import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import './Auth.css'

function MentorLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user.role === 'mentor') {
      navigate('/mentor-dashboard')
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post('/api/auth/mentor-login', {
        email: email.trim().toLowerCase(),
        password
      })

      const { token, user } = response.data

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      navigate('/mentor-dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid mentor credentials. Please check your email/password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page mentor-auth animate-fade-in">
      <div className="auth-container">
        <div className="auth-card glass">
          <div className="auth-logo">
            <img src="/images/nextlevel-logo.jpg" alt="NEXT_LEVEL" className="auth-logo-img" />
            <h1 className="gradient-text">Mentor Portal</h1>
            <p className="tagline">Personal Guidance Dashboard — Bhima Sankar Sir</p>
          </div>

          {error && <div className="auth-error animate-fade-in">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Mentor Email</label>
              <input
                type="email"
                placeholder="sankar.bhima@gmail.com"
                value={email}
                required
                onChange={(e) => { setEmail(e.target.value); setError('') }}
              />
            </div>

            <div className="form-group">
              <label>Master Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                required
                onChange={(e) => { setPassword(e.target.value); setError('') }}
              />
            </div>

            <button type="submit" className="auth-submit mentor-submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>

          <div className="auth-footer">
            <Link to="/login" style={{ fontWeight: '700', color: 'var(--color-primary)' }}>Back to Student Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MentorLogin
