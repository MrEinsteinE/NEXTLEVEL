import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FileText, ClipboardList, CalendarDays, BookOpen, BookMarked, Clock, PenLine, BarChart3, Target, Brain, Pencil, Send, Trash2, Laugh, Smile, Meh, Moon, Frown } from 'lucide-react'
import { getSyllabus } from '../../data/syllabus.js'
import './DailyStudyReport.css'

const MOODS = [
  { value: 'great', Icon: Laugh, label: 'Great' },
  { value: 'good', Icon: Smile, label: 'Good' },
  { value: 'neutral', Icon: Meh, label: 'Neutral' },
  { value: 'tired', Icon: Moon, label: 'Tired' },
  { value: 'stressed', Icon: Frown, label: 'Stressed' },
]

function DailyStudyReport({ userKey }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const branch = user.branch || 'ECE'
  const userId = userKey || user.id || user.email || 'default'

  const syllabus = getSyllabus(branch)
  const allSubjects = syllabus.flatMap(section => section.subjects.map(s => s.name))

  const todayStr = new Date().toISOString().split('T')[0]

  const [reports, setReports] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState('form') // 'form' | 'history'

  // Form state
  const [date, setDate] = useState(todayStr)
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState('')
  const [studyHours, setStudyHours] = useState(0)
  const [pyqsSolved, setPyqsSolved] = useState('')
  const [mockTestScore, setMockTestScore] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [difficulties, setDifficulties] = useState('')
  const [tomorrowPlan, setTomorrowPlan] = useState('')
  const [mood, setMood] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [loadingReports, setLoadingReports] = useState(true)

  useEffect(() => {
    if (user._id) fetchRecentReports()
  }, [user._id])

  const fetchRecentReports = async () => {
    try {
      const res = await axios.get(`/api/student/study-reports/${user._id}`)
      // map backend field 'subject' to 'subjects' array required by old UI 
      const mappedReports = (res.data.reports || []).map(r => ({
        ...r,
        id: r._id, // needed for edit/delete (handleEdit/handleDelete read .id)
        subjects: r.subject ? r.subject.split(', ') : [],
        topics: r.topic || ''
      }))
      setReports(mappedReports)
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoadingReports(false)
    }
  }

  const saveReports = (updated) => {
    setReports(updated)
    localStorage.setItem(`studyReports_${userId}`, JSON.stringify(updated))
  }

  const toggleSubject = (subj) => {
    setSubjects(prev =>
      prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]
    )
  }

  const resetForm = () => {
    setDate(todayStr)
    setSubjects([])
    setTopics('')
    setStudyHours(0)
    setPyqsSolved('')
    setMockTestScore('')
    setAccuracy('')
    setDifficulties('')
    setTomorrowPlan('')
    setMood('')
    setEditingId(null)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!date || !mood || studyHours <= 0) {
      setError('Please fill date, study hours, and mood.')
      return
    }
    if (new Date(date) > new Date()) {
      setError('Cannot submit a report for a future date.')
      return
    }

    try {
      setSuccess(editingId ? 'Saving…' : 'Submitting...')
      setError('')
      const payload = {
        subject: subjects.join(', '),
        topic: topics,
        studyHours: Number(studyHours),
        pyqsSolved: Number(pyqsSolved) || 0,
        mockTestScore: mockTestScore ? Number(mockTestScore) : null,
        accuracy: accuracy ? Number(accuracy) : null,
        difficulties,
        tomorrowPlan,
        mood
      }
      if (editingId) {
        await axios.patch(`/api/student/study-report/${editingId}`, payload)
      } else {
        await axios.post('/api/student/study-report', { date, ...payload })
      }

      const msg = editingId ? 'Report updated successfully!' : 'Report submitted!'
      toast.success(msg)
      setSuccess(msg)
      resetForm()
      fetchRecentReports()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit report.'
      toast.error(msg)
      setError(msg)
      setSuccess('')
    }
  }

  const handleEdit = (report) => {
    setEditingId(report.id)
    setDate(report.date)
    setSubjects(report.subjects || [])
    setTopics(report.topics || '')
    setStudyHours(report.studyHours)
    setPyqsSolved(report.pyqsSolved || 0)
    setMockTestScore(report.mockTestScore || '')
    setAccuracy(report.accuracy || '')
    setDifficulties(report.difficulties || '')
    setTomorrowPlan(report.tomorrowPlan || '')
    setMood(report.mood || '')
    setViewMode('form')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this report?')) return
    try {
      await axios.delete(`/api/student/study-report/${id}`)
      toast.success('Report deleted')
      fetchRecentReports()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete report')
    }
  }

  const sortedReports = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="study-report-widget">
      <div className="report-tabs">
        <button
          className={`report-tab ${viewMode === 'form' ? 'active' : ''}`}
          onClick={() => { setViewMode('form'); resetForm() }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><FileText size={16} strokeWidth={2} />{editingId ? 'Edit Report' : 'New Report'}</span>
        </button>
        <button
          className={`report-tab ${viewMode === 'history' ? 'active' : ''}`}
          onClick={() => setViewMode('history')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={16} strokeWidth={2} />History ({reports.length})</span>
        </button>
      </div>

      {success && <div className="report-success">{success}</div>}
      {error && <div className="report-error">{error}</div>}

      {viewMode === 'form' && (
        <form className="report-form" onSubmit={handleSubmit}>
          {/* Date */}
          <div className="form-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CalendarDays size={16} strokeWidth={2} />Date</label>
            <input type="date" value={date} max={todayStr} onChange={e => setDate(e.target.value)} disabled={!!editingId} title={editingId ? "The date can't be changed when editing a report" : undefined} />
          </div>

          {/* Subjects multi-select */}
          <div className="form-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><BookOpen size={16} strokeWidth={2} />Subjects Studied</label>
            <div className="subject-chips">
              {allSubjects.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`subject-chip ${subjects.includes(s) ? 'selected' : ''}`}
                  onClick={() => toggleSubject(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Topics covered */}
          <div className="form-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><BookMarked size={16} strokeWidth={2} />Topics Covered</label>
            <input
              type="text"
              placeholder="e.g., Eigenvalues, Superposition Theorem"
              value={topics}
              onChange={e => setTopics(e.target.value)}
            />
          </div>

          {/* Number fields row */}
          <div className="form-numbers">
            <div className="form-row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={16} strokeWidth={2} />Study Hours</label>
              <input type="number" min="0" max="24" step="0.5" value={studyHours} onChange={e => setStudyHours(e.target.value)} />
            </div>
            <div className="form-row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><PenLine size={16} strokeWidth={2} />PYQs Solved</label>
              <input type="number" min="0" value={pyqsSolved} onChange={e => setPyqsSolved(e.target.value)} />
            </div>
            <div className="form-row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><BarChart3 size={16} strokeWidth={2} />Mock Test Score</label>
              <input type="number" min="0" max="100" placeholder="Optional" value={mockTestScore} onChange={e => setMockTestScore(e.target.value)} />
            </div>
            <div className="form-row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Target size={16} strokeWidth={2} />Accuracy %</label>
              <input type="number" min="0" max="100" placeholder="Optional" value={accuracy} onChange={e => setAccuracy(e.target.value)} />
            </div>
          </div>

          {/* Difficulties */}
          <div className="form-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Frown size={16} strokeWidth={2} />Difficulties Faced</label>
            <textarea rows="2" placeholder="Any challenges or concepts you struggled with..." value={difficulties} onChange={e => setDifficulties(e.target.value)} />
          </div>

          {/* Plan for tomorrow */}
          <div className="form-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={16} strokeWidth={2} />Plan for Tomorrow</label>
            <textarea rows="2" placeholder="What do you plan to study tomorrow?" value={tomorrowPlan} onChange={e => setTomorrowPlan(e.target.value)} />
          </div>

          {/* Mood */}
          <div className="form-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Brain size={16} strokeWidth={2} />How are you feeling?</label>
            <div className="mood-picker">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
                  onClick={() => setMood(m.value)}
                >
                  <span className="mood-emoji"><m.Icon size={20} strokeWidth={2} /></span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="report-submit-btn">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {editingId ? <><Pencil size={16} strokeWidth={2} />Update Report</> : <><Send size={16} strokeWidth={2} />Submit Report</>}
            </span>
          </button>
        </form>
      )}

      {viewMode === 'history' && (
        <div className="report-history">
          {sortedReports.length === 0 && (
            <div className="report-empty">
              <p>No reports submitted yet. Start by filling out today's study report!</p>
            </div>
          )}
          {sortedReports.map(r => (
            <div key={r.id} className="report-card">
              <div className="report-card-header">
                <span className="report-date">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <div className="report-actions">
                  <button className="edit-btn" onClick={() => handleEdit(r)}><Pencil size={15} strokeWidth={2} style={{ verticalAlign: 'middle' }} /></button>
                  <button className="delete-btn" onClick={() => handleDelete(r.id)}><Trash2 size={15} strokeWidth={2} style={{ verticalAlign: 'middle' }} /></button>
                </div>
              </div>
              <div className="report-card-body">
                <div className="report-stats-row">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={15} strokeWidth={2} />{r.studyHours}h</span>
                  {r.pyqsSolved > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><PenLine size={15} strokeWidth={2} />{r.pyqsSolved} PYQs</span>}
                  {r.mockTestScore > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BarChart3 size={15} strokeWidth={2} />{r.mockTestScore}/100</span>}
                  {r.accuracy > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Target size={15} strokeWidth={2} />{r.accuracy}%</span>}
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>{(() => { const MoodIcon = MOODS.find(m => m.value === r.mood)?.Icon || Meh; return <MoodIcon size={15} strokeWidth={2} /> })()}</span>
                </div>
                {r.subjects?.length > 0 && (
                  <div className="report-subjects">
                    {r.subjects.map(s => <span key={s} className="report-subject-tag">{s}</span>)}
                  </div>
                )}
                {r.topics && <p className="report-topics" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookMarked size={15} strokeWidth={2} />{r.topics}</p>}
                {r.difficulties && <p className="report-diff" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Frown size={15} strokeWidth={2} />{r.difficulties}</p>}
                {r.tomorrowPlan && <p className="report-plan" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={15} strokeWidth={2} />{r.tomorrowPlan}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DailyStudyReport
