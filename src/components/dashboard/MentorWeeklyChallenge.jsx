import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Trophy, Save } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function MentorWeeklyChallenge() {
  const [ch, setCh] = useState(null)
  const [f, setF] = useState({ week: '', title: '', count: '', unit: 'PYQs', reward: '' })
  const [busy, setBusy] = useState(false)

  const fetchCurrent = async () => {
    try { const r = await axios.get(`${API}/api/weekly-challenge/current`, authHeader()); setCh(r.data.challenge || null) }
    catch (e) { /* ignore */ }
  }
  useEffect(() => { fetchCurrent() }, [])

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const create = async () => {
    if (!f.week.trim() || !f.title.trim()) return toast.error('Week and title are required')
    setBusy(true)
    try {
      await axios.post(`${API}/api/weekly-challenge`, {
        week: f.week.trim(), title: f.title.trim(),
        target: { count: Number(f.count) || 0, unit: f.unit.trim() },
        reward: f.reward.trim()
      }, authHeader())
      toast.success('Weekly challenge published ✓')
      setF({ week: '', title: '', count: '', unit: 'PYQs', reward: '' })
      fetchCurrent()
    } catch (e) { toast.error('Failed to publish challenge') } finally { setBusy(false) }
  }

  return (
    <div className="card mentor-section">
      <h2 className="section-h2-icon"><Trophy size={20} strokeWidth={2} /> Weekly Challenge</h2>
      {ch ? (
        <p className="wcm-cur">Current: <strong>{ch.title}</strong> ({ch.week}) — {(ch.participants || []).length} joined{ch.target?.count ? `, goal ${ch.target.count} ${ch.target.unit || ''}` : ''}.</p>
      ) : (
        <p className="wcm-cur">No challenge yet. Publish one to motivate your students this week.</p>
      )}
      <div className="wcm-form">
        <input value={f.week} onChange={e => set('week', e.target.value)} placeholder="Week label (e.g. Jun 1–7)" />
        <input value={f.title} onChange={e => set('title', e.target.value)} placeholder="Title (e.g. PYQ Sprint)" />
        <input type="number" min="0" value={f.count} onChange={e => set('count', e.target.value)} placeholder="Target count (e.g. 150)" />
        <input value={f.unit} onChange={e => set('unit', e.target.value)} placeholder="Unit (e.g. PYQs)" />
        <input value={f.reward} onChange={e => set('reward', e.target.value)} placeholder="Reward (e.g. 50 bonus points)" />
      </div>
      <button className="approve-btn" type="button" onClick={create} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Save size={15} strokeWidth={2} /> {busy ? 'Publishing…' : (ch ? 'Replace with new challenge' : 'Publish challenge')}
      </button>
      <style>{`
        .wcm-cur { color:#64748b; font-size:.9rem; margin:0 0 12px; }
        .wcm-form { display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:12px; }
        .wcm-form input { padding:9px 12px; border:1px solid #e2e8f0; border-radius:10px; font-family:inherit; font-size:.9rem; outline:none; }
        .wcm-form input:focus { border-color: var(--color-primary); }
        @media (max-width:640px){ .wcm-form { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
