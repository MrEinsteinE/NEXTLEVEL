import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { HelpCircle, Send, CheckCircle2, Clock, ImagePlus, X } from 'lucide-react'
import { EmptyState } from '../common/Loaders.jsx'
import { compressImage } from '../../utils/imageCompress.js'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function DoubtsBoard() {
  const [queries, setQueries] = useState([])
  const [subject, setSubject] = useState('')
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState([]) // attached image data URLs (max 3)

  const fetchQueries = async () => {
    try {
      const res = await axios.get(`${API}/api/queries/student`, authHeader())
      setQueries(Array.isArray(res.data) ? res.data : [])
    } catch (e) { setQueries([]) } finally { setLoading(false) }
  }
  useEffect(() => { fetchQueries() }, [])

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // allow re-selecting the same file
    for (const file of files) {
      if (images.length >= 3) { toast.error('You can attach up to 3 images.'); break }
      try {
        const dataUrl = await compressImage(file)
        setImages(prev => (prev.length < 3 ? [...prev, dataUrl] : prev))
      } catch (err) { toast.error(err.message || 'Could not add that image.') }
    }
  }
  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const ask = async () => {
    if (!question.trim()) return toast.error('Please type your question')
    setSubmitting(true)
    try {
      await axios.post(`${API}/api/queries`, { subject: subject.trim(), question: question.trim(), images }, authHeader())
      toast.success('Doubt sent to your mentor ✓')
      setSubject(''); setQuestion(''); setImages([])
      fetchQueries()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send doubt') } finally { setSubmitting(false) }
  }

  const resolve = async (id) => {
    try {
      await axios.put(`${API}/api/queries/${id}/resolve`, {}, authHeader())
      setQueries(prev => prev.map(q => q._id === id ? { ...q, status: 'resolved' } : q))
    } catch (e) { toast.error('Could not update') }
  }

  return (
    <div className="doubts-board">
      <div className="db-ask">
        <h3><HelpCircle size={18} strokeWidth={2} /> Ask your mentor a doubt</h3>
        <p className="db-sub">Post a question and Bhima Sankar Sir will answer it here — you'll also get an email when he replies.</p>
        <input className="db-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (optional) — e.g. Networks" maxLength={60} />
        <textarea className="db-input db-textarea" rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Type your doubt in detail…" maxLength={2000} />
        {images.length > 0 && (
          <div className="db-thumbs">
            {images.map((src, i) => (
              <div key={i} className="db-thumb">
                <img src={src} alt={`attachment ${i + 1}`} />
                <button type="button" className="db-thumb-x" onClick={() => removeImage(i)} aria-label="Remove image"><X size={12} strokeWidth={2.5} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="db-actions">
          <label className="db-attach">
            <ImagePlus size={15} strokeWidth={2} /> Attach image
            <input type="file" accept="image/*" multiple hidden onChange={handleFiles} />
          </label>
          <button className="db-ask-btn" onClick={ask} disabled={submitting}><Send size={15} strokeWidth={2} /> {submitting ? 'Sending…' : 'Send doubt'}</button>
        </div>
      </div>

      <h3 className="db-list-title">Your doubts</h3>
      {loading ? (
        <p className="db-muted">Loading…</p>
      ) : queries.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No doubts yet" message="When you ask a question above, it'll appear here with your mentor's answer." />
      ) : (
        <div className="db-list">
          {queries.map(q => (
            <div key={q._id} className="db-item">
              <div className="db-item-head">
                {q.subject && <span className="db-subject-tag">{q.subject}</span>}
                <span className={`db-status db-status-${q.status}`}>{q.status === 'answered' ? 'Answered' : q.status === 'resolved' ? 'Resolved' : 'Pending'}</span>
                <span className="db-time">{new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
              <p className="db-q">{q.question}</p>
              {Array.isArray(q.images) && q.images.length > 0 && (
                <div className="db-att">
                  {q.images.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`attachment ${i + 1}`} /></a>
                  ))}
                </div>
              )}
              {q.answer ? (
                <div className="db-answer"><strong>Mentor:</strong> {q.answer}</div>
              ) : (
                <div className="db-pending"><Clock size={13} strokeWidth={2} /> Waiting for your mentor's answer…</div>
              )}
              {q.status === 'answered' && (
                <button className="db-resolve" onClick={() => resolve(q._id)}><CheckCircle2 size={14} strokeWidth={2} /> Mark resolved</button>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .doubts-board { max-width: 760px; }
        .db-ask { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 16px; padding: 22px 24px; box-shadow: var(--shadow-sm); }
        .db-ask h3 { display:inline-flex; align-items:center; gap:8px; font-size:1.05rem; font-weight:800; color:var(--color-text-primary); margin:0; }
        .db-sub { font-size:.86rem; color:var(--color-text-muted); margin:6px 0 14px; line-height:1.5; }
        .db-input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text-primary); font-family:inherit; font-size:.92rem; outline:none; margin-bottom:10px; transition:border-color .15s, box-shadow .15s; }
        .db-textarea { resize:vertical; }
        .db-input:focus { border-color:var(--color-primary); box-shadow:0 0 0 4px var(--color-primary-light); }
        .db-ask-btn { display:inline-flex; align-items:center; gap:7px; padding:10px 18px; border:none; border-radius:10px; background:var(--gradient-primary); color:#fff; font-weight:800; font-size:.9rem; cursor:pointer; transition:transform .15s; }
        .db-ask-btn:hover:not(:disabled) { transform:translateY(-1px); }
        .db-ask-btn:disabled { opacity:.6; cursor:not-allowed; }
        .db-list-title { font-size:1rem; font-weight:800; color:var(--color-text-primary); margin:24px 0 12px; }
        .db-muted { color:var(--color-text-muted); }
        .db-list { display:flex; flex-direction:column; gap:12px; }
        .db-item { background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:14px; padding:14px 16px; }
        .db-item-head { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
        .db-subject-tag { background:var(--color-primary-light); color:var(--color-primary); font-weight:700; font-size:.7rem; padding:2px 8px; border-radius:999px; }
        .db-status { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; }
        .db-status-pending { background:#fef3c7; color:#d97706; }
        .db-status-answered { background:#dcfce7; color:#16a34a; }
        .db-status-resolved { background:var(--color-bg-input, var(--color-bg)); color:var(--color-text-muted); }
        [data-theme="dark"] .db-status-pending { background:rgba(245,158,11,0.16); color:#fbbf24; }
        [data-theme="dark"] .db-status-answered { background:rgba(34,197,94,0.16); color:#4ade80; }
        .db-time { margin-left:auto; font-size:.74rem; color:var(--color-text-muted); }
        .db-q { font-size:.95rem; color:var(--color-text-primary); margin:0 0 10px; line-height:1.55; }
        .db-answer { background:var(--color-bg-input, var(--color-bg)); border:1px solid var(--color-border); border-radius:10px; padding:11px 14px; font-size:.92rem; color:var(--color-text-primary); line-height:1.55; }
        .db-answer strong { color:var(--color-primary); }
        .db-pending { display:inline-flex; align-items:center; gap:6px; font-size:.84rem; color:var(--color-text-muted); font-style:italic; }
        .db-resolve { margin-top:10px; display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border:1px solid var(--color-border); border-radius:9px; background:transparent; color:var(--color-text-secondary); font-weight:700; font-size:.8rem; cursor:pointer; }
        .db-resolve:hover { color:var(--color-success, #16a34a); border-color:var(--color-success, #16a34a); }
        .db-thumbs { display:flex; flex-wrap:wrap; gap:8px; margin:2px 0 12px; }
        .db-thumb { position:relative; width:64px; height:64px; border-radius:9px; overflow:hidden; border:1px solid var(--color-border); }
        .db-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .db-thumb-x { position:absolute; top:2px; right:2px; width:18px; height:18px; border:none; border-radius:50%; background:rgba(15,23,42,.7); color:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; }
        .db-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .db-attach { display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg-input, var(--color-bg)); color:var(--color-text-secondary); font-weight:700; font-size:.85rem; cursor:pointer; transition:all .15s; }
        .db-attach:hover { color:var(--color-primary); border-color:var(--color-primary); }
        .db-att { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 10px; }
        .db-att img { width:120px; height:90px; object-fit:cover; border-radius:9px; border:1px solid var(--color-border); cursor:pointer; }
      `}</style>
    </div>
  )
}
