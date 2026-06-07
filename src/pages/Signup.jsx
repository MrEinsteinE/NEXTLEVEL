import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RadioTower, Zap, Cpu } from 'lucide-react'
import './Auth.css'

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [branch, setBranch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signup } = useAuth()

  const branches = [
    { id: 'ECE', label: 'ECE', full: 'Electronics & Communication', Icon: RadioTower },
    { id: 'EE', label: 'EE', full: 'Electrical Engineering', Icon: Zap },
    { id: 'CSE', label: 'CSE', full: 'Computer Science', Icon: Cpu },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password || !confirmPassword || !branch) {
      setError('Please fill in all fields and select your branch')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    const res = await signup({
      name,
      email: email.trim().toLowerCase(),
      password,
      branch
    })
    setLoading(false)

    if (!res.success) {
      setError(res.error || 'Signup failed. Please try again.')
      return
    }
    // Account created (not logged in) — go verify the email.
    navigate('/verify-email', { state: { email: email.trim().toLowerCase(), devCode: res.devCode } })
  }

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-container">
        <div className="auth-card glass">
          <div className="auth-logo">
            <img src="/images/nextlevel-logo.jpg" alt="NEXT_LEVEL" className="auth-logo-img" />
            <h1 className="gradient-text">NEXT_LEVEL</h1>
            <p className="tagline">Personal Guidance by Bhima Sankar Sir</p>
          </div>

          {error && <div className="auth-error animate-fade-in">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
              />
            </div>

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
              <label>Password</label>
              <input
                type="password"
                placeholder="Create a password (min 8 characters)"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
              />
            </div>

            <div className="form-group">
              <label>Select Your Branch</label>
              <div className="branch-selector">
                {branches.map(b => (
                  <div
                    key={b.id}
                    className={`branch-option ${branch === b.id ? 'selected' : ''}`}
                    onClick={() => { setBranch(b.id); setError('') }}
                  >
                    <span className="branch-icon"><b.Icon size={22} strokeWidth={2} /></span>
                    <strong>{b.label}</strong>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Registering...' : 'Request Mentorship'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup
