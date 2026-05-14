import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import './index.css'

import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import MentorLogin from './pages/MentorLogin.jsx'
import PendingApproval from './pages/PendingApproval.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import MentorDashboard from './pages/MentorDashboard.jsx'
import MentorProfilePage from './pages/MentorProfilePage.jsx'
import Flashcards from './pages/Flashcards.jsx'
import Notes from './pages/Notes.jsx'
import PYQTracker from './pages/PYQTracker.jsx'
import MockTest from './pages/MockTest.jsx'
import MockTestFull from './pages/MockTestFull.jsx'
import Focus from './pages/Focus.jsx'
import Planner from './pages/Planner.jsx'
import Report from './pages/Report.jsx'
import ReportCard from './pages/ReportCard.jsx'
import Syllabus from './pages/Syllabus.jsx'
import Tasks from './pages/Tasks.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Partnership from './pages/Partnership.jsx'
import StoriesPage from './pages/StoriesPage.jsx'
import MyJourney from './pages/MyJourney.jsx'
import Feedback from './pages/Feedback.jsx'
import ProgressTrackerPage from './pages/ProgressTrackerPage.jsx'

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'pending') return <Navigate to="/pending-approval" replace />
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
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public — redirect away if already logged in */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/mentor-login" element={<PublicRoute><MentorLogin /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/pending-approval" element={<PendingApproval />} />

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
      <Route path="/syllabus" element={<PrivateRoute><Syllabus /></PrivateRoute>} />
      <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
      <Route path="/partnership" element={<PrivateRoute><Partnership /></PrivateRoute>} />
      <Route path="/stories" element={<PrivateRoute><StoriesPage /></PrivateRoute>} />
      <Route path="/journey" element={<PrivateRoute><MyJourney /></PrivateRoute>} />
      <Route path="/feedback" element={<PrivateRoute><Feedback /></PrivateRoute>} />
      <Route path="/progress" element={<PrivateRoute><ProgressTrackerPage /></PrivateRoute>} />

      {/* Mentor-only routes */}
      <Route path="/mentor-dashboard" element={<MentorRoute><MentorDashboard /></MentorRoute>} />
    </Routes>
  )
}

export default App
