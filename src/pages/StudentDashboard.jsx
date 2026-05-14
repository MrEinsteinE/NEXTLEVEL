import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import axios from 'axios'
import { motivationQuotes } from '../data/platformData.js'
import { getSyllabus, countAllTopics } from '../data/syllabus.js'
import GATECountdown from '../components/dashboard/GATECountdown.jsx'
import DailyTaskChecklist from '../components/dashboard/DailyTaskChecklist.jsx'
import MotivationQuotes from '../components/dashboard/MotivationQuotes.jsx'
import SyllabusChecklist from '../components/dashboard/SyllabusChecklist.jsx'
import ProgressVisualization from '../components/dashboard/ProgressVisualization.jsx'
import WorkingHoursTracker from '../components/dashboard/WorkingHoursTracker.jsx'
import RewardSystem from '../components/dashboard/RewardSystem.jsx'
import Leaderboard from '../components/dashboard/Leaderboard.jsx'
import PreparationTracker from '../components/dashboard/PreparationTracker.jsx'
import DailyStudyReport from '../components/dashboard/DailyStudyReport.jsx'
import PersonalTimetable from '../components/dashboard/PersonalTimetable.jsx'
import MentorshipFlow from '../components/dashboard/MentorshipFlow.jsx'
import WeeklyStudyChart from '../components/dashboard/WeeklyStudyChart.jsx'
import './StudentDashboard.css'

function StudentDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [notifications, setNotifications] = useState([])
  const [liveStats, setLiveStats] = useState({ studyHours: 0, tasksDone: 0, tasksTotal: 0, syllabusPercent: 0, streak: 0 })
  const navigate = useNavigate()

  const { user, logout } = useAuth()
  const userId = user?._id
  const firstName = user?.name ? user.name.split(' ')[0] : 'Student'
  const userKey = user?.email ? user.email.replace(/[.@]/g, '_') : 'guest'

  useEffect(() => {
    if (userId) fetchLiveStats()
  }, [userId])

  const socket = useSocket()
  useEffect(() => {
    if (!socket) return
    socket.on('progress-updated', () => fetchLiveStats())
    socket.on('syllabus-updated', () => fetchLiveStats())
    return () => {
      socket.off('progress-updated')
      socket.off('syllabus-updated')
    }
  }, [socket])

  const fetchLiveStats = async () => {
    try {
      const [progressRes, tasksRes, streakRes, syllabusRes] = await Promise.all([
        axios.get(`/api/student/progress/${user._id}`).catch(() => ({ data: {} })),
        axios.get(`/api/student/daily-tasks/${user._id}`).catch(() => ({ data: {} })),
        axios.get(`/api/student/streak/${user._id}`).catch(() => ({ data: {} })),
        axios.get(`/api/student/syllabus-progress/${user._id}`).catch(() => ({ data: {} }))
      ])
      setLiveStats({
        studyHours: progressRes.data?.progress?.today?.studyHours || 0,
        tasksDone: tasksRes.data?.completedCount || 0,
        tasksTotal: tasksRes.data?.totalCount || 0,
        syllabusPercent: syllabusRes.data?.percentage || 0,
        streak: streakRes.data?.streak || 0
      })
    } catch (err) {
      console.error('Failed to fetch live stats:', err)
    }
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'syllabus', icon: '📚', label: 'Syllabus Tracker' },
    { id: 'tasks', icon: '✅', label: 'Daily Tasks' },
    { id: 'report', icon: '📋', label: 'Daily Report' },
    { id: 'tracker', icon: '🎯', label: 'Study Tracker' },
    { id: 'progress', icon: '📈', label: 'Progress' },
    { id: 'rewards', icon: '🏆', label: 'Rewards & Leaderboard' },
    { id: 'timetable', icon: '📅', label: 'My Timetable' },
    { id: 'journey', icon: '🗺️', label: 'My Journey' },
  ]

  const quickLinks = [
    { id: 'mentor', icon: '👨‍🏫', label: 'Mentor Profile' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-layout animate-fade-in">
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/images/nextlevel-logo.jpg" alt="NEXT_LEVEL" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <h2 className="gradient-text">NextLevel</h2>
            <span>by Bhima Sankar Sir</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Main Menu</div>
          {navItems.map(item => (
            <div
              key={item.id}
              className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          <div className="sidebar-section-title">Quick Links</div>
          {quickLinks.map(item => (
            <Link key={item.id} to="/mentor-profile" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Click to Logout">
            <div className="sidebar-avatar">{firstName[0]}</div>
            <div className="sidebar-user-info">
              <div className="name" style={{ fontWeight: '700' }}>{user?.name || 'Student'}</div>
              <div className="role" style={{ color: 'var(--color-primary)', fontWeight: '700' }}>Sign Out →</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        <header className="dashboard-header animate-fade-in">
          <div className="header-left">
            <h1>{getGreeting()}, <span className="gradient-text">{firstName}</span> 👋</h1>
            <p>Welcome back to your premium mentorship portal</p>
          </div>
          <div className="header-right">
            <div className="header-search glass">
              <span>🔍</span>
              <input type="text" placeholder="Search topics..." />
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Stats */}
              <div className="stats-grid animate-fade-in">
                <div className="stat-card blue">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Study Hours</span>
                  <span className="stat-value gradient-text">{liveStats.studyHours}h</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.studyHours > 0 ? '↑ Keep it up' : '🚀 Start today'}
                  </p>
                </div>
                <div className="stat-card purple">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Tasks Done</span>
                  <span className="stat-value" style={{ color: 'var(--color-secondary)' }}>{liveStats.tasksDone}/{liveStats.tasksTotal || 0}</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.tasksDone > 0 ? '↑ Moving fast' : '📝 Plan your day'}
                  </p>
                </div>
                <div className="stat-card green">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Syllabus</span>
                  <span className="stat-value" style={{ color: 'var(--color-success)' }}>{liveStats.syllabusPercent}%</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.syllabusPercent >= 50 ? '🚀 Great progress' : '📚 Keep going'}
                  </p>
                </div>
                <div className="stat-card warm">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Streak</span>
                  <span className="stat-value" style={{ color: 'var(--color-warning)' }}>{liveStats.streak}</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.streak >= 7 ? '🔥 On fire!' : liveStats.streak > 0 ? '💪 Building up' : '🚀 Start today'}
                  </p>
                </div>
              </div>

              {/* Weekly Study Chart */}
              <div className="widgets-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="widget glass"><WeeklyStudyChart /></div>
              </div>

              {/* GATE Countdown */}
              <div className="widgets-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="widget glass"><GATECountdown /></div>
              </div>

              {/* Preparation Tracker */}
              <div className="widgets-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="widget glass"><PreparationTracker /></div>
              </div>

              {/* Motivation + Tasks + Hours */}
              <div className="widgets-grid">
                <div className="widget glass"><MotivationQuotes /></div>
                <div className="widget glass"><DailyTaskChecklist /></div>
                <div className="widget glass"><WorkingHoursTracker /></div>
              </div>

              {/* Progress + Rewards */}
              <div className="widgets-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div className="widget glass"><ProgressVisualization branch={user?.branch} userKey={userKey} /></div>
                <div className="widget glass"><RewardSystem userKey={userKey} /></div>
              </div>
            </>
          )}

          {/* Syllabus Tab */}
          {activeTab === 'syllabus' && (
            <div className="widget glass" style={{ maxWidth: '100%' }}>
              <SyllabusChecklist branch={user?.branch || 'ECE'} userKey={userKey} />
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="widgets-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="widget glass"><DailyTaskChecklist fullView /></div>
              <div className="widget glass"><WorkingHoursTracker /></div>
            </div>
          )}

          {/* Daily Report Tab */}
          {activeTab === 'report' && (
            <div className="widget glass" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <DailyStudyReport userKey={userKey} />
            </div>
          )}

          {/* Study Tracker Tab */}
          {activeTab === 'tracker' && (
            <div className="widgets-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="widget glass"><PreparationTracker userKey={userKey} /></div>
              <div className="widget glass"><WorkingHoursTracker userKey={userKey} /></div>
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <div className="widget glass">
              <ProgressVisualization branch={user?.branch} userKey={userKey} fullView />
            </div>
          )}

          {/* Rewards & Leaderboard Tab */}
          {activeTab === 'rewards' && (
            <div className="widgets-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="widget glass"><RewardSystem /></div>
              <div className="widget glass"><Leaderboard /></div>
            </div>
          )}

          {/* My Timetable Tab */}
          {activeTab === 'timetable' && (
            <div className="widget glass" style={{ maxWidth: '100%' }}>
              <PersonalTimetable />
            </div>
          )}

          {/* My Journey Tab */}
          {activeTab === 'journey' && (
            <div className="widget glass" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <MentorshipFlow />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default StudentDashboard
