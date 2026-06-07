import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket.js'
import axios from 'axios'
import { motivationQuotes } from '../data/platformData.js'
import { getSyllabus, countAllTopics } from '../data/syllabus.js'
import GATECountdown from '../components/dashboard/GATECountdown.jsx'
import DailyTaskChecklist from '../components/dashboard/DailyTaskChecklist.jsx'
import MotivationQuotes from '../components/dashboard/MotivationQuotes.jsx'
import SyllabusChecklist from '../components/dashboard/SyllabusChecklist.jsx'
import ProgressVisualization from '../components/dashboard/ProgressVisualization.jsx'
import ProgressTrends from '../components/dashboard/ProgressTrends.jsx'
import WorkingHoursTracker from '../components/dashboard/WorkingHoursTracker.jsx'
import RewardSystem from '../components/dashboard/RewardSystem.jsx'
import Leaderboard from '../components/dashboard/Leaderboard.jsx'
import PreparationTracker from '../components/dashboard/PreparationTracker.jsx'
import DailyStudyReport from '../components/dashboard/DailyStudyReport.jsx'
import PersonalTimetable from '../components/dashboard/PersonalTimetable.jsx'
import MentorshipFlow from '../components/dashboard/MentorshipFlow.jsx'
import WeeklyStudyChart from '../components/dashboard/WeeklyStudyChart.jsx'
import StreakPopup from '../components/dashboard/StreakPopup.jsx'
import MentorMessages from '../components/dashboard/MentorMessages.jsx'
import ChatWidget from '../components/chat/ChatWidget.jsx'
import NotificationBell from '../components/dashboard/NotificationBell.jsx'
import DoubtsBoard from '../components/dashboard/DoubtsBoard.jsx'
import DailyReflection from '../components/dashboard/DailyReflection.jsx'
import WeeklyChallengeCard from '../components/dashboard/WeeklyChallengeCard.jsx'
import AccountabilityPartners from '../components/dashboard/AccountabilityPartners.jsx'
import Flashcards from './Flashcards.jsx'
import Notes from './Notes.jsx'
import PYQTracker from './PYQTracker.jsx'
import Focus from './Focus.jsx'
import Planner from './Planner.jsx'
import ReportCard from './ReportCard.jsx'
import {
  LayoutDashboard, BookOpen, ListChecks, FileText, Target,
  TrendingUp, Trophy, CalendarDays, Map as MapIcon, GraduationCap, Search, Menu, Flame, X, Settings as SettingsIcon, HelpCircle,
  BookMarked, PenLine, ClipboardList, Clock, CalendarRange, BarChart3, Sparkles, Users
} from 'lucide-react'
import './StudentDashboard.css'

function StudentDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [notifications, setNotifications] = useState([])
  const [liveStats, setLiveStats] = useState({ studyHours: 0, tasksDone: 0, tasksTotal: 0, syllabusPercent: 0, streak: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()

  const { user, logout } = useAuth()
  const userId = user?._id
  const firstName = user?.name ? user.name.split(' ')[0] : 'Student'
  const userKey = user?.email ? user.email.replace(/[.@]/g, '_') : 'guest'

  useEffect(() => {
    if (userId) fetchLiveStats()
  }, [userId])

  // Deep-link to a dashboard section via ?tab= (used by the command palette).
  const location = useLocation()
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab')
    const valid = ['overview', 'syllabus', 'tasks', 'report', 'reflect', 'tracker', 'progress', 'rewards', 'timetable', 'journey', 'doubts', 'partners', 'flashcards', 'notes', 'pyq', 'focus', 'planner', 'reportcard']
    if (tab && valid.includes(tab)) setActiveTab(tab)
  }, [location.search])

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
    { id: 'overview', Icon: LayoutDashboard, label: 'Overview' },
    { id: 'syllabus', Icon: BookOpen, label: 'Syllabus Tracker' },
    { id: 'tasks', Icon: ListChecks, label: 'Daily Tasks' },
    { id: 'report', Icon: FileText, label: 'Daily Report' },
    { id: 'reflect', Icon: Sparkles, label: 'Reflections' },
    { id: 'tracker', Icon: Target, label: 'Study Tracker' },
    { id: 'progress', Icon: TrendingUp, label: 'Progress' },
    { id: 'rewards', Icon: Trophy, label: 'Rewards & Leaderboard' },
    { id: 'timetable', Icon: CalendarDays, label: 'My Timetable' },
    { id: 'journey', Icon: MapIcon, label: 'My Journey' },
    { id: 'doubts', Icon: HelpCircle, label: 'Ask Mentor' },
    { id: 'partners', Icon: Users, label: 'Partners' },
  ]

  const quickLinks = [
    { id: 'mentor', Icon: GraduationCap, label: 'Mentor Profile', to: '/mentor-profile' },
    { id: 'settings', Icon: SettingsIcon, label: 'Settings', to: '/settings' },
  ]

  // Study tools render inside the dashboard (sidebar stays visible), as tabs — not separate pages.
  // Leaderboard is intentionally omitted: it already lives in the "Rewards & Leaderboard" tab.
  const toolTabs = [
    { id: 'flashcards', Icon: BookMarked, label: 'Flashcards' },
    { id: 'notes', Icon: PenLine, label: 'Notes' },
    { id: 'pyq', Icon: ClipboardList, label: 'PYQ Tracker' },
    { id: 'focus', Icon: Clock, label: 'Focus Mode' },
    { id: 'planner', Icon: CalendarRange, label: 'Study Planner' },
    { id: 'reportcard', Icon: BarChart3, label: 'Report Card' },
  ]

  // ── Search across dashboard sections + syllabus subjects ──
  const searchIndex = useMemo(() => {
    const items = navItems.map(n => ({ type: 'tab', id: n.id, label: n.label, hint: 'Section', Icon: n.Icon }))
    items.push({ type: 'link', to: '/mentor-profile', label: 'Mentor Profile', hint: 'Quick Link', Icon: GraduationCap })
    try {
      const syl = getSyllabus(user?.branch)
      syl.forEach(section => (section.subjects || []).forEach(sub => {
        items.push({ type: 'subject', id: 'syllabus', label: sub.name, hint: 'Syllabus', Icon: BookOpen })
      }))
    } catch (e) { /* ignore — no syllabus for unknown branch */ }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branch])

  const sq = searchQuery.trim().toLowerCase()
  const searchResults = sq ? searchIndex.filter(it => it.label.toLowerCase().includes(sq)).slice(0, 8) : []

  const handleSearchSelect = (r) => {
    if (r.type === 'link' && r.to) navigate(r.to)
    else if (r.id) setActiveTab(r.id)
    setSearchQuery('')
    setSearchOpen(false)
    setSidebarOpen(false)
  }
  const handleSearchKey = (e) => {
    if (e.key === 'Escape') setSearchOpen(false)
    else if (e.key === 'Enter' && searchResults.length) handleSearchSelect(searchResults[0])
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-layout">
      <StreakPopup />
      <ChatWidget />
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open menu"><Menu size={20} /></button>

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
              role="button"
              tabIndex={0}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); setSidebarOpen(false) } }}
            >
              <span className="icon"><item.Icon size={19} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </div>
          ))}

          <div className="sidebar-section-title">Study Tools</div>
          {toolTabs.map(item => (
            <div
              key={item.id}
              className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); setSidebarOpen(false) } }}
            >
              <span className="icon"><item.Icon size={19} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </div>
          ))}

          <div className="sidebar-section-title">Quick Links</div>
          {quickLinks.map(item => (
            <Link key={item.id} to={item.to} className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <span className="icon"><item.Icon size={19} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" role="button" tabIndex={0} onClick={handleLogout} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogout() } }} title="Click to Logout" aria-label="Sign out">
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
            <h1>{getGreeting()}, <span className="gradient-text">{firstName}</span></h1>
            <p>Welcome back to your premium mentorship portal</p>
          </div>
          <div className="header-right">
            <NotificationBell />
            <div className={`header-streak ${liveStats.streak > 0 ? 'active' : ''}`} title="Your current daily streak — submit today's report to keep it alive">
              <Flame size={16} strokeWidth={2} />
              <span className="header-streak-num">{liveStats.streak}</span>
              <span className="header-streak-label">day{liveStats.streak === 1 ? '' : 's'} streak</span>
            </div>
            <div className="header-search-wrap">
              <div className="header-search glass">
                <Search size={16} className="search-ic" />
                <input
                  type="text"
                  placeholder="Search sections & subjects..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                  onKeyDown={handleSearchKey}
                />
                {searchQuery && (
                  <button className="search-clear" onMouseDown={(e) => { e.preventDefault(); setSearchQuery('') }} aria-label="Clear search">
                    <X size={14} strokeWidth={2.4} />
                  </button>
                )}
              </div>
              {searchOpen && sq && (
                <div className="header-search-results">
                  {searchResults.length === 0 ? (
                    <div className="search-empty">No matches for “{searchQuery}”</div>
                  ) : searchResults.map((r, i) => (
                    <button
                      key={`${r.type}-${r.label}-${i}`}
                      className="search-result"
                      onMouseDown={(e) => { e.preventDefault(); handleSearchSelect(r) }}
                    >
                      <span className="sr-icon"><r.Icon size={16} strokeWidth={2} /></span>
                      <span className="sr-label">{r.label}</span>
                      <span className="sr-hint">{r.hint}</span>
                    </button>
                  ))}
                </div>
              )}
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
                    {liveStats.studyHours > 0 ? 'Keep it up' : 'Start today'}
                  </p>
                </div>
                <div className="stat-card purple">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Tasks Done</span>
                  <span className="stat-value" style={{ color: 'var(--color-secondary)' }}>{liveStats.tasksDone}/{liveStats.tasksTotal || 0}</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.tasksDone > 0 ? 'Moving fast' : 'Plan your day'}
                  </p>
                </div>
                <div className="stat-card green">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Syllabus</span>
                  <span className="stat-value" style={{ color: 'var(--color-success)' }}>{liveStats.syllabusPercent}%</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.syllabusPercent >= 50 ? 'Great progress' : 'Keep going'}
                  </p>
                </div>
                <div className="stat-card warm">
                  <span className="stat-label" style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-light)' }}>Streak</span>
                  <span className="stat-value" style={{ color: 'var(--color-warning)' }}>{liveStats.streak}</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: '700', marginTop: '4px' }}>
                    {liveStats.streak >= 7 ? 'On fire!' : liveStats.streak > 0 ? 'Building up' : 'Start today'}
                  </p>
                </div>
              </div>

              {/* Messages from your Mentor */}
              <div className="widgets-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="widget glass"><MentorMessages /></div>
              </div>

              {/* Weekly Challenge (only renders when one is active) */}
              <WeeklyChallengeCard />

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
            <>
              <div className="widget glass" style={{ marginBottom: 'var(--sp-6)' }}>
                <ProgressVisualization branch={user?.branch} userKey={userKey} fullView />
              </div>
              <ProgressTrends userId={userId} />
            </>
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

          {/* Ask Mentor (Q&A doubts) Tab */}
          {activeTab === 'doubts' && (
            <div style={{ margin: '0 auto' }}>
              <DoubtsBoard />
            </div>
          )}

          {/* Daily Reflections Tab */}
          {activeTab === 'reflect' && (
            <div style={{ margin: '0 auto' }}>
              <DailyReflection />
            </div>
          )}

          {/* Accountability Partners Tab */}
          {activeTab === 'partners' && (
            <div style={{ margin: '0 auto' }}>
              <AccountabilityPartners />
            </div>
          )}

          {/* Study Tools — rendered in-dashboard so the sidebar stays visible */}
          {activeTab === 'flashcards' && <div style={{ margin: '0 auto' }}><Flashcards /></div>}
          {activeTab === 'notes' && <div style={{ margin: '0 auto' }}><Notes /></div>}
          {activeTab === 'pyq' && <div style={{ margin: '0 auto' }}><PYQTracker /></div>}
          {activeTab === 'focus' && <div style={{ margin: '0 auto' }}><Focus /></div>}
          {activeTab === 'planner' && <div style={{ margin: '0 auto' }}><Planner /></div>}
          {activeTab === 'reportcard' && <div style={{ margin: '0 auto' }}><ReportCard /></div>}
        </div>
      </main>
    </div>
  )
}

export default StudentDashboard
