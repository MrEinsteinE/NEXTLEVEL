import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { HelpCircle, Send } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function MentorQueries() {
  const [queries, setQueries] = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchPending = async () => {
    try {
      const res = await axios.get(`${API}/api/queries/mentor/pending`, authHeader())
      setQueries(Array.isArray(res.data) ? res.data : [])
    } catch (e) { setQueries([]) } finally { setLoading(false) }
  }
  useEffect(() => { fetchPending() }, [])

  const submitAnswer = async (id) => {
    const answer = (answers[id] || '').trim()
    if (!answer) return
    try {
      await axios.put(`${API}/api/queries/${id}/answer`, { answer }, authHeader())
      toast.success('Answer sent to the student ✓')
      setQueries(prev => prev.filter(q => q._id !== id))
      setAnswers(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch (e) { toast.error('Failed to send answer') }
  }

  return (
    <div className="card mentor-section mq-card">
      <h2 className="section-h2-icon">
        <HelpCircle size={20} strokeWidth={2} /> Student Doubts
        {queries.length > 0 && <span className="mq-count">{queries.length} pending</span>}
      </h2>
      {loading ? (
        <p className="mq-muted">Loading…</p>
      ) : queries.length === 0 ? (
        <p className="mq-muted">No pending doubts right now. When a student asks, it shows up here — answering also emails them.</p>
      ) : (
        <div className="mq-list">
          {queries.map(q => (
            <div key={q._id} className="mq-item">
              <div className="mq-meta">
                <strong>{q.userId?.name || 'Student'}</strong>
                {q.userId?.branch && <span className="branch-tag">{q.userId.branch}</span>}
                {q.subject && <span className="mq-subject">{q.subject}</span>}
                <span className="mq-time">{new Date(q.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mq-question">{q.question}</p>
              {Array.isArray(q.images) && q.images.length > 0 && (
                <div className="mq-att">
                  {q.images.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`attachment ${i + 1}`} /></a>
                  ))}
                </div>
              )}
              <div className="mq-answer">
                <input
                  value={answers[q._id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q._id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') submitAnswer(q._id) }}
                  placeholder="Type your answer…"
                />
                <button className="approve-btn" type="button" onClick={() => submitAnswer(q._id)}><Send size={14} strokeWidth={2} /> Answer</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`
        .mq-card { margin-bottom: 1.25rem; }
        .mq-count { font-size:.72rem; font-weight:800; color:#c2410c; background:#fff7ed; border:1px solid #fed7aa; padding:2px 8px; border-radius:999px; margin-left:10px; }
        .mq-muted { color:#64748b; font-size:.9rem; }
        .mq-list { display:flex; flex-direction:column; gap:12px; margin-top:8px; }
        .mq-item { border:1px solid #eef1f6; border-radius:12px; padding:12px 14px; background:#fcfdff; }
        .mq-meta { display:flex; align-items:center; gap:8px; font-size:.78rem; color:#64748b; margin-bottom:6px; flex-wrap:wrap; }
        .mq-meta strong { color:#1e293b; font-size:.88rem; }
        .mq-subject { background:var(--color-primary-light); color:var(--color-primary); font-weight:700; padding:1px 8px; border-radius:999px; font-size:.7rem; }
        .mq-time { margin-left:auto; }
        .mq-question { font-size:.95rem; color:#1e293b; margin:0 0 10px; line-height:1.5; white-space:pre-wrap; }
        .mq-answer { display:flex; gap:8px; }
        .mq-answer input { flex:1; padding:9px 12px; border:1px solid #e2e8f0; border-radius:10px; font-family:inherit; font-size:.9rem; outline:none; }
        .mq-answer input:focus { border-color:var(--color-primary); }
        .mq-att { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 10px; }
        .mq-att img { width:130px; height:100px; object-fit:cover; border-radius:9px; border:1px solid #e2e8f0; cursor:pointer; }
      `}</style>
    </div>
  )
}
