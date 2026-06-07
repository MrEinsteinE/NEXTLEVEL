import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Bell, Check } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket.js'

const API = import.meta.env.VITE_API_URL || ''

export default function NotificationBell() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const socket = useSocket()
  const ref = useRef(null)

  const fetchNotes = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user._id) return
    try {
      const res = await axios.get(`${API}/api/notifications`)
      setItems(res.data.notifications || [])
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { fetchNotes() }, [])

  // Live: refetch when the server pushes a relevant event.
  useEffect(() => {
    if (!socket) return
    const refetch = () => fetchNotes()
    socket.on('notification', refetch)
    socket.on('mentor_feedback', refetch)
    socket.on('points-updated', refetch)
    socket.on('badge-earned', refetch)
    return () => {
      socket.off('notification', refetch)
      socket.off('mentor_feedback', refetch)
      socket.off('points-updated', refetch)
      socket.off('badge-earned', refetch)
    }
  }, [socket])

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = items.filter(n => !n.isRead).length

  const markRead = async (id) => {
    setItems(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n))
    try { await axios.put(`${API}/api/notifications/read/${id}`, {}) } catch (e) { /* ignore */ }
  }

  const markAll = async () => {
    const unreadIds = items.filter(n => !n.isRead).map(n => n._id)
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    await Promise.all(unreadIds.map(id =>
      axios.put(`${API}/api/notifications/read/${id}`, {}).catch(() => {})
    ))
  }

  const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-trigger" onClick={() => setOpen(o => !o)} aria-label="Notifications">
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span>Notifications</span>
            {unread > 0 && <button className="notif-markall" onClick={markAll}><Check size={13} strokeWidth={2.5} /> Mark all read</button>}
          </div>
          <div className="notif-list">
            {items.length === 0 && <p className="notif-empty">You're all caught up.</p>}
            {items.map(n => (
              <div key={n._id} className={`notif-item ${n.isRead ? '' : 'unread'}`} onClick={() => markRead(n._id)}>
                <span className="notif-dot" />
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  {n.message && <div className="notif-msg">{n.message}</div>}
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .notif-bell { position: relative; }
        .notif-trigger { position: relative; width: 42px; height: 42px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg-card); color: var(--color-text-secondary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: color .15s, border-color .15s; }
        .notif-trigger:hover { color: var(--color-primary); border-color: var(--color-primary); }
        .notif-badge { position: absolute; top: -3px; right: -3px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: #ef4444; color: #fff; font-size: .65rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; border: 2px solid var(--color-bg); }
        .notif-panel { position: absolute; top: calc(100% + 8px); right: 0; width: 340px; max-width: 86vw; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 14px; box-shadow: 0 18px 44px rgba(2,6,23,.20); z-index: 300; overflow: hidden; animation: notifPop .15s ease; }
        @keyframes notifPop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .notif-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--color-border); font-weight: 800; font-size: .9rem; color: var(--color-text-primary); }
        .notif-markall { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; color: var(--color-primary); font-weight: 700; font-size: .76rem; cursor: pointer; }
        .notif-list { max-height: 380px; overflow-y: auto; }
        .notif-empty { padding: 22px 14px; text-align: center; color: var(--color-text-muted); font-size: .88rem; }
        .notif-item { display: flex; gap: 10px; padding: 11px 14px; cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background .12s; }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--color-bg); }
        .notif-item.unread { background: var(--color-primary-light); }
        .notif-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: transparent; }
        .notif-item.unread .notif-dot { background: var(--color-primary); }
        .notif-title { font-size: .85rem; font-weight: 700; color: var(--color-text-primary); }
        .notif-msg { font-size: .8rem; color: var(--color-text-secondary); margin-top: 2px; line-height: 1.4; }
        .notif-time { font-size: .72rem; color: var(--color-text-muted); margin-top: 3px; }
      `}</style>
    </div>
  )
}
