import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Trophy, Target, Star } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function WeeklyChallengeCard() {
  const [ch, setCh] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const me = JSON.parse(localStorage.getItem('user') || '{}')

  const fetchCurrent = async () => {
    try { const r = await axios.get(`${API}/api/weekly-challenge/current`, authHeader()); setCh(r.data.challenge || null) }
    catch (e) { setCh(null) } finally { setLoading(false) }
  }
  useEffect(() => { fetchCurrent() }, [])

  if (loading || !ch) return null // no active challenge → don't clutter the overview

  const myPart = (ch.participants || []).find(p => String(p.userId) === String(me._id))
  const targetCount = ch.target?.count || 0
  const unit = ch.target?.unit || ''
  const progress = myPart?.progress || 0
  const pct = targetCount > 0 ? Math.min(100, Math.round((progress / targetCount) * 100)) : 0
  const joined = !!myPart
  const completed = myPart?.completed

  const join = async () => {
    setBusy(true)
    try { await axios.post(`${API}/api/weekly-challenge/join`, { challengeId: ch._id, progress: 0 }, authHeader()); toast.success('Joined the weekly challenge ✓'); fetchCurrent() }
    catch (e) { toast.error('Could not join') } finally { setBusy(false) }
  }
  const update = async () => {
    const v = Number(draft)
    if (Number.isNaN(v) || v < 0) return toast.error('Enter a valid number')
    setBusy(true)
    try { const r = await axios.post(`${API}/api/weekly-challenge/join`, { challengeId: ch._id, progress: v }, authHeader()); setCh(r.data.challenge); setDraft(''); toast.success('Progress updated ✓') }
    catch (e) { toast.error('Could not update') } finally { setBusy(false) }
  }

  return (
    <div className="wc-card">
      <div className="wc-head">
        <span className="wc-icon"><Trophy size={20} strokeWidth={2} /></span>
        <div>
          <div className="wc-week">Weekly Challenge · {ch.week}</div>
          <h3 className="wc-title">{ch.title}</h3>
        </div>
        {completed && <span className="wc-done">Completed!</span>}
      </div>

      <div className="wc-meta">
        {targetCount > 0 && <span><Target size={14} strokeWidth={2} /> Goal: {targetCount} {unit}</span>}
        {ch.reward && <span><Star size={14} strokeWidth={2} /> Reward: {ch.reward}</span>}
      </div>

      {joined ? (
        <>
          <div className="wc-bar"><div className="wc-fill" style={{ width: `${pct}%` }} /></div>
          <div className="wc-progress-row">
            <span>{progress}{targetCount ? ` / ${targetCount}` : ''} {unit} ({pct}%)</span>
            {!completed && (
              <span className="wc-update">
                <input type="number" min="0" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Your total" />
                <button onClick={update} disabled={busy}>Update</button>
              </span>
            )}
          </div>
        </>
      ) : (
        <button className="wc-join" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join this challenge'}</button>
      )}

      <style>{`
        /* Primary-tinted gradient over the card surface — the rgba tint adapts to
           light/dark because it sits on top of var(--color-bg-card). */
        .wc-card { background: linear-gradient(135deg, rgba(108,99,255,0.12), var(--color-bg-card) 60%); border:1px solid var(--color-border); border-radius:16px; padding:24px 26px; margin-bottom: var(--sp-8); box-shadow: var(--shadow-card, var(--shadow-sm)); }
        .wc-head { display:flex; align-items:center; gap:14px; }
        .wc-icon { width:44px; height:44px; border-radius:12px; background: var(--gradient-primary, linear-gradient(135deg, var(--color-primary), var(--color-accent))); color:#fff; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
        .wc-week { font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color: var(--color-text-muted); }
        .wc-title { font-size:1.15rem; font-weight:800; color: var(--color-text-primary); margin:4px 0 0; }
        .wc-done { margin-left:auto; background:var(--color-success-light); color:var(--color-success); font-weight:800; font-size:.75rem; padding:5px 12px; border-radius:999px; }
        [data-theme="dark"] .wc-done { background:rgba(34,197,94,0.16); color:#4ade80; }
        .wc-meta { display:flex; flex-wrap:wrap; gap:18px; margin:16px 0; font-size:.85rem; color: var(--color-text-secondary); }
        .wc-meta span { display:inline-flex; align-items:center; gap:6px; }
        .wc-bar { height:10px; background: var(--color-bg-input, var(--color-border)); border:1px solid var(--color-border); border-radius:999px; overflow:hidden; }
        .wc-fill { height:100%; background: var(--gradient-primary, linear-gradient(90deg, var(--color-primary), var(--color-accent))); border-radius:999px; transition:width .5s ease; }
        .wc-progress-row { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:14px; font-size:.9rem; font-weight:700; color: var(--color-text-primary); flex-wrap:wrap; }
        .wc-update { display:inline-flex; gap:8px; }
        .wc-update input { width:130px; padding:9px 12px; border:1px solid var(--color-border); border-radius:9px; background:var(--color-bg-input, var(--color-bg)); color:var(--color-text-primary); font-family:inherit; }
        .wc-update input:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px var(--color-primary-light); }
        .wc-update button { padding:9px 16px; border:none; border-radius:9px; background:var(--gradient-primary, var(--color-primary)); color:#fff; font-weight:800; cursor:pointer; }
        .wc-join { margin-top:14px; padding:11px 22px; border:none; border-radius:10px; background:var(--gradient-primary, var(--color-primary)); color:#fff; font-weight:800; font-size:.9rem; cursor:pointer; }
        .wc-join:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
