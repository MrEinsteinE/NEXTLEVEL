import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { BookOpen, CheckCircle2, Trash2 } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket.js'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function MentorStories() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket()

  const fetchStories = async () => {
    try {
      const res = await axios.get(`${API}/api/stories`, authHeader())
      setStories(res.data.stories || [])
    } catch (e) { setStories([]) } finally { setLoading(false) }
  }
  useEffect(() => { fetchStories() }, [])
  useEffect(() => {
    if (!socket) return
    const r = () => fetchStories()
    socket.on('new-story-pending', r)
    return () => socket.off('new-story-pending', r)
  }, [socket])

  const approve = async (id) => {
    try {
      await axios.put(`${API}/api/stories/${id}/approve`, {}, authHeader())
      setStories(prev => prev.map(s => s._id === id ? { ...s, isApproved: true, status: 'approved' } : s))
      toast.success('Story approved — now visible to students ✓')
    } catch (e) { toast.error('Failed to approve story') }
  }
  const remove = async (id) => {
    if (!window.confirm('Delete this story permanently?')) return
    try {
      await axios.delete(`${API}/api/stories/${id}`, authHeader())
      setStories(prev => prev.filter(s => s._id !== id))
      toast.success('Story deleted')
    } catch (e) { toast.error('Failed to delete story') }
  }

  const pendingStories = stories.filter(s => !s.isApproved && s.status !== 'rejected')
  const approvedCount = stories.filter(s => s.isApproved).length

  return (
    <div className="card mentor-section ms-card">
      <h2 className="section-h2-icon">
        <BookOpen size={20} strokeWidth={2} /> Success Stories
        {pendingStories.length > 0 && <span className="ms-count">{pendingStories.length} awaiting review</span>}
      </h2>
      {loading ? (
        <p className="ms-muted">Loading…</p>
      ) : (
        <>
          {pendingStories.length === 0 && (
            <p className="ms-muted">No stories awaiting review. Approved stories appear on students' Success Stories page.</p>
          )}
          {pendingStories.map(st => (
            <div key={st._id} className="ms-item">
              <div className="ms-head">
                <strong>{st.title}</strong>
                <span className="ms-author">by {st.userId?.name || 'Student'}</span>
                <span className="ms-pending-tag">Pending</span>
              </div>
              <p className="ms-content">{st.content?.slice(0, 240)}{st.content && st.content.length > 240 ? '…' : ''}</p>
              <div className="ms-actions">
                <button className="approve-btn" type="button" onClick={() => approve(st._id)}><CheckCircle2 size={15} strokeWidth={2} /> Approve &amp; publish</button>
                <button className="reject-btn" type="button" onClick={() => remove(st._id)}><Trash2 size={15} strokeWidth={2} /> Delete</button>
              </div>
            </div>
          ))}
          {approvedCount > 0 && (
            <p className="ms-approved-note"><CheckCircle2 size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> {approvedCount} approved {approvedCount === 1 ? 'story is' : 'stories are'} live on the Stories page.</p>
          )}
        </>
      )}
      <style>{`
        .ms-card { margin-bottom: 1.25rem; }
        .ms-count { font-size:.72rem; font-weight:800; color:#c2410c; background:#fff7ed; border:1px solid #fed7aa; padding:2px 8px; border-radius:999px; margin-left:10px; }
        .ms-muted { color:#64748b; font-size:.9rem; }
        .ms-item { border:1px solid #eef1f6; border-radius:12px; padding:12px 14px; background:#fcfdff; margin-top:10px; }
        .ms-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px; }
        .ms-head strong { color:#1e293b; font-size:.95rem; }
        .ms-author { color:#64748b; font-size:.8rem; }
        .ms-pending-tag { margin-left:auto; font-size:.68rem; font-weight:800; text-transform:uppercase; background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:999px; }
        .ms-content { font-size:.9rem; color:#475569; line-height:1.55; margin:0 0 10px; white-space:pre-wrap; }
        .ms-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .ms-approved-note { margin-top:12px; font-size:.82rem; color:#16a34a; font-weight:600; }
      `}</style>
    </div>
  )
}
