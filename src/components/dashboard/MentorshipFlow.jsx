import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Map, Handshake, Target, BookOpen, CalendarDays, Dumbbell,
  RefreshCw, Video, Eye, Star, Check, CheckCircle2
} from 'lucide-react'
import { useSocket } from '../../hooks/useSocket.js'

const API = import.meta.env.VITE_API_URL || ''

// Aligned with the backend journey step names (in order):
// Consultation, Goal Setting, Concept Building, PYQ Practice,
// Mock Tests, Weakness Analysis, Revision, GATE Success
const STEP_CONFIG = [
  { Icon: Handshake, color: '#6366F1', desc: 'One-on-one call to understand your goals & background' },
  { Icon: Target, color: '#F97316', desc: 'Lock your target rank, branch & timeline' },
  { Icon: BookOpen, color: '#10B981', desc: 'Build strong fundamentals, subject by subject' },
  { Icon: CalendarDays, color: '#3B82F6', desc: 'Solve previous-year questions consistently' },
  { Icon: Dumbbell, color: '#EF4444', desc: 'Full-length mock tests under exam conditions' },
  { Icon: RefreshCw, color: '#8B5CF6', desc: 'Analyse weak areas and fix them' },
  { Icon: Video, color: '#F59E0B', desc: 'Structured revision of the full syllabus' },
  { Icon: Eye, color: '#0F172A', desc: 'Continuous monitoring all the way to GATE success' }
]

export default function MentorshipFlow() {
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)

  const socket = useSocket()

  useEffect(() => {
    fetchSteps()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('journey-updated', (data) => {
      // Re-fetch steps if updated by mentor
      fetchSteps()
    })
    return () => {
      socket.off('journey-updated')
    }
  }, [socket])

  const fetchSteps = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    try {
      const res = await axios.get(`${API}/api/student/journey/${user._id}`)
      // Backend stores steps as { name, completed, completedDate }.
      // Normalise to the shape this widget renders ({ stepNumber, title, completedAt }).
      const mapped = (res.data.journeySteps || []).map((s, i) => ({
        stepNumber: s.stepNumber || i + 1,
        title: s.title || s.name || `Step ${i + 1}`,
        completed: !!s.completed,
        completedAt: s.completedAt || s.completedDate || null
      }))
      setSteps(mapped)
    } catch (err) {
      // Fallback to defaults if API fails
      setSteps([
        { stepNumber: 1, title: 'Initial consultation and understanding your needs', completed: false },
        { stepNumber: 2, title: 'Identify Your Goal', completed: false },
        { stepNumber: 3, title: 'Fix the Resources', completed: false },
        { stepNumber: 4, title: 'Plan the Schedule', completed: false },
        { stepNumber: 5, title: 'Start Working', completed: false },
        { stepNumber: 6, title: 'Regular Feedback', completed: false },
        { stepNumber: 7, title: 'Weekly Zoom Call', completed: false },
        { stepNumber: 8, title: 'Continuous Monitoring', completed: false }
      ])
    } finally {
      setLoading(false)
    }
  }

  const completedCount = steps.filter(s => s.completed).length
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0
  const activeStep = steps.findIndex(s => !s.completed)

  return (
    <div className="flow-widget">
      <div className="flow-header">
        <div>
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Map size={18} strokeWidth={2} /> Your Mentorship Journey
          </h3>
          <p>8-Step path to GATE success with Bhima Sankar Sir</p>
        </div>
        <div className="flow-progress-badge">
          {completedCount}/{steps.length} Steps
        </div>
      </div>

      {/* Overall progress */}
      <div className="flow-overall-progress">
        <div className="flow-progress-bar">
          <div className="flow-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="flow-pct">{progressPct}%</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="flow-spinner" />
        </div>
      ) : (
        <div className="flow-steps">
          {steps.map((step, idx) => {
            const cfg = STEP_CONFIG[idx] || { Icon: Star, color: '#64748B' }
            const StepIcon = cfg.Icon
            const isActive = idx === activeStep
            const isDone = step.completed

            return (
              <div key={step.stepNumber} className={`flow-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className={`flow-connector ${isDone ? 'done' : ''}`} />
                )}
                <div className="step-icon-wrap" style={{ background: isDone ? cfg.color : '#E2E8F0', borderColor: isActive ? cfg.color : 'transparent', color: isDone ? '#fff' : cfg.color }}>
                  {isDone ? <Check size={18} strokeWidth={3} /> : <StepIcon size={17} strokeWidth={2} />}
                </div>
                <div className="step-info">
                  <div className="step-num">Step {step.stepNumber}</div>
                  <div className="step-title">{step.title}</div>
                  {cfg.desc && <div className="step-desc">{cfg.desc}</div>}
                  {isDone && step.completedAt && (
                    <div className="step-date" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} strokeWidth={2} /> Completed {new Date(step.completedAt).toLocaleDateString('en-IN')}
                    </div>
                  )}
                  {isActive && !isDone && (
                    <div className="step-current-label">← You are here</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .flow-widget { font-family: 'Inter', sans-serif; }
        .flow-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:14px; }
        .flow-header h3 { margin:0 0 4px; font-size:1.05rem; font-weight:800; color:#0F172A; }
        .flow-header p { margin:0; font-size:0.8rem; color:#64748B; }
        .flow-progress-badge { background:#FFF7ED; border:2px solid #F97316; color:#F97316; padding:6px 12px; border-radius:20px; font-size:0.8rem; font-weight:800; white-space:nowrap; }
        .flow-overall-progress { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .flow-progress-bar { flex:1; height:8px; background:#E2E8F0; border-radius:8px; overflow:hidden; }
        .flow-progress-fill { height:100%; background:linear-gradient(90deg,#F97316,#10B981); border-radius:8px; transition:width 0.6s ease; }
        .flow-pct { font-size:0.8rem; font-weight:800; color:#F97316; min-width:32px; }
        .flow-spinner { width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#F97316; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .flow-steps { display:flex; flex-direction:column; gap:0; position:relative; }
        .flow-step { display:flex; gap:14px; align-items:flex-start; padding:10px 0; position:relative; }
        .flow-connector { position:absolute; left:19px; top:42px; width:2px; height:calc(100% - 4px); background:#E2E8F0; z-index:0; }
        .flow-connector.done { background:#10B981; }
        .step-icon-wrap { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:#fff; font-weight:900; flex-shrink:0; z-index:1; border:3px solid transparent; transition:all 0.3s; }
        .step-info { flex:1; padding-top:4px; }
        .step-num { font-size:0.7rem; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.05em; }
        .step-title { font-size:0.88rem; font-weight:700; color:#1E293B; margin:2px 0; }
        .flow-step.active .step-title { color:#F97316; }
        .step-date { font-size:0.75rem; color:#10B981; font-weight:600; margin-top:2px; }
        .step-current-label { font-size:0.75rem; color:#F97316; font-weight:700; margin-top:2px; }
        .step-desc { font-size:0.78rem; color:#64748B; line-height:1.4; margin-top:2px; }
        [data-theme="dark"] .flow-header h3 { color:#F1F0FF; }
        [data-theme="dark"] .flow-header p { color:#9CA3AF; }
        [data-theme="dark"] .step-title { color:#E5E4F0; }
        [data-theme="dark"] .step-desc { color:#9CA3AF; }
        [data-theme="dark"] .flow-connector { background:#3A3A52; }
        [data-theme="dark"] .flow-progress-bar { background:#2A2A3F; }
        [data-theme="dark"] .step-icon-wrap { box-shadow:0 0 0 1px rgba(255,255,255,.06); }
      `}</style>
    </div>
  )
}
