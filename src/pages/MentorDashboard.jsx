import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import TimetableEditor from '../components/mentor/TimetableEditor.jsx'
import ThemeToggle from '../components/common/ThemeToggle.jsx'
import MentorQueries from '../components/dashboard/MentorQueries.jsx'
import MentorStories from '../components/dashboard/MentorStories.jsx'
import MentorWeeklyChallenge from '../components/dashboard/MentorWeeklyChallenge.jsx'
import { useAuth } from '../context/AuthContext'
import {
  User, BarChart3, ClipboardList, BookOpen, MessageCircle, CalendarDays, Map,
  Flame, Trophy, TrendingUp, FileText, Target, Clock, Save, Trash2, Search,
  Users, CheckCircle2, X, AlertTriangle, HelpCircle, Send, Settings as SettingsIcon, Activity
} from 'lucide-react'
import './MentorDashboard.css'

const API = import.meta.env.VITE_API_URL || ''

function MentorDashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [students, setStudents] = useState([])
  const [filter, setFilter] = useState('all')
  const [statusSegment, setStatusSegment] = useState('all') // all | active | pending | new
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedStudentData, setSelectedStudentData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailTab, setDetailTab] = useState('reports')
  const [confirmBox, setConfirmBox] = useState(null) // { title, message, confirmLabel, tone, resolve }
  const [fbSuggestions, setFbSuggestions] = useState([]) // auto-suggested feedback drafts
  const [digest, setDigest] = useState([]) // weekly per-student digest
  const [stepsData, setStepsData] = useState([])
  const [stepsSaving, setStepsSaving] = useState(false)
  const [viewTab, setViewTab] = useState('students') // 'pending' | 'students' | 'stories' | 'feed'
  const [stories, setStories] = useState([])
  const [feed, setFeed] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [showTrash, setShowTrash] = useState(false)
  const [chatMsgs, setChatMsgs] = useState([])
  const [chatText, setChatText] = useState('')

  const getAuthHeaders = () => ({})

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role !== 'mentor') {
      navigate('/login')
      return
    }
    fetchStudents()
    fetchDigest()
  }, [navigate])

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API}/api/mentor/students`, getAuthHeaders())
      setStudents(response.data)
    } catch (error) {
      console.error('Error fetching students:', error)
      const allUsers = JSON.parse(localStorage.getItem('users') || '[]')
      setStudents(allUsers.filter(u => u.role !== 'mentor'))
    } finally {
      setLoading(false)
    }
  }

  const socket = useSocket()
  useEffect(() => {
    if (!socket) return
    // Refresh student list on common events
    socket.on('progress-updated', () => fetchStudents())
    socket.on('syllabus-updated', () => fetchStudents())
    socket.on('student-approved', () => fetchStudents())

    // Live feed items
    const pushFeed = (item) => setFeed(prev => [{ ...item, ts: Date.now() }, ...prev].slice(0, 200))

    socket.on('new-story-pending', (payload) => pushFeed({ type: 'story-pending', text: `New story pending: ${payload.title}`, payload }))
    socket.on('story-approved', (payload) => pushFeed({ type: 'story-approved', text: `Story approved (${payload.storyId})`, payload }))
    socket.on('progress-updated', (payload) => pushFeed({ type: 'progress', text: `Progress updated by ${payload.userId}`, payload }))
    socket.on('journey-updated', (payload) => pushFeed({ type: 'journey', text: `Journey updated for ${payload.userId}`, payload }))
    socket.on('mentor_feedback', (payload) => pushFeed({ type: 'feedback', text: `New mentor feedback for ${payload.feedbackId}`, payload }))

    return () => {
      socket.off('progress-updated')
      socket.off('syllabus-updated')
      socket.off('student-approved')
      socket.off('new-story-pending')
      socket.off('story-approved')
      socket.off('journey-updated')
      socket.off('mentor_feedback')
    }
  }, [socket])

  useEffect(() => {
    if (viewTab === 'stories') fetchStories()
  }, [viewTab])

  // Freeze the background while the (centered, fixed) modal is open so the page
  // behind it doesn't scroll. The modal itself is pinned to the viewport centre.
  useEffect(() => {
    if (!selectedStudent) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [selectedStudent])

  const fetchStudentTracker = async (studentId) => {
    try {
      const res = await axios.get(`${API}/api/mentor/student/${studentId}/tracker`, getAuthHeaders())
      setSelectedStudentData(prev => ({ ...(prev||{}), trackerLogs: res.data.logs || [] }))
    } catch (err) {
      console.error('Error fetching tracker logs', err)
      setSelectedStudentData(prev => ({ ...(prev||{}), trackerLogs: [] }))
    }
  }

  const fetchFeedbackSuggestions = async (studentId) => {
    setFbSuggestions([])
    try {
      const res = await axios.get(`${API}/api/mentor/student/${studentId}/feedback-suggestions`, getAuthHeaders())
      setFbSuggestions(res.data.suggestions || [])
    } catch (err) { setFbSuggestions([]) }
  }

  const fetchDigest = async () => {
    try {
      const res = await axios.get(`${API}/api/mentor/weekly-digest`, getAuthHeaders())
      setDigest(res.data.digest || [])
    } catch (err) { setDigest([]) }
  }

  const fetchFeedback = async (studentId) => {
    try {
      const res = await axios.get(`${API}/api/feedback/${studentId}`, getAuthHeaders())
      setSelectedStudentData(prev => ({ ...(prev||{}), feedbacks: res.data.feedback || [] }))
    } catch (err) {
      console.error('Error fetching feedback', err)
    }
  }

  const handleAddRemark = async (log) => {
    const text = window.prompt('Enter mentor remark for this tracker entry:')
    if (!text) return
    try {
      const studentId = selectedStudent._id || selectedStudent.id
      await axios.post(`${API}/api/feedback`, { studentId, text: `Remark (${new Date(log.date).toLocaleDateString()}): ${text}`, type: 'remark', isPublic: false }, getAuthHeaders())
      toast.success('Bhima Sir added a remark!')
      fetchFeedback(studentId)
    } catch (err) {
      console.error('Add remark error', err)
      toast.error('Failed to add remark')
    }
  }

  const fetchStories = async () => {
    try {
      const res = await axios.get(`${API}/api/stories`, getAuthHeaders())
      setStories(res.data.stories || [])
    } catch (err) {
      console.error('Error fetching stories', err)
      setStories([])
    }
  }

  const approveStory = async (id) => {
    try {
      await axios.put(`${API}/api/stories/${id}/approve`, {}, getAuthHeaders())
      setStories(prev => prev.filter(s => s._id !== id && s.id !== id))
      toast.success('Story is now live')
    } catch (err) {
      console.error('Approve story error', err)
      toast.error('Failed to approve story')
    }
  }

  const addFeedback = async (text) => {
    if (!selectedStudent || !text) return
    try {
      const studentId = selectedStudent._id || selectedStudent.id
      await axios.post(`${API}/api/feedback`, { studentId, text, type: 'mentor', isPublic: true }, getAuthHeaders())
      fetchFeedback(studentId)
    } catch (err) {
      console.error('Add feedback error', err)
      alert('Failed to send feedback')
    }
  }

  // ── Two-way chat / doubts with the selected student ──
  const fetchChat = async (studentId) => {
    try {
      const res = await axios.get(`${API}/api/chat/room/student_${studentId}`, getAuthHeaders())
      setChatMsgs(res.data.messages || [])
    } catch (err) {
      setChatMsgs([])
    }
  }

  const sendChat = () => {
    const sid = selectedStudent?._id || selectedStudent?.id
    const text = chatText.trim()
    if (!sid || !text) return
    if (socket) socket.emit('chat-message', { toUserId: sid, message: text })
    const me = JSON.parse(localStorage.getItem('user') || '{}')
    setChatMsgs(prev => [...prev, { _id: 'tmp-' + Date.now(), message: text, room: `student_${sid}`, sender: { _id: me._id, name: me.name, role: 'mentor' }, createdAt: new Date().toISOString() }])
    setChatText('')
  }

  const handleSaveSteps = async () => {
    if (!selectedStudent) return
    setStepsSaving(true)
    try {
      const id = selectedStudent._id || selectedStudent.id
      const res = await axios.post(`${API}/api/mentor/step/${id}`, { steps: stepsData }, getAuthHeaders())
      setStepsData(res.data.steps || stepsData)
      toast.success('Steps updated successfully!')
    } catch (err) {
      console.error('Save steps error:', err)
        toast.error('Failed to update steps')
    } finally {
      setStepsSaving(false)
    }
  }

  const toggleStep = (stepNum, completed) => {
    setStepsData(prev => prev.map(s => s.stepNumber === stepNum ? { ...s, completed } : s))
  }

  const handleLogout = () => {
    // Use the context logout so the in-memory auth state is cleared too —
    // otherwise <PublicRoute> still sees a user and bounces /login back to the
    // dashboard, causing a redirect loop / blank screen.
    logout()
    navigate('/login')
  }

  // ── Approve / Reject / open-detail (these were referenced in the JSX but
  //    never defined — so the buttons threw a ReferenceError and did nothing). ──
  // Promise-based confirmation popup. Resolves true (confirmed) / false (cancelled).
  const askConfirm = (opts) => new Promise(resolve => setConfirmBox({ ...opts, resolve }))

  const handleApprove = async (id) => {
    const ok = await askConfirm({
      title: 'Approve this student?',
      message: 'They will get full access to the platform and can start their mentorship.',
      confirmLabel: 'Approve', tone: 'approve'
    })
    if (!ok) return false
    try {
      await axios.put(`${API}/api/mentor/students/${id}/approve`, {}, getAuthHeaders())
      setStudents(prev => prev.map(s => (s._id === id || s.id === id) ? { ...s, status: 'approved' } : s))
      toast.success('Student approved ✓')
      return true
    } catch (err) {
      console.error('Approve error:', err)
      toast.error(err.response?.data?.message || 'Failed to approve student')
      return false
    }
  }

  const handleReject = async (id) => {
    const ok = await askConfirm({
      title: 'Reject this student?',
      message: 'They will lose access to the platform. You can restore them later from the rejected list.',
      confirmLabel: 'Reject', tone: 'reject'
    })
    if (!ok) return false
    try {
      await axios.put(`${API}/api/mentor/students/${id}/reject`, {}, getAuthHeaders())
      setStudents(prev => prev.map(s => (s._id === id || s.id === id) ? { ...s, status: 'rejected' } : s))
      toast.success('Student rejected')
      return true
    } catch (err) {
      console.error('Reject error:', err)
      toast.error(err.response?.data?.message || 'Failed to reject student')
      return false
    }
  }

  // Approve/Reject from inside the detail popup — only flips the open modal's
  // status when the action actually succeeds (not when the confirm is cancelled).
  const approveFromModal = async () => {
    if (!selectedStudent) return
    const ok = await handleApprove(selectedStudent._id || selectedStudent.id)
    if (ok) setSelectedStudent(prev => prev ? { ...prev, status: 'approved' } : prev)
  }
  const rejectFromModal = async () => {
    if (!selectedStudent) return
    const ok = await handleReject(selectedStudent._id || selectedStudent.id)
    if (ok) setSelectedStudent(prev => prev ? { ...prev, status: 'rejected' } : prev)
  }

  const handleStudentClick = async (s) => {
    setSelectedStudent(s)
    setDetailTab('reports')
    setSelectedStudentData(null)
    setStepsData([])
    setChatMsgs([])
    try {
      const id = s._id || s.id
      const res = await axios.get(`${API}/api/mentor/student/${id}/detail`, getAuthHeaders())
      const d = res.data || {}
      const st = d.student || {}
      setSelectedStudentData({
        reports: d.recentReports || [],
        metrics: { streak: st.streak || 0, consistencyScore: st.consistencyScore || 0, badges: st.badges || [] },
        timetable: d.timetable || null,
        syllabusPercentage: d.syllabusPercentage || 0
      })
      setStepsData((st.journeySteps || []).map((j, i) => ({
        stepNumber: i + 1, title: j.name, completed: j.completed, completedAt: j.completedDate
      })))
    } catch (err) {
      console.error('Error fetching student detail:', err)
      setSelectedStudentData({ reports: [], metrics: {}, timetable: null })
    }
  }

  const renderStudentDetail = () => {
    if (!selectedStudent) return null
    const s = selectedStudent
    const data = selectedStudentData || { reports: [], metrics: {}, timetable: null }
    const reports = data.reports || []
    const metrics = data.metrics || {}

    const totalHours = reports.reduce((sum, r) => sum + (Number(r.studyHours) || 0), 0)
    const totalPYQs = reports.reduce((sum, r) => sum + (Number(r.pyqsSolved) || 0), 0)
    const avgAccuracy = reports.length > 0
      ? Math.round(reports.filter(r => r.accuracy).reduce((sum, r) => sum + Number(r.accuracy), 0) / Math.max(1, reports.filter(r => r.accuracy).length))
      : 0
    const streak = metrics.streak || s.streak || 0
    const badges = metrics.badges || s.badges || []

    // Render through a portal to <body> so the fixed overlay escapes the page's
    // transformed ancestor (.mentor-dash-page has a transform from its fade-in
    // animation, which would otherwise trap position:fixed and break centering).
    return createPortal(
      <div className="student-modal-overlay" onClick={() => { setSelectedStudent(null); setSelectedStudentData(null) }}>
        <div className="student-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>{s.name}</h2>
              <p className="modal-subtitle">{s.email} • {s.branch} • <span className={`status-tag ${s.status}`}>{s.status}</span></p>
            </div>
            <div className="modal-header-actions">
              {(s.status === 'pending' || s.status === 'rejected') && (
                <button className="approve-btn" type="button" onClick={approveFromModal} title={s.status === 'rejected' ? 'Restore this student' : 'Approve this student'}>
                  <CheckCircle2 size={15} strokeWidth={2} /> {s.status === 'rejected' ? 'Restore' : 'Approve'}
                </button>
              )}
              {(s.status === 'pending' || s.status === 'approved') && (
                <button className="reject-btn" type="button" onClick={rejectFromModal} title="Reject this student">
                  <X size={15} strokeWidth={2} /> Reject
                </button>
              )}
              <button className="modal-close" onClick={() => { setSelectedStudent(null); setSelectedStudentData(null) }} aria-label="Close"><X size={18} strokeWidth={2} /></button>
            </div>
          </div>

          <div className="modal-stats">
            <div className="modal-stat">
              <span className="ms-num">{totalHours.toFixed(1)}h</span>
              <span className="ms-label">Total Study Hours</span>
            </div>
            <div className="modal-stat">
              <span className="ms-num">{totalPYQs}</span>
              <span className="ms-label">PYQs Solved</span>
            </div>
            <div className="modal-stat">
              <span className="ms-num">{avgAccuracy}%</span>
              <span className="ms-label">Avg Accuracy</span>
            </div>
            <div className="modal-stat">
              <span className="ms-num"><Flame size={18} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> {streak}</span>
              <span className="ms-label">Day Streak</span>
            </div>
            <div className="modal-stat">
              <span className="ms-num">{metrics.consistencyScore || 0}%</span>
              <span className="ms-label">Consistency</span>
            </div>
            <div className="modal-stat">
              <span className="ms-num">{reports.length}</span>
              <span className="ms-label">Reports</span>
            </div>
          </div>

          <div className="modal-sub-tabs">
            {[
              ['overview', 'Overview', User],
              ['tracker', 'Tracker', BarChart3],
              ['reports', 'Reports', ClipboardList],
              ['syllabus', 'Syllabus', BookOpen],
              ['feedback', 'Feedback', MessageCircle],
              ['doubts', 'Doubts', HelpCircle],
              ['timetable', 'Timetable', CalendarDays],
              ['steps', 'Steps', Map],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                className={`modal-sub-tab ${detailTab === id ? 'active' : ''}`}
                onClick={() => { setDetailTab(id); if (id === 'tracker') fetchStudentTracker(s._id || s.id); if (id === 'feedback') { fetchFeedback(s._id || s.id); fetchFeedbackSuggestions(s._id || s.id) } if (id === 'doubts') fetchChat(s._id || s.id) }}
              >
                <Icon size={16} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {label}
              </button>
            ))}
          </div>

          {detailTab === 'overview' && (
            <div className="modal-section">
              <h3>Overview</h3>
              <p className="modal-muted">High level metrics and quick links.</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <div className="modal-stat" style={{ padding: 12 }}>
                  <div className="ms-num">{metrics.streak || 0}</div>
                  <div className="ms-label">Streak</div>
                </div>
                <div className="modal-stat" style={{ padding: 12 }}>
                  <div className="ms-num">{metrics.consistencyScore || 0}%</div>
                  <div className="ms-label">Consistency</div>
                </div>
                <div className="modal-stat" style={{ padding: 12 }}>
                  <div className="ms-num">{reports.length}</div>
                  <div className="ms-label">Reports</div>
                </div>
                <div className="modal-stat" style={{ padding: 12 }}>
                  <div className="ms-num">{data.syllabusPercentage ?? 0}%</div>
                  <div className="ms-label">Syllabus</div>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'tracker' && (
            <div className="modal-section">
              <h3 className="modal-h3-icon"><BarChart3 size={18} strokeWidth={2} /> Read-only Tracker</h3>
              <p className="modal-muted">View daily tracker logs. Use "Add Remark" to send mentor feedback for a row.</p>
              {(!data.trackerLogs || data.trackerLogs.length === 0) && <p className="modal-muted">No tracker logs available.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {(data.trackerLogs || []).map((log, idx) => (
                  <div key={idx} style={{ border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{new Date(log.date).toLocaleDateString()}</div>
                      <div style={{ color: '#64748B', fontSize: '0.9rem' }}>{(log.entries || []).map(e => `${e.subject}: ${e.hours}h`).join(' • ')}</div>
                      {log.mentorRemarks && <div style={{ marginTop:8, color: '#065f46' }}>Mentor: {log.mentorRemarks}</div>}
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <button className="steps-save-btn" onClick={() => handleAddRemark(log)}>Add Remark</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailTab === 'feedback' && (
            <div className="modal-section">
              <h3 className="modal-h3-icon"><MessageCircle size={18} strokeWidth={2} /> Mentor Feedback</h3>
              <p className="modal-muted">Send guidance or quick remarks to the student.</p>

              {fbSuggestions.length > 0 && (
                <div className="fb-suggest">
                  <div className="fb-suggest-label">✨ Suggested — based on this week's activity. Click to insert, then edit:</div>
                  <div className="fb-suggest-chips">
                    {fbSuggestions.map((sg, i) => (
                      <button
                        key={i}
                        type="button"
                        className="fb-suggest-chip"
                        title={sg.text}
                        onClick={() => { const el = document.getElementById('mentor-feedback-text'); if (el) { el.value = sg.text; el.focus(); } }}
                      >
                        {sg.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <textarea id="mentor-feedback-text" rows={4} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} placeholder="Write feedback..." />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="steps-save-btn" onClick={() => { const t = document.getElementById('mentor-feedback-text').value; addFeedback(t); document.getElementById('mentor-feedback-text').value=''; }}>Send Feedback</button>
                  <button className="m-action-btn secondary" onClick={() => fetchFeedback(s._id || s.id)}>Refresh</button>
                </div>

                <div style={{ marginTop: 14 }}>
                  {(data.feedbacks || []).map((fb, i) => (
                    <div key={i} style={{ border: '1px solid #F1F5F9', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>{fb.mentorId?.name || 'Mentor'}</div>
                      <div style={{ color: '#64748B', fontSize: '0.9rem' }}>{fb.text}</div>
                      <div style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: 6 }}>{new Date(fb.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {detailTab === 'doubts' && (
            <div className="modal-section">
              <h3 className="modal-h3-icon"><HelpCircle size={18} strokeWidth={2} /> Student Doubts &amp; Chat</h3>
              <p className="modal-muted">Two-way chat with {s.name}. Your replies appear on the student's dashboard instantly.</p>
              <div className="mentor-chat-thread">
                {chatMsgs.length === 0 && <p className="modal-muted">No messages yet. When {(s.name || 'the student').split(' ')[0]} asks a doubt, it appears here.</p>}
                {chatMsgs.map((m, i) => {
                  const isMentor = m.sender?.role === 'mentor'
                  return (
                    <div key={m._id || i} className={`mc-msg ${isMentor ? 'mc-mentor' : 'mc-student'}`}>
                      <div className="mc-bubble">{m.message}</div>
                      <div className="mc-time">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                  )
                })}
              </div>
              <div className="mentor-chat-input">
                <input
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendChat() }}
                  placeholder="Reply to your student…"
                />
                <button className="steps-save-btn" onClick={sendChat} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Send size={15} strokeWidth={2} /> Send</button>
                <button className="m-action-btn secondary" onClick={() => fetchChat(s._id || s.id)}>Refresh</button>
              </div>
            </div>
          )}

          {detailTab === 'syllabus' && (
            <div className="modal-section">
              <h3 className="modal-h3-icon"><BookOpen size={18} strokeWidth={2} /> Syllabus Progress</h3>
              <p className="modal-muted">Completed: {data.syllabusPercentage ?? 0}%</p>
            </div>
          )}

          {detailTab === 'reports' && (
            <div className="modal-content-area">
              <div className="modal-section">
                <h3 className="modal-h3-icon"><Trophy size={18} strokeWidth={2} /> Badges Earned</h3>
                {badges.length > 0 ? (
                  <div className="modal-badges">
                    {badges.map((b, i) => <span key={i} className="modal-badge">{b.name || b}</span>)}
                  </div>
                ) : (
                  <p className="modal-muted">No badges earned yet.</p>
                )}
              </div>
              
              {reports.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-h3-icon"><TrendingUp size={18} strokeWidth={2} /> Consistency Graph</h3>
                  <div style={{ height: '200px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[...reports].reverse().map(r => ({
                          date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                          hours: r.studyHours
                        }))}
                        margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.5} stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#94a3b8" />
                        <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          labelStyle={{ fontWeight: 'bold', color: 'var(--color-primary)' }}
                        />
                        <Line type="monotone" dataKey="hours" stroke="var(--color-primary)" strokeWidth={3} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="modal-section">
                <h3 className="modal-h3-icon"><ClipboardList size={18} strokeWidth={2} /> Recent Study Reports ({reports.length})</h3>
                {reports.length === 0 && <p className="modal-muted">No reports submitted yet.</p>}
                <div className="modal-reports">
                  {reports.slice(0, 10).map((r, i) => (
                    <div key={i} className="modal-report-row">
                      <div className="mr-date">
                        {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="mr-details">
                        <span><Clock size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> {r.studyHours}h</span>
                        <span><FileText size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> {r.pyqsSolved || 0} PYQs</span>
                        {r.accuracy && <span><Target size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> {r.accuracy}%</span>}
                        {r.mockTestScore && <span><BarChart3 size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> {r.mockTestScore}/100</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {detailTab === 'timetable' && (
            <div className="modal-section">
              <TimetableEditor
                studentId={selectedStudent?._id || selectedStudent?.id}
                existingTimetable={data.timetable}
                branch={selectedStudent?.branch}
                onSaved={(updated) => setSelectedStudentData(prev => ({ ...prev, timetable: updated }))}
              />
            </div>
          )}

          {detailTab === 'steps' && (
            <div className="modal-section">
              <h3 className="modal-h3-icon"><Map size={18} strokeWidth={2} /> Mentorship Journey Progress</h3>
              <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '16px' }}>
                Check steps as you complete them with the student.
              </p>
              <div className="steps-list">
                {stepsData.length === 0 && (
                  <p className="modal-muted">No steps data yet. Steps will appear after the student's first session.</p>
                )}
                {stepsData.map((step) => (
                  <label key={step.stepNumber} className={`step-row ${step.completed ? 'done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={e => toggleStep(step.stepNumber, e.target.checked)}
                    />
                    <div className="step-row-info">
                      <span className="step-row-num">Step {step.stepNumber}</span>
                      <span className="step-row-title">{step.title}</span>
                      {step.completed && step.completedAt && (
                        <span className="step-row-date"><CheckCircle2 size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> {new Date(step.completedAt).toLocaleDateString('en-IN')}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {stepsData.length > 0 && (
                <button className="steps-save-btn" onClick={handleSaveSteps} disabled={stepsSaving}>
                  {stepsSaving
                    ? <><Clock size={16} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Saving...</>
                    : <><Save size={16} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Save Steps</>}
                </button>
              )}
            </div>
          )}
        </div>
        <style>{`
          /* ── Modal shell (these were unstyled, so the modal rendered full-bleed) ── */
          /* The overlay is the scroll container — if the modal is taller than the
             screen, the overlay scrolls (top always reachable) instead of the modal
             being clipped off the top of the viewport. */
          .student-modal-overlay {
            position: fixed; inset: 0; z-index: 2000;
            background: rgba(15,23,42,.55);
            -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
            display: flex; padding: 24px;
            overflow-y: auto;
          }
          /* Background (low specificity) so dark-theme can override it in dark mode. */
          .student-modal { background: #fff; }
          /* Centre with margin:auto inside the scrollable flex overlay. When the modal
             fits it's centred; when it's taller than the viewport it pins to the top and
             the overlay scrolls — it is NEVER clipped off-screen. Overrides index.css's
             mobile bottom-sheet rule (same specificity, loaded later in the document). */
          .student-modal-overlay > .student-modal {
            position: static; transform: none;
            top: auto; bottom: auto; left: auto; right: auto;
            margin: auto;
            width: calc(100% - 48px); max-width: 760px;
            height: auto; max-height: none;
            border-radius: 20px; padding: 24px 28px;
            box-shadow: 0 24px 60px rgba(2,6,23,.30);
            animation: modalPop .22s cubic-bezier(.2,.8,.2,1);
          }
          @keyframes modalPop {
            from { opacity: 0; transform: translateY(10px) scale(.985); }
            to   { opacity: 1; transform: none; }
          }
          .modal-header { align-items: flex-start; }
          .modal-header h2 { font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0; }
          .modal-subtitle { color: #64748b; font-size: .9rem; margin-top: 2px; }
          .modal-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
          .mentor-chat-thread { display:flex; flex-direction:column; gap:8px; max-height:320px; overflow-y:auto; padding:12px; background:#f8fafc; border:1px solid #eef1f6; border-radius:10px; margin-top:12px; }
          .mc-msg { display:flex; flex-direction:column; max-width:80%; }
          .mc-student { align-self:flex-start; align-items:flex-start; }
          .mc-mentor { align-self:flex-end; align-items:flex-end; }
          .mc-bubble { padding:8px 12px; border-radius:12px; font-size:.9rem; line-height:1.4; }
          .mc-student .mc-bubble { background:#fff; border:1px solid #e2e8f0; color:#1e293b; }
          .mc-mentor .mc-bubble { background:var(--color-primary, #6c63ff); color:#fff; }
          .mc-time { font-size:.7rem; color:#94a3b8; margin-top:2px; }
          .mentor-chat-input { display:flex; gap:8px; margin-top:12px; }
          .mentor-chat-input input { flex:1; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; font-family:inherit; font-size:.9rem; outline:none; }
          .modal-close {
            width: 38px; height: 38px; flex-shrink: 0; border: none; border-radius: 10px;
            background: #f1f5f9; color: #475569; font-size: 1rem; cursor: pointer; transition: all .15s;
          }
          .modal-close:hover { background: #fee2e2; color: #dc2626; }
          .modal-section h3 { font-size: 1rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
          .modal-badges { display: flex; flex-wrap: wrap; gap: 8px; }
          .modal-badge { background: var(--color-primary-light); color: var(--color-primary); font-weight: 700; font-size: .78rem; padding: 6px 12px; border-radius: 999px; }
          .modal-reports { display: flex; flex-direction: column; gap: 8px; }
          .modal-report-row { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border: 1px solid #eef1f6; border-radius: 10px; background: #fcfdff; }
          .mr-date { font-weight: 800; color: #1e293b; font-size: .85rem; min-width: 64px; }
          .mr-details { display: flex; gap: 14px; flex-wrap: wrap; color: #64748b; font-size: .85rem; }
          .modal-content-area { padding-right: 5px; }
          .modal-sub-tabs { display:flex; gap:8px; margin:16px 0; border-bottom:2px solid #E2E8F0; padding-bottom:0; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:thin; }
          .modal-sub-tabs::-webkit-scrollbar { height:6px; }
          .modal-sub-tabs::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:999px; }
          .modal-sub-tab { padding:8px 18px; background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; font-size:0.85rem; font-weight:700; color:#64748B; transition:all 0.2s; flex-shrink:0; white-space:nowrap; }
          .modal-sub-tab.active { color:#F97316; border-bottom-color:#F97316; }
          .steps-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
          .step-row { display:flex; gap:12px; align-items:flex-start; padding:12px 14px; background:#F8FAFC; border:2px solid #E2E8F0; border-radius:10px; cursor:pointer; transition:all 0.2s; }
          .step-row.done { border-color:#10B981; background:#F0FDF4; }
          .step-row input { margin-top:3px; width:18px; height:18px; accent-color:#10B981; }
          .step-row-info { flex:1; }
          .step-row-num { font-size:0.7rem; font-weight:700; color:#94A3B8; display:block; }
          .step-row-title { font-size:0.88rem; font-weight:700; color:#1E293B; display:block; }
          .step-row-date { font-size:0.75rem; color:#10B981; font-weight:600; display:block; margin-top:2px; }
          .steps-save-btn { width:100%; padding:12px; background:linear-gradient(135deg,#10B981,#059669); color:#fff; border:none; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer; transition:all 0.2s; }
          .steps-save-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 15px rgba(16,185,129,0.4); }
          .steps-save-btn:disabled { opacity:0.6; }
        `}</style>
      </div>,
      document.body
    )
  }

  const pending = students.filter(s => s.status === 'pending')
  const approved = students.filter(s => s.status === 'approved')

  // ── Helpers for tracking ──────────────────────────────────────────────
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  // "New" = created within the last 7 days.
  const isNew = (s) => {
    if (!s.createdAt) return false
    const t = new Date(s.createdAt).getTime()
    return !Number.isNaN(t) && (now - t) <= 7 * DAY
  }
  // "At risk" = approved student inactive for >3 days (or never active).
  const isAtRisk = (s) => {
    if (s.status !== 'approved') return false
    if (!s.lastActiveDate) return true
    const t = new Date(s.lastActiveDate).getTime()
    return Number.isNaN(t) || (now - t) > 3 * DAY
  }

  // ── Activity feed helpers (resolve ids to friendly text at render time) ──
  const studentName = (id) => students.find(s => String(s._id || s.id) === String(id))?.name || 'A student'
  const timeAgo = (ts) => {
    const sec = Math.floor((now - ts) / 1000)
    if (sec < 60) return 'just now'
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
    return `${Math.floor(sec / 86400)}d ago`
  }
  const feedLabel = (it) => {
    const p = it.payload || {}
    switch (it.type) {
      case 'story-pending': return `New success story submitted${p.title ? `: "${p.title}"` : ''}`
      case 'story-approved': return 'A success story was approved'
      case 'progress': return `${studentName(p.userId)} submitted a study update`
      case 'journey': return `${studentName(p.userId)}'s journey was updated`
      case 'feedback': return 'Feedback was sent to a student'
      default: return it.text || 'Activity'
    }
  }

  const filtered = students
    .filter(s => filter === 'all' || s.branch === filter)
    .filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))
    // status segment chip: All / Active (approved) / Pending / New (recent)
    .filter(s => {
      if (statusSegment === 'active') return s.status === 'approved'
      if (statusSegment === 'pending') return s.status === 'pending'
      if (statusSegment === 'new') return isNew(s)
      return true
    })

  // All Students = approved first, then pending (rejected moved to the Trash section).
  const statusOrder = { approved: 0, pending: 1 }
  const activeStudents = filtered
    .filter(s => s.status !== 'rejected')
    .slice()
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
  const rejectedStudents = filtered.filter(s => s.status === 'rejected')
  const atRiskCount = activeStudents.filter(isAtRisk).length

  // ── "Needs Attention" queue ──
  // Auto-prioritised from backend-computed riskReasons so the mentor doesn't have
  // to scan every student. High severity first, then by days inactive.
  const RISK_RANK = { high: 0, medium: 1, low: 2 }
  const needsAttention = students
    .filter(s => s.status === 'approved' && Array.isArray(s.riskReasons) && s.riskReasons.length > 0)
    .slice()
    .sort((a, b) =>
      (RISK_RANK[a.riskLevel] ?? 9) - (RISK_RANK[b.riskLevel] ?? 9) ||
      (b.daysSinceLastReport ?? 0) - (a.daysSinceLastReport ?? 0)
    )

  return (
    <div className="mentor-dash-page animate-fade-in">
      {renderStudentDetail()}
      
      <header className="mentor-header-premium">
        <div className="header-content">
          <div className="header-info">
            <h1 className="gradient-text">Mentor Dashboard</h1>
            <p className="welcome-msg">Welcome back, Bhima Sankar Sir</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              onClick={() => navigate('/mentor-settings')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontWeight: 700, cursor: 'pointer', marginRight: 8 }}
            >
              <SettingsIcon size={16} strokeWidth={2} /> Settings
            </button>
            <button className="logout-btn-premium" onClick={handleLogout}>Logout →</button>
          </div>
        </div>
      </header>

      <main className="mentor-main">
        {loading && <div className="loader">Loading student data...</div>}

        {!loading && (
          <>
            {/* Stats Row */}
            <div className="mentor-stats-row">
              <div className="mentor-stat-card">
                <span className="m-stat-num">{pending.length}</span>
                <span className="m-stat-label">Pending</span>
              </div>
              <div className="mentor-stat-card">
                <span className="m-stat-num">{approved.length}</span>
                <span className="m-stat-label">Total Guided</span>
              </div>
              <div className="mentor-stat-card">
                <span className="m-stat-num">{students.filter(s => s.branch === 'ECE').length}</span>
                <span className="m-stat-label">ECE</span>
              </div>
              <div className="mentor-stat-card">
                <span className="m-stat-num">{students.filter(s => s.branch === 'EE').length}</span>
                <span className="m-stat-label">EE</span>
              </div>
              <div className="mentor-stat-card">
                <span className="m-stat-num">{students.filter(s => s.branch === 'CSE').length}</span>
                <span className="m-stat-label">CSE</span>
              </div>
            </div>

            <MentorQueries />

            <MentorStories />

            <MentorWeeklyChallenge />

            {/* Recent Activity (live feed) */}
            <div className="card mentor-section">
              <h2 className="section-h2-icon"><Activity size={20} strokeWidth={2} /> Recent Activity</h2>
              {feed.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '.9rem' }}>No recent activity yet. Student updates, new stories and doubts will stream in here live.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
                  {feed.slice(0, 12).map((it, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '.88rem', color: '#1e293b' }}>{feedLabel(it)}</span>
                      <span style={{ fontSize: '.74rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{timeAgo(it.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Approvals */}
            {pending.length > 0 && (
              <div className="card mentor-section">
                <h2 className="section-h2-icon"><Clock size={20} strokeWidth={2} /> Pending Student Requests ({pending.length})</h2>
                <div className="students-list">
                  {pending.map(s => (
                    <div key={s._id || s.id} className="student-row pending-row">
                      <div className="student-info">
                        <strong>{s.name}</strong>
                        <span>{s.email}</span>
                        <span className="branch-tag">{s.branch}</span>
                        <span className="date">{new Date(s.createdAt || s.registeredAt).toLocaleDateString()}</span>
                      </div>
                      <div className="student-actions">
                        <button className="approve-btn" onClick={() => handleApprove(s._id || s.id)}><CheckCircle2 size={16} strokeWidth={2} /> Approve</button>
                        <button className="reject-btn" onClick={() => handleReject(s._id || s.id)}><X size={16} strokeWidth={2} /> Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* This Week at a Glance — per-student digest (no need to open each profile) */}
            {digest.length > 0 && (
              <div className="card mentor-section">
                <div className="section-header">
                  <h2 className="section-h2-icon"><BarChart3 size={20} strokeWidth={2} /> This Week at a Glance</h2>
                  <span className="na-hint">Live weekly summary — click a student to open them</span>
                </div>
                <div className="wd-scroll">
                  <div className="wd-table">
                    <div className="wd-row wd-head">
                      <span>Student</span><span>Hours</span><span>Consistency</span><span>PYQs</span><span>Accuracy</span><span>Status</span>
                    </div>
                    {digest.map(d => (
                      <div
                        key={d._id}
                        className="wd-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleStudentClick(students.find(s => (s._id || s.id) === d._id) || d)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStudentClick(students.find(s => (s._id || s.id) === d._id) || d) } }}
                      >
                        <span className="wd-name">{d.name}<em>{d.branch}</em></span>
                        <span>{d.studyHours}/{d.targetHours}h</span>
                        <span>{typeof d.consistencyScore === 'number' ? d.consistencyScore + '%' : '—'}</span>
                        <span>{d.pyqs}</span>
                        <span>{d.avgAcc != null ? d.avgAcc + '%' : '—'}</span>
                        <span className={`wd-badge ${d.onTrack ? 'ok' : 'off'}`}>{d.onTrack ? 'On track' : 'Behind'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Needs Attention — auto-prioritised queue (no manual scanning needed) */}
            {needsAttention.length > 0 && (
              <div className="card mentor-section na-card">
                <div className="section-header">
                  <h2 className="section-h2-icon">
                    <AlertTriangle size={20} strokeWidth={2} /> Needs Attention ({needsAttention.length})
                  </h2>
                  <span className="na-hint">Auto-flagged from activity — click any student to review</span>
                </div>
                <div className="na-list">
                  {needsAttention.map(s => (
                    <div
                      key={s._id || s.id}
                      className={`na-row na-${s.riskLevel}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Review ${s.name}`}
                      onClick={() => handleStudentClick(s)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStudentClick(s) } }}
                    >
                      <div className="na-main">
                        <div className="na-name">{s.name}<span className="na-branch">{s.branch}</span></div>
                        <div className="na-reasons">
                          {s.riskReasons.map((r, i) => (
                            <span key={i} className={`na-chip lvl-${r.level}`}>{r.label}</span>
                          ))}
                        </div>
                      </div>
                      <span className="na-review">Review →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Students */}
            <div className="card mentor-section">
              <div className="section-header">
                <h2 className="section-h2-icon">
                  <Users size={20} strokeWidth={2} /> All Students ({activeStudents.length})
                  {atRiskCount > 0 && (
                    <span className="at-risk-count-chip" title="Approved students inactive for more than 3 days">
                      <AlertTriangle size={13} strokeWidth={2} /> {atRiskCount} at risk
                    </span>
                  )}
                </h2>
                <div className="filter-row">
                  <span className="search-input search-input-wrap">
                    <Search size={15} strokeWidth={2} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search name..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </span>
                  {['all', 'ECE', 'EE', 'CSE'].map(f => (
                    <button
                      key={f}
                      className={`filter-btn ${filter === f ? 'active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status segment chips — combine with branch filter + search */}
              <div className="status-segment">
                {[
                  ['all', 'All'],
                  ['active', 'Active'],
                  ['pending', 'Pending'],
                  ['new', 'New'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`segment-chip ${statusSegment === id ? 'active' : ''}`}
                    onClick={() => setStatusSegment(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="click-hint">Click student to update Timetable &amp; Journey</p>
              <div className="students-list">
                {activeStudents.length === 0 && <p className="empty-text">No students found.</p>}
                {activeStudents.map(s => (
                  <div key={s._id || s.id} className="student-row clickable" role="button" tabIndex={0} aria-label={`View ${s.name}`} onClick={() => handleStudentClick(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStudentClick(s) } }}>
                    <div className="student-info">
                      <strong>{s.name}</strong>
                      <span>{s.email}</span>
                      <span className="branch-tag">{s.branch}</span>
                      <span className={`status-tag ${s.status}`}>{s.status}</span>
                      {isAtRisk(s) && (
                        <span className="at-risk-badge" title="Approved student inactive for more than 3 days — may need a nudge">
                          <AlertTriangle size={12} strokeWidth={2} /> At risk
                        </span>
                      )}
                    </div>
                    {s.status === 'pending' ? (
                      <div className="student-actions" onClick={e => e.stopPropagation()}>
                        <button className="approve-btn" type="button" title="Approve this student" onClick={() => handleApprove(s._id || s.id)}>
                          <CheckCircle2 size={15} strokeWidth={2} /> Approve
                        </button>
                        <button className="reject-btn" type="button" title="Reject this student" onClick={() => handleReject(s._id || s.id)}>
                          <X size={15} strokeWidth={2} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="row-chevron" aria-hidden="true">›</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Trash — rejected students, collapsed by default */}
            {rejectedStudents.length > 0 && (
              <div className="card mentor-section trash-section">
                <div className="section-header trash-header" onClick={() => setShowTrash(v => !v)}>
                  <h2 className="section-h2-icon"><Trash2 size={20} strokeWidth={2} /> Rejected ({rejectedStudents.length})</h2>
                  <button className="filter-btn" type="button">{showTrash ? 'Hide' : 'Show'}</button>
                </div>
                {showTrash && (
                  <div className="students-list">
                    {rejectedStudents.map(s => (
                      <div key={s._id || s.id} className="student-row clickable trash-row" role="button" tabIndex={0} aria-label={`View ${s.name}`} onClick={() => handleStudentClick(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStudentClick(s) } }}>
                        <div className="student-info">
                          <strong>{s.name}</strong>
                          <span>{s.email}</span>
                          <span className="branch-tag">{s.branch}</span>
                          <span className="status-tag rejected">{s.status}</span>
                        </div>
                        <button
                          className="approve-btn"
                          type="button"
                          title="Restore (approve) this student"
                          onClick={e => { e.stopPropagation(); handleApprove(s._id || s.id) }}
                        >↩ Restore</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      
      {confirmBox && (
        <div className="confirm-overlay" onClick={() => { confirmBox.resolve(false); setConfirmBox(null) }}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={confirmBox.title}>
            <h3>{confirmBox.title}</h3>
            <p>{confirmBox.message}</p>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => { confirmBox.resolve(false); setConfirmBox(null) }}>Cancel</button>
              <button type="button" className={`confirm-go ${confirmBox.tone}`} onClick={() => { confirmBox.resolve(true); setConfirmBox(null) }} autoFocus>{confirmBox.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mentor-main { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .confirm-overlay { position: fixed; inset: 0; z-index: 4000; background: rgba(15,23,42,.55); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: cfFade .14s ease; }
        @keyframes cfFade { from { opacity: 0 } to { opacity: 1 } }
        .confirm-box { width: 100%; max-width: 420px; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 24px 60px rgba(2,6,23,.4); animation: cfPop .16s cubic-bezier(.2,.8,.2,1); }
        @keyframes cfPop { from { opacity:0; transform: translateY(8px) scale(.97) } to { opacity:1; transform:none } }
        .confirm-box h3 { margin: 0 0 8px; font-size: 1.15rem; font-weight: 900; color: #1e293b; }
        .confirm-box p { margin: 0 0 20px; color: #64748b; font-size: .92rem; line-height: 1.55; }
        .confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .confirm-cancel, .confirm-go { padding: 9px 18px; border-radius: 10px; font-family: inherit; font-weight: 800; font-size: .9rem; cursor: pointer; border: none; }
        .confirm-cancel { background: #f1f5f9; color: #475569; }
        .confirm-cancel:hover { background: #e2e8f0; }
        .confirm-go { color: #fff; }
        .confirm-go.approve { background: #16a34a; }
        .confirm-go.approve:hover { background: #15803d; }
        .confirm-go.reject { background: #ef4444; }
        .confirm-go.reject:hover { background: #dc2626; }
        .click-hint { font-size: 0.85rem; color: #64748B; margin-bottom: 12px; font-weight: 600; }
        .na-hint { font-size: .8rem; color: #94a3b8; font-weight: 600; }
        .na-list { display: flex; flex-direction: column; gap: 10px; }
        .na-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; cursor: pointer; transition: background .15s, transform .15s; }
        .na-row:hover { background: #F1F5F9; transform: translateY(-1px); }
        .na-name { font-weight: 800; color: #1e293b; font-size: .95rem; display: flex; align-items: center; }
        .na-branch { font-size: .72rem; font-weight: 700; color: #6C63FF; background: rgba(108,99,255,.1); padding: 2px 8px; border-radius: 6px; margin-left: 8px; }
        .na-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .na-chip { font-size: .74rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
        .na-chip.lvl-high { background: #FEE2E2; color: #dc2626; }
        .na-chip.lvl-medium { background: #FEF3C7; color: #d97706; }
        .na-chip.lvl-low { background: #F1F5F9; color: #64748b; }
        .na-review { flex-shrink: 0; color: #6C63FF; font-weight: 800; font-size: .85rem; white-space: nowrap; }
        .fb-suggest { margin-top: 14px; padding: 12px 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; }
        .fb-suggest-label { font-size: .78rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .fb-suggest-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .fb-suggest-chip { padding: 7px 14px; border-radius: 999px; border: 1px solid #C7D2FE; background: #EEF2FF; color: #4338ca; font-family: inherit; font-weight: 700; font-size: .82rem; cursor: pointer; transition: all .15s; }
        .fb-suggest-chip:hover { background: #6C63FF; color: #fff; border-color: #6C63FF; }
        .wd-scroll { overflow-x: auto; scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        .wd-scroll::-webkit-scrollbar { height: 8px; }
        .wd-scroll::-webkit-scrollbar-track { background: transparent; }
        .wd-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        .wd-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .wd-table { display: flex; flex-direction: column; gap: 6px; min-width: 560px; }
        .wd-row { display: grid; grid-template-columns: 2fr 1fr 1.2fr 0.8fr 1fr 1.1fr; gap: 10px; align-items: center; padding: 11px 12px; border-radius: 10px; font-size: .88rem; color: #1e293b; }
        .wd-row.wd-head { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; padding: 2px 12px; }
        .wd-row:not(.wd-head) { background: #F8FAFC; border: 1px solid #E2E8F0; cursor: pointer; transition: background .15s; }
        .wd-row:not(.wd-head):hover { background: #F1F5F9; }
        .wd-name { font-weight: 800; }
        .wd-name em { font-style: normal; font-size: .7rem; font-weight: 700; color: #6C63FF; background: rgba(108,99,255,.1); padding: 1px 7px; border-radius: 6px; margin-left: 7px; }
        .wd-badge { font-size: .72rem; font-weight: 800; padding: 4px 9px; border-radius: 999px; text-align: center; }
        .wd-badge.ok { background: #DCFCE7; color: #16a34a; }
        .wd-badge.off { background: #FEF3C7; color: #d97706; }
        .loader { text-align: center; padding: 40px; color: #64748B; font-weight: 700; }
        .student-row.clickable { cursor: pointer; transition: background 0.2s; }
        .student-row.clickable:hover { background: #F1F5F9; }
        .trash-header { cursor: pointer; user-select: none; }
        .trash-section h2 { color: #94a3b8; font-size: 1.1rem; }
        .trash-row { opacity: 0.85; }
        .trash-row:hover { opacity: 1; }
      `}</style>
    </div>
  )
}

export default MentorDashboard
