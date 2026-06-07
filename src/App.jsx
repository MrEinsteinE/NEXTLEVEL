import { Suspense } from 'react'
import lazyWithRetry from './utils/lazyWithRetry.js'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ThemeToggle from './components/common/ThemeToggle.jsx'
import CommandPalette from './components/common/CommandPalette.jsx'
import './index.css'

// Route-level code splitting: each page is loaded on demand so the
// initial bundle stays small. (Previously every page shipped up-front.)
const Login = lazyWithRetry(() => import('./pages/Login.jsx'))
const Signup = lazyWithRetry(() => import('./pages/Signup.jsx'))
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword.jsx'))
const MentorLogin = lazyWithRetry(() => import('./pages/MentorLogin.jsx'))
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail.jsx'))
const PendingApproval = lazyWithRetry(() => import('./pages/PendingApproval.jsx'))
const StudentDashboard = lazyWithRetry(() => import('./pages/StudentDashboard.jsx'))
const MentorDashboard = lazyWithRetry(() => import('./pages/MentorDashboard.jsx'))
const MentorProfilePage = lazyWithRetry(() => import('./pages/MentorProfilePage.jsx'))
const Flashcards = lazyWithRetry(() => import('./pages/Flashcards.jsx'))
const Notes = lazyWithRetry(() => import('./pages/Notes.jsx'))
const PYQTracker = lazyWithRetry(() => import('./pages/PYQTracker.jsx'))
const MockTest = lazyWithRetry(() => import('./pages/MockTest.jsx'))
const MockTestFull = lazyWithRetry(() => import('./pages/MockTestFull.jsx'))
const Focus = lazyWithRetry(() => import('./pages/Focus.jsx'))
const Planner = lazyWithRetry(() => import('./pages/Planner.jsx'))
const Report = lazyWithRetry(() => import('./pages/Report.jsx'))
const ReportCard = lazyWithRetry(() => import('./pages/ReportCard.jsx'))
const Tasks = lazyWithRetry(() => import('./pages/Tasks.jsx'))
const Leaderboard = lazyWithRetry(() => import('./pages/Leaderboard.jsx'))
const StoriesPage = lazyWithRetry(() => import('./pages/StoriesPage.jsx'))
const MyJourney = lazyWithRetry(() => import('./pages/MyJourney.jsx'))
const Feedback = lazyWithRetry(() => import('./pages/Feedback.jsx'))
const ProgressTrackerPage = lazyWithRetry(() => import('./pages/ProgressTrackerPage.jsx'))
const Settings = lazyWithRetry(() => import('./pages/Settings.jsx'))

const PageLoader = () => (
  <div style={{
    minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <div className="route-spinner" aria-label="Loading" role="status" />
  </div>
)

const RootRedirect = () => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'mentor'
    ? <Navigate to="/mentor-dashboard" replace />
    : <Navigate to="/dashboard" replace />
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'pending') return <Navigate to="/pending-approval" replace />
  if (user.role === 'mentor') return <Navigate to="/mentor-dashboard" replace />
  return children
}

const PendingApprovalRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.status !== 'pending') return <Navigate to="/dashboard" replace />
  return children
}

const MentorRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'mentor') return <Navigate to="/dashboard" replace />
  return children
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return user.role === 'mentor'
    ? <Navigate to="/mentor-dashboard" replace />
    : <Navigate to="/dashboard" replace />
  return children
}

function App() {
  return (
    <>
      {/* Global theme toggle — present on every page (bottom-left, clear of headers & chat) */}
      <div className="app-theme-toggle"><ThemeToggle /></div>
      {/* Global command palette (Ctrl/Cmd+K) */}
      <CommandPalette />
    <Suspense fallback={<PageLoader />}>
      <div className="route-view">
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Public — redirect away if already logged in */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/mentor-login" element={<PublicRoute><MentorLogin /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/pending-approval" element={<PendingApprovalRoute><PendingApproval /></PendingApprovalRoute>} />

        {/* Mentor profile is public so students can view it */}
        <Route path="/mentor-profile" element={<MentorProfilePage />} />

        {/* Authenticated student routes */}
        <Route path="/dashboard" element={<PrivateRoute><StudentDashboard /></PrivateRoute>} />
        <Route path="/flashcards" element={<PrivateRoute><Flashcards /></PrivateRoute>} />
        <Route path="/notes" element={<PrivateRoute><Notes /></PrivateRoute>} />
        <Route path="/pyq" element={<PrivateRoute><PYQTracker /></PrivateRoute>} />
        <Route path="/mock-test" element={<PrivateRoute><MockTest /></PrivateRoute>} />
        <Route path="/mock-test/full" element={<PrivateRoute><MockTestFull /></PrivateRoute>} />
        <Route path="/focus" element={<PrivateRoute><Focus /></PrivateRoute>} />
        <Route path="/planner" element={<PrivateRoute><Planner /></PrivateRoute>} />
        <Route path="/report" element={<PrivateRoute><Report /></PrivateRoute>} />
        <Route path="/report-card" element={<PrivateRoute><ReportCard /></PrivateRoute>} />
        <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
        <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
        <Route path="/stories" element={<PrivateRoute><StoriesPage /></PrivateRoute>} />
        <Route path="/journey" element={<PrivateRoute><MyJourney /></PrivateRoute>} />
        <Route path="/feedback" element={<PrivateRoute><Feedback /></PrivateRoute>} />
        <Route path="/progress" element={<PrivateRoute><ProgressTrackerPage /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />

        {/* Mentor-only routes */}
        <Route path="/mentor-dashboard" element={<MentorRoute><MentorDashboard /></MentorRoute>} />
        <Route path="/mentor-settings" element={<MentorRoute><Settings /></MentorRoute>} />
      </Routes>
      </div>
    </Suspense>
    </>
  )
}

export default App
