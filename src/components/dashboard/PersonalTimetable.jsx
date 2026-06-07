import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  CalendarDays, ClipboardList, Rocket, BookMarked, Lightbulb, Clock,
  CheckCircle2, Sparkles, Flame, Zap, Target, BookOpen, Palmtree, Smile
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_ICONS = { Monday: Sparkles, Tuesday: Flame, Wednesday: Zap, Thursday: Lightbulb, Friday: Target, Saturday: BookOpen, Sunday: Palmtree }

export default function PersonalTimetable() {
  const [timetable, setTimetable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    fetchTimetable()
  }, [])

  const fetchTimetable = async () => {
    try {
      const res = await axios.get(`${API}/api/student/timetable/${user._id}`)
      setTimetable(res.data.timetable)
    } catch (err) {
      console.error('Timetable fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const markComplete = async (day, completed) => {
    if (!timetable) return
    setSaving(day)
    try {
      const res = await axios.post(`${API}/api/student/timetable-complete/${user._id}`, {
        timetableId: timetable._id,
        day,
        completed
      })
      setTimetable(res.data.timetable)
    } catch (err) {
      console.error('Mark complete error:', err)
    } finally {
      setSaving(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const completedCount = timetable?.days?.filter(d => d.studentCompleted)?.length || 0
  const totalDays = timetable?.days?.length || 0
  const progressPct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0

  return (
    <div className="timetable-widget">
      <div className="widget-header">
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <CalendarDays size={18} strokeWidth={2} /> My Weekly Timetable
        </h3>
        {timetable && (
          <span className="week-label">
            Week of {formatDate(timetable.weekStart)}
          </span>
        )}
      </div>

      {loading && (
        <div className="timetable-loading">
          <div className="spinner" />
          <p>Loading your timetable...</p>
        </div>
      )}

      {!loading && !timetable && (
        <div className="timetable-empty">
          <div className="empty-icon"><ClipboardList size={48} strokeWidth={1.5} /></div>
          <h4>No Timetable Assigned Yet</h4>
          <p>Bhima Sankar Sir will assign your personalised weekly timetable once your mentorship begins.</p>
          <p style={{ color: 'var(--color-primary)', fontWeight: 700, marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Stay tuned — your custom schedule is coming! <Rocket size={16} strokeWidth={2} />
          </p>
        </div>
      )}

      {!loading && timetable && (
        <>
          {/* Progress bar */}
          <div className="timetable-progress">
            <div className="progress-info">
              <span>Week Progress</span>
              <span>{completedCount}/{totalDays} days completed</span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #10B981, #059669)' }}
              />
            </div>
          </div>

          {/* Days grid */}
          <div className="timetable-days">
            {DAYS.map(day => {
              const dayData = timetable.days?.find(d => d.day === day)
              if (!dayData) return null
              const isDone = dayData.studentCompleted
              const isSaving = saving === day
              const DayIcon = DAY_ICONS[day]

              return (
                <div key={day} className={`timetable-day-card ${isDone ? 'done' : ''}`}>
                  <div className="day-header">
                    <div className="day-title">
                      <span className="day-icon" style={{ display: 'inline-flex', color: '#F97316' }}>
                        {DayIcon && <DayIcon size={18} strokeWidth={2} />}
                      </span>
                      <span className="day-name">{day}</span>
                    </div>
                    <label className="day-checkbox" title="Mark day complete">
                      <input
                        type="checkbox"
                        checked={isDone}
                        disabled={isSaving}
                        onChange={(e) => markComplete(day, e.target.checked)}
                      />
                      <span className="checkmark" />
                    </label>
                  </div>
                  <div className="day-body">
                    {dayData.subject && (
                      <div className="day-field">
                        <span className="field-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookMarked size={14} strokeWidth={2} /> Subject</span>
                        <span className="field-value">{dayData.subject}</span>
                      </div>
                    )}
                    {dayData.topic && (
                      <div className="day-field">
                        <span className="field-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Lightbulb size={14} strokeWidth={2} /> Topic</span>
                        <span className="field-value">{dayData.topic}</span>
                      </div>
                    )}
                    {dayData.targetHours > 0 && (
                      <div className="day-field">
                        <span className="field-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={14} strokeWidth={2} /> Target</span>
                        <span className="field-value field-hours">{dayData.targetHours}h</span>
                      </div>
                    )}
                    {dayData.description && (
                      <div className="day-desc">{dayData.description}</div>
                    )}
                    {(!dayData.subject && !dayData.topic && !dayData.description) && (
                      <p className="day-empty" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>Rest Day <Smile size={15} strokeWidth={2} /></p>
                    )}
                  </div>
                  {isDone && (
                    <div className="day-done-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <CheckCircle2 size={15} strokeWidth={2} /> Completed
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`
        .timetable-widget { font-family: 'Inter', sans-serif; }
        .widget-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .widget-header h3 { margin:0; font-size:1.1rem; font-weight:800; color:#0F172A; }
        .week-label { background:#F97316; color:#fff; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:700; }
        .timetable-loading, .timetable-empty { text-align:center; padding:40px 20px; }
        .spinner { width:40px; height:40px; border:4px solid #E2E8F0; border-top-color:#F97316; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 16px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .empty-icon { font-size:48px; margin-bottom:12px; }
        .timetable-empty h4 { color:#0F172A; font-size:1.1rem; margin:0 0 8px; }
        .timetable-empty p { color:#64748B; font-size:0.9rem; margin:0; }
        .timetable-progress { margin-bottom:20px; }
        .progress-info { display:flex; justify-content:space-between; font-size:0.82rem; font-weight:700; color:#475569; margin-bottom:6px; }
        .progress-bar-track { height:8px; background:#E2E8F0; border-radius:8px; overflow:hidden; }
        .progress-bar-fill { height:100%; border-radius:8px; transition:width 0.4s ease; }
        .timetable-days { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; }
        .timetable-day-card { background:#F8FAFC; border:2px solid #E2E8F0; border-radius:14px; padding:16px; transition:all 0.2s; }
        .timetable-day-card.done { border-color:#10B981; background:#F0FDF4; }
        .timetable-day-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.08); }
        .day-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .day-title { display:flex; align-items:center; gap:8px; }
        .day-icon { font-size:1.3rem; }
        .day-name { font-weight:800; font-size:0.95rem; color:#0F172A; }
        .day-checkbox { position:relative; cursor:pointer; }
        .day-checkbox input { opacity:0; position:absolute; cursor:pointer; }
        .checkmark { display:block; width:22px; height:22px; background:#E2E8F0; border-radius:6px; transition:all 0.2s; }
        .day-checkbox input:checked ~ .checkmark { background:#10B981; }
        .checkmark:after { content:'✓'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-weight:900; font-size:13px; display:none; }
        .day-checkbox input:checked ~ .checkmark:after { display:block; }
        .day-body { display:flex; flex-direction:column; gap:8px; }
        .day-field { display:flex; gap:8px; align-items:center; }
        .field-label { font-size:0.75rem; font-weight:700; color:#94A3B8; min-width:70px; }
        .field-value { font-size:0.85rem; font-weight:600; color:#1E293B; }
        .field-hours { background:#FFF7ED; color:#F97316; padding:2px 8px; border-radius:12px; font-weight:800; }
        .day-desc { font-size:0.8rem; color:#475569; background:#fff; padding:8px 10px; border-radius:8px; }
        .day-empty { color:#94A3B8; font-size:0.85rem; text-align:center; padding:8px 0; }
        .day-done-badge { margin-top:10px; text-align:center; font-size:0.78rem; font-weight:800; color:#10B981; }
        @media (max-width:768px) { .timetable-days { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
