import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Users, UserPlus, Send, Check, X } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket.js'
import { EmptyState } from '../common/Loaders.jsx'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function AccountabilityPartners() {
  const [partnerships, setPartnerships] = useState([])
  const [candidates, setCandidates] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const socket = useSocket()
  const myId = (JSON.parse(localStorage.getItem('user') || '{}'))._id

  const fetchAll = async () => {
    try {
      const [p, c] = await Promise.all([
        axios.get(`${API}/api/partnerships/mine`, authHeader()),
        axios.get(`${API}/api/partnerships/candidates`, authHeader()),
      ])
      setPartnerships(p.data.partnerships || [])
      setCandidates(c.data.candidates || [])
    } catch (e) { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (!socket) return
    const r = () => fetchAll()
    socket.on('partnership_request', r); socket.on('partnership_accepted', r); socket.on('partnership_checkin', r)
    return () => { socket.off('partnership_request', r); socket.off('partnership_accepted', r); socket.off('partnership_checkin', r) }
  }, [socket])

  const other = (p) => (String(p.studentA?._id) === String(myId) ? p.studentB : p.studentA) || {}

  const request = async (toUserId) => {
    try { await axios.post(`${API}/api/partnerships/request`, { toUserId }, authHeader()); toast.success('Partner request sent ✓'); fetchAll() }
    catch (e) { toast.error(e.response?.data?.message || 'Could not send request') }
  }
  const respond = async (partnershipId, accept) => {
    try { await axios.post(`${API}/api/partnerships/respond`, { partnershipId, accept }, authHeader()); toast.success(accept ? 'Partner accepted ✓' : 'Request declined'); fetchAll() }
    catch (e) { toast.error('Action failed') }
  }
  const checkin = async (partnershipId) => {
    const message = (drafts[partnershipId] || '').trim()
    if (!message) return
    try { await axios.post(`${API}/api/partnerships/checkin`, { partnershipId, message }, authHeader()); setDrafts(d => ({ ...d, [partnershipId]: '' })); fetchAll() }
    catch (e) { toast.error('Could not send check-in') }
  }

  const incoming = partnerships.filter(p => p.status === 'pending' && String(p.studentB?._id) === String(myId))
  const outgoing = partnerships.filter(p => p.status === 'pending' && String(p.studentA?._id) === String(myId))
  const active = partnerships.filter(p => p.status === 'active')

  if (loading) return <div className="ap-board"><p className="ap-muted">Loading…</p></div>

  return (
    <div className="ap-board">
      <div className="ap-head"><Users size={20} strokeWidth={2} /> <h2>Accountability Partners</h2></div>
      <p className="ap-sub">Pair up with another aspirant to keep each other consistent — send check-ins and stay accountable.</p>

      {incoming.length > 0 && (
        <section className="ap-section">
          <h3>Partner requests</h3>
          {incoming.map(p => (
            <div key={p._id} className="ap-row">
              <div className="ap-person"><span className="ap-avatar">{(other(p).name || 'S')[0]}</span><div><strong>{other(p).name || 'Student'}</strong><span className="ap-branch">{other(p).branch}</span></div></div>
              <div className="ap-actions">
                <button className="ap-accept" onClick={() => respond(p._id, true)}><Check size={14} strokeWidth={2.5} /> Accept</button>
                <button className="ap-decline" onClick={() => respond(p._id, false)}><X size={14} strokeWidth={2.5} /> Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {active.length > 0 && (
        <section className="ap-section">
          <h3>Your partners</h3>
          {active.map(p => {
            const recent = (p.checkIns || []).slice(-3).reverse()
            return (
              <div key={p._id} className="ap-partner">
                <div className="ap-person"><span className="ap-avatar active">{(other(p).name || 'S')[0]}</span><div><strong>{other(p).name || 'Partner'}</strong><span className="ap-branch">{other(p).branch}</span></div></div>
                {recent.length > 0 && (
                  <div className="ap-checkins">
                    {recent.map((c, i) => (
                      <div key={i} className="ap-checkin"><strong>{c.fromUserId?.name || (String(c.fromUserId) === String(myId) ? 'You' : 'Partner')}:</strong> {c.message} <span className="ap-time">{new Date(c.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>
                    ))}
                  </div>
                )}
                <div className="ap-compose">
                  <input value={drafts[p._id] || ''} onChange={e => setDrafts(d => ({ ...d, [p._id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') checkin(p._id) }} placeholder="Send a check-in… (e.g. Did you finish today's PYQs?)" maxLength={200} />
                  <button onClick={() => checkin(p._id)}><Send size={14} strokeWidth={2} /></button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="ap-section">
          <h3>Pending requests you sent</h3>
          {outgoing.map(p => (
            <div key={p._id} className="ap-row"><div className="ap-person"><span className="ap-avatar">{(other(p).name || 'S')[0]}</span><div><strong>{other(p).name || 'Student'}</strong><span className="ap-branch">{other(p).branch}</span></div></div><span className="ap-waiting">Awaiting response…</span></div>
          ))}
        </section>
      )}

      <section className="ap-section">
        <h3>Find a partner</h3>
        {candidates.length === 0 ? (
          <EmptyState icon={UserPlus} title="No one available right now" message="When other approved students join, they'll appear here to partner with." />
        ) : (
          <div className="ap-candidates">
            {candidates.map(c => (
              <div key={c._id} className="ap-row">
                <div className="ap-person"><span className="ap-avatar">{(c.name || 'S')[0]}</span><div><strong>{c.name}</strong><span className="ap-branch">{c.branch}</span></div></div>
                <button className="ap-request" onClick={() => request(c._id)}><UserPlus size={14} strokeWidth={2} /> Request</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .ap-board { max-width: 760px; }
        .ap-head { display:flex; align-items:center; gap:8px; color:var(--color-text-primary); }
        .ap-head h2 { font-size:1.3rem; font-weight:900; margin:0; }
        .ap-sub { color:var(--color-text-muted); font-size:.9rem; margin:4px 0 18px; line-height:1.5; }
        .ap-section { margin-bottom:22px; }
        .ap-section h3 { font-size:.95rem; font-weight:800; color:var(--color-text-primary); margin:0 0 10px; }
        .ap-muted { color:var(--color-text-muted); }
        .ap-row, .ap-partner { display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:12px; padding:12px 14px; margin-bottom:10px; flex-wrap:wrap; }
        .ap-partner { flex-direction:column; align-items:stretch; }
        .ap-person { display:flex; align-items:center; gap:10px; }
        .ap-avatar { width:36px; height:36px; border-radius:50%; background:var(--color-bg); border:1px solid var(--color-border); display:flex; align-items:center; justify-content:center; font-weight:800; color:var(--color-text-secondary); text-transform:uppercase; }
        .ap-avatar.active { background:var(--gradient-primary); color:#fff; border-color:transparent; }
        .ap-person strong { display:block; color:var(--color-text-primary); font-size:.92rem; }
        .ap-branch { font-size:.74rem; color:var(--color-text-muted); }
        .ap-actions { display:flex; gap:8px; }
        .ap-accept, .ap-decline, .ap-request { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:9px; font-weight:800; font-size:.8rem; cursor:pointer; border:1px solid transparent; }
        .ap-accept { background:#dcfce7; color:#16a34a; }
        .ap-decline { background:#fee2e2; color:#dc2626; }
        .ap-request { background:var(--gradient-primary); color:#fff; }
        .ap-waiting { font-size:.8rem; color:var(--color-text-muted); font-style:italic; }
        .ap-checkins { margin:10px 0 8px; display:flex; flex-direction:column; gap:6px; }
        .ap-checkin { font-size:.86rem; color:var(--color-text-primary); background:var(--color-bg); border-radius:8px; padding:7px 10px; }
        .ap-checkin strong { color:var(--color-primary); }
        .ap-time { color:var(--color-text-muted); font-size:.72rem; margin-left:6px; }
        .ap-compose { display:flex; gap:8px; }
        .ap-compose input { flex:1; padding:9px 12px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text-primary); font-family:inherit; font-size:.9rem; outline:none; }
        .ap-compose button { padding:9px 14px; border:none; border-radius:10px; background:var(--gradient-primary); color:#fff; cursor:pointer; }
        .ap-candidates { display:flex; flex-direction:column; }
      `}</style>
    </div>
  )
}
