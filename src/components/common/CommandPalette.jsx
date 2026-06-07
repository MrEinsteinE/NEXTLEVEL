import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Search, LayoutDashboard, BookOpen, ListChecks, FileText, Target, TrendingUp,
  Trophy, CalendarDays, Map as MapIcon, GraduationCap, Settings as SettingsIcon,
  Sparkles, LogOut, HelpCircle, Users
} from 'lucide-react'

// Student navigation targets. Dashboard sections deep-link via ?tab=.
const STUDENT_NAV = [
  { label: 'Overview', to: '/dashboard?tab=overview', Icon: LayoutDashboard, kw: 'home dashboard' },
  { label: 'Syllabus Tracker', to: '/dashboard?tab=syllabus', Icon: BookOpen, kw: 'subjects topics' },
  { label: 'Daily Tasks', to: '/dashboard?tab=tasks', Icon: ListChecks, kw: 'todo checklist' },
  { label: 'Daily Report', to: '/dashboard?tab=report', Icon: FileText, kw: 'log hours study' },
  { label: 'Study Tracker', to: '/dashboard?tab=tracker', Icon: Target, kw: 'preparation' },
  { label: 'Progress', to: '/dashboard?tab=progress', Icon: TrendingUp, kw: 'analytics' },
  { label: 'Rewards & Leaderboard', to: '/dashboard?tab=rewards', Icon: Trophy, kw: 'points badges streak' },
  { label: 'My Timetable', to: '/dashboard?tab=timetable', Icon: CalendarDays, kw: 'schedule' },
  { label: 'My Journey', to: '/dashboard?tab=journey', Icon: MapIcon, kw: 'steps mentorship' },
  { label: 'Reflections', to: '/dashboard?tab=reflect', Icon: Sparkles, kw: 'journal mood goal diary' },
  { label: 'Partners', to: '/dashboard?tab=partners', Icon: Users, kw: 'accountability partner buddy check-in' },
  { label: 'Ask Mentor', to: '/dashboard?tab=doubts', Icon: HelpCircle, kw: 'doubt question query q&a help' },
  { label: 'Flashcards', to: '/dashboard?tab=flashcards', Icon: BookOpen, kw: 'cards revise memorize' },
  { label: 'Notes', to: '/dashboard?tab=notes', Icon: FileText, kw: 'notes write scratchpad' },
  { label: 'PYQ Tracker', to: '/dashboard?tab=pyq', Icon: ListChecks, kw: 'previous year questions practice' },
  { label: 'Focus Mode', to: '/dashboard?tab=focus', Icon: Target, kw: 'pomodoro timer concentrate white noise' },
  { label: 'Study Planner', to: '/dashboard?tab=planner', Icon: CalendarDays, kw: 'plan schedule' },
  { label: 'Report Card', to: '/dashboard?tab=reportcard', Icon: TrendingUp, kw: 'grades report analysis' },
  { label: 'Mentor Profile', to: '/mentor-profile', Icon: GraduationCap, kw: 'bhima sankar' },
  { label: 'Success Stories', to: '/stories', Icon: Sparkles, kw: 'community' },
  { label: 'Settings', to: '/settings', Icon: SettingsIcon, kw: 'profile password targets account' },
]

export default function CommandPalette() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); setOpen(o => !o); setQ(''); setActive(0)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus() }, [open])

  if (!user || user.role === 'mentor') return null
  if (!open) return null

  const items = [
    ...STUDENT_NAV,
    { label: 'Log out', action: () => { logout(); navigate('/login') }, Icon: LogOut, kw: 'sign out exit' },
  ]
  const ql = q.trim().toLowerCase()
  const results = ql ? items.filter(i => (i.label + ' ' + (i.kw || '')).toLowerCase().includes(ql)) : items
  const safeActive = Math.min(active, Math.max(0, results.length - 1))

  const run = (it) => {
    setOpen(false); setQ('')
    if (it.action) it.action()
    else if (it.to) navigate(it.to)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[safeActive]) run(results[safeActive]) }
  }

  return createPortal(
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="cmdk-input">
          <Search size={18} strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setActive(0) }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page or action…"
            aria-label="Search commands"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="cmdk-list">
          {results.length === 0 && <div className="cmdk-empty">No matches for “{q}”</div>}
          {results.map((it, i) => (
            <button
              key={it.label}
              className={`cmdk-item ${i === safeActive ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); run(it) }}
            >
              <span className="cmdk-ic"><it.Icon size={16} strokeWidth={2} /></span>
              <span className="cmdk-label">{it.label}</span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>Ctrl</kbd>+<kbd>K</kbd> toggle</div>
      </div>

      <style>{`
        .cmdk-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(15,23,42,.5); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); display: flex; align-items: flex-start; justify-content: center; padding: 12vh 16px 16px; animation: cmdkFade .14s ease; }
        @keyframes cmdkFade { from { opacity: 0 } to { opacity: 1 } }
        .cmdk { width: 100%; max-width: 560px; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: 0 28px 70px rgba(2,6,23,.4); overflow: hidden; animation: cmdkPop .16s cubic-bezier(.2,.8,.2,1); }
        @keyframes cmdkPop { from { opacity:0; transform: translateY(-8px) scale(.98) } to { opacity:1; transform:none } }
        .cmdk-input { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); }
        .cmdk-input input { flex: 1; border: none; background: transparent; outline: none; font-family: inherit; font-size: 1rem; color: var(--color-text-primary); }
        .cmdk-input input::placeholder { color: var(--color-text-muted); }
        .cmdk-input kbd, .cmdk-foot kbd { font-family: inherit; font-size: .68rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-secondary); }
        .cmdk-list { max-height: 50vh; overflow-y: auto; padding: 6px; }
        .cmdk-empty { padding: 22px; text-align: center; color: var(--color-text-muted); font-size: .9rem; }
        .cmdk-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: none; border-radius: 10px; background: transparent; color: var(--color-text-primary); font-family: inherit; font-size: .92rem; font-weight: 600; cursor: pointer; text-align: left; }
        .cmdk-item.active { background: var(--color-primary-light); color: var(--color-primary); }
        .cmdk-ic { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: var(--color-bg); color: var(--color-primary); flex-shrink: 0; }
        .cmdk-item.active .cmdk-ic { background: var(--color-primary); color: #fff; }
        .cmdk-foot { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-top: 1px solid var(--color-border); font-size: .72rem; color: var(--color-text-muted); }
      `}</style>
    </div>,
    document.body
  )
}
