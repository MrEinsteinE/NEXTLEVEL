import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { User, Target, Lock, Save, ArrowLeft, Bell } from 'lucide-react'
import { enablePush, disablePush, getPushStatus } from '../utils/push.js'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})

export default function Settings() {
  const { user, fetchUser } = useAuth()
  const navigate = useNavigate()
  const isMentor = user?.role === 'mentor'

  const [name, setName] = useState(user?.name || '')
  const [targets, setTargets] = useState({ daily: 6, weekly: 42, monthly: 180 })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingTargets, setSavingTargets] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pushStatus, setPushStatus] = useState('default')
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => { setName(user?.name || '') }, [user])
  useEffect(() => { getPushStatus().then(setPushStatus).catch(() => {}) }, [])

  useEffect(() => {
    if (isMentor) return // mentors have no study targets
    (async () => {
      try {
        const res = await axios.get(`${API}/api/student/targets/me`, authHeader())
        if (res.data?.targets) setTargets(res.data.targets)
      } catch (e) { /* keep defaults */ }
    })()
  }, [isMentor])

  const saveProfile = async () => {
    if (!name.trim()) return toast.error('Name cannot be empty')
    setSavingProfile(true)
    try {
      await axios.put(`${API}/api/auth/profile`, { name: name.trim() }, authHeader())
      await fetchUser()
      toast.success('Profile updated ✓')
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to update profile') }
    finally { setSavingProfile(false) }
  }

  const saveTargets = async () => {
    setSavingTargets(true)
    try {
      await axios.post(`${API}/api/student/targets/me`, {
        daily: Number(targets.daily), weekly: Number(targets.weekly), monthly: Number(targets.monthly)
      }, authHeader())
      toast.success('Study targets updated ✓')
    } catch (e) { toast.error('Failed to update targets') }
    finally { setSavingTargets(false) }
  }

  const changePassword = async () => {
    if (pw.next.length < 8) return toast.error('New password must be at least 8 characters')
    if (pw.next !== pw.confirm) return toast.error('New passwords do not match')
    setSavingPw(true)
    try {
      await axios.post(`${API}/api/auth/change-password`, { currentPassword: pw.current, newPassword: pw.next }, authHeader())
      toast.success('Password changed ✓')
      setPw({ current: '', next: '', confirm: '' })
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to change password') }
    finally { setSavingPw(false) }
  }

  const togglePush = async () => {
    setPushBusy(true)
    try {
      if (pushStatus === 'subscribed') { await disablePush(); toast.success('Push notifications turned off') }
      else { await enablePush(); toast.success('Push notifications enabled ✓') }
      setPushStatus(await getPushStatus())
    } catch (e) { toast.error(e.message || 'Could not update notifications') }
    finally { setPushBusy(false) }
  }

  return (
    <div className="settings-page">
      <div className="settings-head">
        <button className="settings-back" onClick={() => navigate(isMentor ? '/mentor-dashboard' : '/dashboard')}><ArrowLeft size={16} strokeWidth={2} /> Back to Dashboard</button>
        <h1>Settings</h1>
        <p>Manage your profile, study targets, and security.</p>
      </div>

      <div className="settings-card">
        <h2><User size={18} strokeWidth={2} /> Profile</h2>
        <label>Full name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
        <div className="settings-readonly">
          <div><span>Email</span><strong>{user?.email || '—'}</strong></div>
          <div><span>Branch</span><strong>{user?.branch || '—'}</strong></div>
        </div>
        <button className="settings-save" onClick={saveProfile} disabled={savingProfile}><Save size={15} strokeWidth={2} /> {savingProfile ? 'Saving…' : 'Save profile'}</button>
      </div>

      <div className="settings-card">
        <h2><Bell size={18} strokeWidth={2} /> Push Notifications</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '.88rem', margin: '4px 0 14px', lineHeight: 1.5 }}>
          Get streak reminders, mentor messages, and study nudges on this device — even when the site is closed.
        </p>
        {pushStatus === 'unsupported' ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '.88rem' }}>This browser doesn't support push notifications.</p>
        ) : pushStatus === 'denied' ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '.88rem' }}>Notifications are blocked in your browser settings — re-enable them there to turn this on.</p>
        ) : (
          <button className="settings-save" onClick={togglePush} disabled={pushBusy}>
            <Bell size={15} strokeWidth={2} /> {pushBusy ? 'Working…' : pushStatus === 'subscribed' ? 'Turn off notifications' : 'Enable notifications'}
          </button>
        )}
      </div>

      {!isMentor && (
        <div className="settings-card">
          <h2><Target size={18} strokeWidth={2} /> Study Targets (hours)</h2>
          <div className="settings-grid3">
            <div><label>Daily</label><input type="number" min="0" value={targets.daily} onChange={e => setTargets(t => ({ ...t, daily: e.target.value }))} /></div>
            <div><label>Weekly</label><input type="number" min="0" value={targets.weekly} onChange={e => setTargets(t => ({ ...t, weekly: e.target.value }))} /></div>
            <div><label>Monthly</label><input type="number" min="0" value={targets.monthly} onChange={e => setTargets(t => ({ ...t, monthly: e.target.value }))} /></div>
          </div>
          <button className="settings-save" onClick={saveTargets} disabled={savingTargets}><Save size={15} strokeWidth={2} /> {savingTargets ? 'Saving…' : 'Save targets'}</button>
        </div>
      )}

      <div className="settings-card">
        <h2><Lock size={18} strokeWidth={2} /> Change Password</h2>
        <label>Current password</label>
        <input type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" />
        <label>New password</label>
        <input type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="At least 8 characters" />
        <label>Confirm new password</label>
        <input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" />
        <button className="settings-save" onClick={changePassword} disabled={savingPw}><Lock size={15} strokeWidth={2} /> {savingPw ? 'Updating…' : 'Update password'}</button>
      </div>

      <style>{`
        .settings-page { max-width: 720px; margin: 0 auto; padding: 28px 20px 60px; font-family: 'Inter', sans-serif; }
        .settings-back { display:inline-flex; align-items:center; gap:6px; border:none; background:transparent; color:var(--color-primary); font-weight:700; cursor:pointer; font-size:.9rem; margin-bottom:10px; }
        .settings-head h1 { font-size:1.8rem; font-weight:900; color:var(--color-text-primary); margin:0; }
        .settings-head p { color:var(--color-text-muted); margin:4px 0 24px; }
        .settings-card { background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:16px; padding:22px 24px; margin-bottom:18px; box-shadow:var(--shadow-sm); }
        .settings-card h2 { display:inline-flex; align-items:center; gap:8px; font-size:1.05rem; font-weight:800; color:var(--color-text-primary); margin:0 0 8px; }
        .settings-card label { display:block; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-secondary); margin:12px 0 6px; }
        .settings-card input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text-primary); font-family:inherit; font-size:.92rem; outline:none; transition:border-color .15s, box-shadow .15s; }
        .settings-card input:focus { border-color:var(--color-primary); box-shadow:0 0 0 4px var(--color-primary-light); }
        .settings-readonly { display:flex; gap:28px; margin-top:14px; flex-wrap:wrap; }
        .settings-readonly span { display:block; font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-muted); font-weight:700; margin-bottom:2px; }
        .settings-readonly strong { color:var(--color-text-primary); font-size:.92rem; }
        .settings-grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .settings-save { margin-top:18px; display:inline-flex; align-items:center; gap:7px; padding:10px 18px; border:none; border-radius:10px; background:var(--gradient-primary); color:#fff; font-weight:800; font-size:.9rem; cursor:pointer; transition:transform .15s; }
        .settings-save:hover:not(:disabled) { transform:translateY(-1px); }
        .settings-save:disabled { opacity:.6; cursor:not-allowed; }
        @media (max-width:560px){ .settings-grid3 { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
