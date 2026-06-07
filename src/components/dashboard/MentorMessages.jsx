import { useState, useEffect } from 'react'
import axios from 'axios'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket.js'
import { Skeleton, EmptyState } from '../common/Loaders.jsx'

const API = import.meta.env.VITE_API_URL || ''

const TYPE_LABEL = {
  weekly: 'Weekly', topic: 'Topic', encouragement: 'Encouragement',
  flag: 'Action needed', mentor: 'Message', remark: 'Remark', general: 'Message'
}

export default function MentorMessages() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket()

  const fetchFeedback = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user._id) { setLoading(false); return }
    try {
      const res = await axios.get(`${API}/api/feedback/${user._id}`)
      setItems(res.data.feedback || [])
    } catch (e) {
      // ignore — show empty state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeedback() }, [])

  // Live refresh when the mentor sends new feedback.
  useEffect(() => {
    if (!socket) return
    const handler = () => fetchFeedback()
    socket.on('mentor_feedback', handler)
    return () => socket.off('mentor_feedback', handler)
  }, [socket])

  return (
    <div className="mentor-messages">
      <div className="mm-header">
        <h3><MessageCircle size={18} strokeWidth={2} /> Messages from your Mentor</h3>
        <button className="mm-refresh" onClick={fetchFeedback} aria-label="Refresh messages" title="Refresh">
          <RefreshCw size={15} strokeWidth={2} />
        </button>
      </div>

      {loading ? (
        <div className="sk-col" style={{ gap: 14 }}>
          <Skeleton w="55%" h={14} />
          <Skeleton w="92%" h={12} />
          <Skeleton w="78%" h={12} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          message="Keep submitting your daily reports — your mentor's feedback and guidance will show up here."
        />
      ) : (
        <div className="mm-list">
          {items.map(f => (
            <div key={f._id} className="mm-item">
              <div className="mm-avatar">{(f.mentorId?.name || 'M')[0].toUpperCase()}</div>
              <div className="mm-body">
                <div className="mm-meta">
                  <strong>{f.mentorId?.name || 'Your Mentor'}</strong>
                  <span className={`mm-type mm-type-${f.type}`}>{TYPE_LABEL[f.type] || 'Message'}</span>
                  <span className="mm-time">{new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <p className="mm-text">{f.text}</p>
                {f.topic && <span className="mm-topic">Re: {f.topic}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .mentor-messages { font-family: 'Inter', sans-serif; }
        .mm-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .mm-header h3 { display:inline-flex; align-items:center; gap:8px; font-size:1.05rem; font-weight:800; color:var(--color-text-primary); margin:0; }
        .mm-refresh { width:32px; height:32px; border-radius:9px; border:1px solid var(--color-border); background:var(--color-bg-card); color:var(--color-text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:color .15s; }
        .mm-refresh:hover { color:var(--color-primary); }
        .mm-empty { color:var(--color-text-muted); font-size:.9rem; line-height:1.6; margin:0; }
        .mm-list { display:flex; flex-direction:column; gap:14px; max-height:380px; overflow-y:auto; padding-right:4px; }
        .mm-item { display:flex; gap:12px; }
        .mm-avatar { width:38px; height:38px; flex-shrink:0; border-radius:50%; background:var(--gradient-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; }
        .mm-body { flex:1; background:var(--color-bg); border:1px solid var(--color-border); border-radius:12px; padding:10px 14px; }
        .mm-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:.78rem; color:var(--color-text-secondary); margin-bottom:4px; }
        .mm-meta strong { color:var(--color-text-primary); font-size:.85rem; }
        .mm-type { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; background:var(--color-primary-light); color:var(--color-primary); }
        .mm-type-flag { background:#fef2f2; color:#dc2626; }
        .mm-type-encouragement { background:#ecfdf5; color:#059669; }
        .mm-time { margin-left:auto; color:var(--color-text-muted); }
        .mm-text { font-size:.92rem; color:var(--color-text-primary); line-height:1.6; margin:0; white-space:pre-wrap; }
        .mm-topic { display:inline-block; margin-top:6px; font-size:.75rem; color:var(--color-text-muted); font-style:italic; }
      `}</style>
    </div>
  )
}
