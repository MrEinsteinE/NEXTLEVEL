import { useState, useEffect } from 'react'
import axios from 'axios'
import { Calendar, Save, Trash2, Wand2, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getTemplatesForBranch, getSubjectsForBranch } from '../../data/timetableTemplates.js'
import Select from '../common/Select.jsx'

const API = import.meta.env.VITE_API_URL || ''
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const defaultDay = (day) => ({ day, subject: '', topic: '', targetHours: 0, description: '' })

/**
 * TimetableEditor – Mentor creates/edits a student's weekly timetable.
 * Props:
 *   studentId: string
 *   existingTimetable: object | null
 *   branch: 'ECE' | 'EE' | 'CSE'   (for template + subject suggestions)
 *   onSaved: function(timetable)
 */
export default function TimetableEditor({ studentId, existingTimetable, branch = 'CSE', onSaved }) {
  const today = new Date()
  const defaultWeekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1))
    .toISOString()
    .split('T')[0]

  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [days, setDays] = useState(DAYS.map(defaultDay))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [templateIdx, setTemplateIdx] = useState('')

  const templates = getTemplatesForBranch(branch)
  const subjects = getSubjectsForBranch(branch)

  const applyTemplate = () => {
    if (templateIdx === '') return
    const tpl = templates[Number(templateIdx)]
    if (!tpl) return
    setDays(DAYS.map(day => {
      const t = tpl.days.find(d => d.day === day)
      return t ? { ...defaultDay(day), ...t } : defaultDay(day)
    }))
  }

  useEffect(() => {
    if (existingTimetable) {
      setWeekStart(existingTimetable.weekStart?.split('T')[0] || defaultWeekStart)
      const merged = DAYS.map(day => {
        const existing = existingTimetable.days?.find(d => d.day === day)
        return existing ? { ...defaultDay(day), ...existing } : defaultDay(day)
      })
      setDays(merged)
    }
  }, [existingTimetable])

  const updateDay = (dayName, field, value) => {
    setDays(prev => prev.map(d => d.day === dayName ? { ...d, [field]: value } : d))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await axios.post(
        `${API}/api/mentor/timetable/${studentId}`,
        { weekStart, days }
      )
      setSaved(true)
      if (onSaved) onSaved(res.data.timetable)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save timetable')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tt-editor">
      <div className="tt-editor-header">
        <h4><Calendar size={16} /> Weekly Timetable Editor</h4>
        <div className="week-picker">
          <label>Week Start</label>
          <input
            type="date"
            value={weekStart}
            onChange={e => setWeekStart(e.target.value)}
          />
        </div>
      </div>

      {/* One-click template, then fine-tune below */}
      <div className="tt-template-bar">
        <Wand2 size={16} className="tt-wand" />
        <span className="tt-template-label">Quick start ({branch}):</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Select
            value={templateIdx}
            onChange={setTemplateIdx}
            ariaLabel="Quick-start template"
            placeholder="Choose a template…"
            options={templates.map((t, i) => ({ value: i, label: t.name }))}
          />
        </div>
        <button type="button" className="tt-apply-btn" onClick={applyTemplate} disabled={templateIdx === ''}>
          Apply
        </button>
      </div>

      {/* Subject suggestions for this branch */}
      <datalist id="tt-subjects">
        {subjects.map(s => <option key={s} value={s} />)}
      </datalist>

      <div className="tt-days-grid">
        {days.map((dayEntry, idx) => (
          <div key={dayEntry.day} className="tt-day">
            <div className="tt-day-header">
              <span className="tt-day-num">{idx + 1}</span>
              <span className="tt-day-name">{dayEntry.day}</span>
            </div>
            <div className="tt-day-fields">
              <input
                type="text"
                list="tt-subjects"
                placeholder="Subject (pick or type)"
                value={dayEntry.subject}
                onChange={e => updateDay(dayEntry.day, 'subject', e.target.value)}
              />
              <input
                type="text"
                placeholder="Topic (e.g. Fourier Transform)"
                value={dayEntry.topic}
                onChange={e => updateDay(dayEntry.day, 'topic', e.target.value)}
              />
              <div className="tt-row">
                <label><Clock size={13} /> Target Hours</label>
                <input
                  type="number"
                  min="0"
                  max="16"
                  step="0.5"
                  value={dayEntry.targetHours}
                  onChange={e => updateDay(dayEntry.day, 'targetHours', parseFloat(e.target.value) || 0)}
                  className="tt-hours-input"
                />
              </div>
              <textarea
                placeholder="Special instructions or description..."
                value={dayEntry.description}
                rows={2}
                onChange={e => updateDay(dayEntry.day, 'description', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <div className="tt-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} strokeWidth={2} /> {error}</div>}
      {saved && <div className="tt-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} strokeWidth={2} /> Timetable saved successfully!</div>}

      <div className="tt-actions">
        <button className="tt-save-btn" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save Timetable'}
        </button>
        <button className="tt-clear-btn" onClick={() => setDays(DAYS.map(defaultDay))}>
          <Trash2 size={15} /> Clear All
        </button>
      </div>

      <style>{`
        .tt-editor { font-family:'Inter',sans-serif; }
        .tt-editor-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
        .tt-editor-header h4 { margin:0; font-size:1rem; font-weight:800; color:#0F172A; display:inline-flex; align-items:center; gap:6px; }
        .tt-template-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 14px; margin-bottom:14px; border-radius:12px; background:linear-gradient(135deg, rgba(108,99,255,.10), rgba(168,85,247,.10)); border:1px solid rgba(108,99,255,.25); }
        .tt-wand { color:#6C63FF; flex-shrink:0; }
        .tt-template-label { font-size:.82rem; font-weight:700; color:#475569; }
        .tt-template-bar select { flex:1; min-width:180px; padding:8px 10px; border:1px solid #E2E8F0; border-radius:8px; font-size:.84rem; font-family:'Inter',sans-serif; background:#fff; color:#1e293b; }
        .tt-apply-btn { padding:8px 18px; border:none; border-radius:8px; font-weight:800; font-size:.84rem; cursor:pointer; color:#fff; background:linear-gradient(135deg,#6C63FF,#A855F7); transition:transform .15s, box-shadow .15s; }
        .tt-apply-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 16px rgba(108,99,255,.4); }
        .tt-apply-btn:disabled { opacity:.5; cursor:not-allowed; }
        .week-picker { display:flex; align-items:center; gap:8px; }
        .week-picker label { font-size:0.8rem; font-weight:700; color:#64748B; }
        .week-picker input { padding:6px 10px; border:2px solid #E2E8F0; border-radius:8px; font-size:0.85rem; }
        .tt-days-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; margin-bottom:16px; }
        .tt-day { background:#F8FAFC; border:2px solid #E2E8F0; border-radius:12px; overflow:hidden; }
        .tt-day-header { background:#0F172A; color:#fff; padding:8px 12px; display:flex; align-items:center; gap:8px; }
        .tt-day-num { background:#F97316; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:900; flex-shrink:0; }
        .tt-day-name { font-weight:800; font-size:0.9rem; }
        .tt-day-fields { padding:12px; display:flex; flex-direction:column; gap:8px; }
        .tt-day-fields input[type="text"], .tt-day-fields textarea {
          width:100%; padding:7px 10px; border:1px solid #E2E8F0; border-radius:8px;
          font-size:0.82rem; font-family:'Inter',sans-serif; resize:vertical; box-sizing:border-box;
          transition:border-color 0.2s;
        }
        .tt-day-fields input:focus, .tt-day-fields textarea:focus { border-color:#F97316; outline:none; }
        .tt-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .tt-row label { font-size:0.78rem; font-weight:700; color:#64748B; display:inline-flex; align-items:center; gap:4px; }
        .tt-hours-input { width:80px!important; text-align:center; font-weight:800; }
        .tt-error { background:#FEE2E2; color:#DC2626; padding:10px 14px; border-radius:10px; font-size:0.85rem; font-weight:700; margin-bottom:12px; }
        .tt-success { background:#DCFCE7; color:#16A34A; padding:10px 14px; border-radius:10px; font-size:0.85rem; font-weight:700; margin-bottom:12px; }
        .tt-actions { display:flex; gap:10px; }
        .tt-save-btn { flex:1; padding:12px; background:linear-gradient(135deg,#F97316,#EA580C); color:#fff; border:none; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        .tt-save-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 15px rgba(249,115,22,0.4); }
        .tt-save-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .tt-clear-btn { padding:12px 18px; background:#F1F5F9; color:#64748B; border:none; border-radius:10px; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        .tt-clear-btn:hover { background:#E2E8F0; }
        @media (max-width:768px) { .tt-days-grid { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
