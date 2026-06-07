import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Phone, BookMarked, PenLine, Target, Globe, Star, Play, Send, MessageCircle, Sparkles, Heart } from 'lucide-react'
import { mentorInfo } from '../data/platformData.js'
import api from '../utils/api'
import StoryDetailModal from '../components/stories/StoryDetailModal.jsx'
import './MentorProfilePage.css'

const shareBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '11px 22px', borderRadius: '12px', background: 'var(--gradient-primary)',
  color: '#fff', fontWeight: 800, textDecoration: 'none',
  boxShadow: '0 8px 20px rgba(108,99,255,.3)'
}

function MentorProfilePage() {
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [activeStory, setActiveStory] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/stories')
        if (cancelled) return
        const approved = (res.data.stories || []).filter(s => s.isApproved || s.status === 'approved')
        setStories(approved)
      } catch (e) {
        /* not logged in or fetch failed — fall back to the share CTA */
      } finally {
        if (!cancelled) setStoriesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mentor-page animate-fade-in">
      <div className="mentor-page-header glass">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
        <h1 className="gradient-text">Mentor Profile</h1>
      </div>

      <div className="mentor-hero glass">
        <div className="mentor-photo-section">
          <div className="mentor-photo-frame">
            <img src="/images/bhimasir-mentor.jpg" alt="Bhima Sankar Sir" className="mentor-photo-large" />
          </div>
          <h2 className="gradient-text">{mentorInfo.name}</h2>
          <p className="mentor-title-text">M.Tech – IIT Kharagpur | PhD – IIIT Hyderabad</p>
          <p className="mentor-founder">Founder of NEXT_LEVEL</p>
          <div className="mentor-phone glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Phone size={16} strokeWidth={2} /> Direct Mentorship Line: <strong className="gradient-text">{mentorInfo.phone}</strong>
          </div>
        </div>

        <div className="mentor-qualifications">
          <h3 className="gradient-text" style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '1.5rem' }}>Qualifications & Experience</h3>
          <div className="qual-grid">
            {mentorInfo.qualifications.map((q, i) => (
              <div key={i} className="qual-item glass">
                <span className="qual-icon"><Sparkles size={16} strokeWidth={2} /></span>
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mentor-content-grid">
        {/* Subjects of Expertise */}
        <div className="mentor-section glass">
          <h3 className="gradient-text" style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BookMarked size={18} strokeWidth={2} /> Subjects of Expertise</h3>
          <div className="subjects-grid">
            {mentorInfo.subjects.map((s, i) => (
              <div key={i} className="subject-chip glass">{s}</div>
            ))}
          </div>
        </div>

        {/* Mentor's Dream */}
        <div className="mentor-section glass mentor-dream">
          <h3 className="gradient-text" style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Sparkles size={18} strokeWidth={2} /> My Dream</h3>
          <blockquote>"{mentorInfo.dream}"</blockquote>
          <p className="quote-sig" style={{ fontWeight: '800' }}>— Bhima Sankar Sir</p>
        </div>

        {/* Personal Quotes */}
        <div className="mentor-section glass" style={{ gridColumn: 'span 2' }}>
          <h3 className="gradient-text" style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><MessageCircle size={18} strokeWidth={2} /> Words from Bhima Sankar Sir</h3>
          <div className="quotes-list">
            {mentorInfo.quotes.map((q, i) => (
              <div key={i} className="quote-card glass">
                <span className="quote-mark">"</span>
                <p>{q}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Message to Students */}
        <div className="mentor-section glass">
          <h3 className="gradient-text" style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><PenLine size={18} strokeWidth={2} /> Message to Students</h3>
          <blockquote>"{mentorInfo.messageToStudents}"</blockquote>
          <p className="quote-sig" style={{ fontWeight: '800' }}>— Bhima Sankar Sir</p>
        </div>

        {/* Motto */}
        <div className="mentor-section glass mentor-motto">
          <h3 className="gradient-text" style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Target size={18} strokeWidth={2} /> Our Motto</h3>
          {mentorInfo.motto.map((m, i) => (
            <p key={i} className="motto-line" style={{ fontWeight: '800' }}>{m}</p>
          ))}
        </div>

        {/* Community Links */}
        <div className="mentor-section glass" style={{ gridColumn: 'span 2' }}>
          <h3 className="gradient-text" style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Globe size={18} strokeWidth={2} /> Join Our Community</h3>
          <div className="community-links">
            <a href={mentorInfo.links.youtube} target="_blank" rel="noopener noreferrer" className="community-link youtube">
              <Play size={18} strokeWidth={2} /> YouTube Channel
            </a>
            <a href={mentorInfo.links.website} target="_blank" rel="noopener noreferrer" className="community-link website">
              <Globe size={18} strokeWidth={2} /> Official Website
            </a>
            <a href={mentorInfo.links.telegram} target="_blank" rel="noopener noreferrer" className="community-link telegram">
              <Send size={18} strokeWidth={2} /> Telegram Community
            </a>
            <a href={mentorInfo.links.whatsapp} target="_blank" rel="noopener noreferrer" className="community-link whatsapp">
              <MessageCircle size={18} strokeWidth={2} /> WhatsApp Community
            </a>
          </div>
        </div>

        {/* Student Reviews */}
        <div className="mentor-section card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Star size={18} strokeWidth={2} /> Student Success Stories</h3>
          <p className="reviews-note">Real stories from real students.</p>

          {storiesLoading ? (
            <div className="reviews-empty"><p>Loading stories…</p></div>
          ) : stories.length === 0 ? (
            <div className="reviews-empty">
              <p>No stories shared yet. Be the first to share your success story!</p>
              <Link to="/stories" className="share-story-btn" style={shareBtnStyle}>
                <PenLine size={16} strokeWidth={2} /> Share Your Story
              </Link>
            </div>
          ) : (
            <>
              <div className="profile-stories-grid">
                {stories.slice(0, 4).map(s => (
                  <button key={s._id} type="button" className="profile-story-card" onClick={() => setActiveStory(s._id)}>
                    <strong className="ps-title">{s.title}</strong>
                    <span className="ps-author">— {s.userId?.name || 'Student'}</span>
                    <p className="ps-excerpt">{s.content?.slice(0, 140)}{s.content && s.content.length > 140 ? '…' : ''}</p>
                    <span className="ps-meta">
                      <Heart size={13} strokeWidth={2} color="#ef4444" fill="#ef4444" /> {(s.likes || []).length}
                      <MessageCircle size={13} strokeWidth={2} style={{ marginLeft: 10 }} /> {(s.comments || []).length}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Link to="/stories" className="share-story-btn" style={shareBtnStyle}>
                  <PenLine size={16} strokeWidth={2} /> Read all & share yours
                </Link>
              </div>
            </>
          )}

          {activeStory && <StoryDetailModal storyId={activeStory} onClose={() => setActiveStory(null)} />}

          <style>{`
            .profile-stories-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:8px; }
            .profile-story-card { text-align:left; display:flex; flex-direction:column; gap:4px; padding:16px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-bg-card); cursor:pointer; transition:transform .15s, box-shadow .15s, border-color .15s; }
            .profile-story-card:hover { transform:translateY(-3px); box-shadow:0 12px 28px rgba(2,6,23,.12); border-color:var(--color-primary); }
            .ps-title { font-size:1rem; font-weight:800; color:var(--color-text-primary); }
            .ps-author { font-size:.8rem; font-weight:700; color:var(--color-primary); }
            .ps-excerpt { font-size:.85rem; color:var(--color-text-secondary); line-height:1.5; margin:4px 0 0; }
            .ps-meta { display:inline-flex; align-items:center; gap:4px; font-size:.78rem; font-weight:700; color:var(--color-text-muted); margin-top:6px; }
            @media (max-width: 640px) { .profile-stories-grid { grid-template-columns:1fr; } }
          `}</style>
        </div>
      </div>
    </div>
  )
}

export default MentorProfilePage
