import './PendingApproval.css'
import { useNavigate } from 'react-router-dom'
import { Clock, Mail, Phone, BookOpen, Play, Globe, Send, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { mentorInfo } from '../data/platformData.js'

function PendingApproval() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  // A pending user is logged in, so a plain link to /login gets bounced straight
  // back here by <PublicRoute>. Log out first so the login screen is reachable.
  const backToLogin = () => {
    try { logout() } catch (e) { /* ignore */ }
    navigate('/login')
  }

  return (
    <div className="pending-page animate-fade-in">
      <div className="pending-card glass">
        <div className="pending-icon-animated">
          <span className="pending-clock"><Clock size={64} strokeWidth={2} /></span>
        </div>
        <h1 className="gradient-text">Mentorship Request Submitted</h1>
        <p className="pending-message">
          Your mentorship request is under review by <strong>Bhima Sankar Sir</strong>.
        </p>
        <p className="pending-detail">
          You will receive an email notification once your account is approved. 
          Only approved students can access the NEXT_LEVEL dashboard and all features.
        </p>
        <div className="pending-info">
          <div className="info-item glass">
            <span className="info-icon"><Mail size={18} strokeWidth={2} /></span>
            <span>Check your email for updates</span>
          </div>
          <div className="info-item glass">
            <span className="info-icon"><Clock size={18} strokeWidth={2} /></span>
            <span>Typically approved within 24 hours</span>
          </div>
          <div className="info-item glass">
            <span className="info-icon"><Phone size={18} strokeWidth={2} /></span>
            <span>Contact: {mentorInfo.phone}</span>
          </div>
        </div>

        {/* Community Resources */}
        <div className="pending-resources">
          <h3 className="gradient-text" style={{ fontSize: '14px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BookOpen size={16} strokeWidth={2} /> While you wait, explore these resources:</h3>
          <div className="pending-links">
            <a href={mentorInfo.links.youtube} target="_blank" rel="noopener noreferrer" className="pending-resource-btn youtube">
              <Play size={15} strokeWidth={2} /> YouTube
            </a>
            <a href={mentorInfo.links.website} target="_blank" rel="noopener noreferrer" className="pending-resource-btn website">
              <Globe size={15} strokeWidth={2} /> Website
            </a>
            <a href={mentorInfo.links.telegram} target="_blank" rel="noopener noreferrer" className="pending-resource-btn telegram">
              <Send size={15} strokeWidth={2} /> Telegram
            </a>
            <a href={mentorInfo.links.whatsapp} target="_blank" rel="noopener noreferrer" className="pending-resource-btn whatsapp">
              <MessageCircle size={15} strokeWidth={2} /> WhatsApp
            </a>
          </div>
        </div>

        <a onClick={backToLogin} className="pending-back-btn" style={{ cursor: 'pointer' }}>← Back to Login</a>
      </div>
    </div>
  )
}

export default PendingApproval
