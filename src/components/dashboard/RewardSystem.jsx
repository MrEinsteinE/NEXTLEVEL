import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Trophy, Flame, Star, Sprout, Zap, Crown, Lock, CheckCircle2,
  FileText, ClipboardList, PartyPopper, Snowflake, ChevronDown, Info
} from 'lucide-react'
import './RewardSystem.css'
import { WidgetSkeleton } from '../common/Loaders.jsx'

const BADGE_ICONS = {
  "Consistency Builder": Sprout,
  "Dedicated Aspirant": Zap,
  "Discipline Master": Crown,
}

function RewardSystem({ userKey }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  // Use the real DB id for the API call. (userKey is a sanitized-email string
  // for client-side namespacing — not a valid ObjectId — and must not be sent.)
  const currentUserId = user._id || user.id || 'default'

  const [data, setData] = useState({ streak: 0, badges: [], points: user.points || 0 })
  const [loading, setLoading] = useState(true)
  const [showHow, setShowHow] = useState(false)

  useEffect(() => {
    if (currentUserId !== 'default') fetchRewards()
  }, [])

  const fetchRewards = async () => {
    try {
      const res = await axios.get(`/api/student/rewards/${currentUserId}`)
      const apiStreak = res.data.streak || 0

      const badgeDefs = [
        { name: "Consistency Builder", desc: "7-day study streak", requirement: 7 },
        { name: "Dedicated Aspirant", desc: "14-day study streak", requirement: 14 },
        { name: "Discipline Master", desc: "30-day study streak", requirement: 30 },
      ]

      const formattedBadges = badgeDefs.map(b => ({
        ...b,
        earned: apiStreak >= b.requirement,
        progress: Math.min(100, Math.round((apiStreak / b.requirement) * 100)),
      }))

      setData({ streak: apiStreak, badges: formattedBadges, points: res.data.points || 0 })
    } catch (err) {
      console.error('Failed to fetch rewards:', err)
    } finally {
      setLoading(false)
    }
  }

  const { streak, badges, points } = data
  const level = Math.floor(points / 500) + 1
  const levelFloor = (level - 1) * 500
  const levelProgress = Math.min(100, Math.round(((points - levelFloor) / 500) * 100))

  if (loading) return <div className="reward-widget glass"><WidgetSkeleton /></div>

  return (
    <div className="reward-widget glass animate-fade-in">
      <div className="reward-header">
        <h3><Trophy size={18} strokeWidth={2} className="reward-h-icon" /> Achievements</h3>
        <span className="points-badge"><Star size={13} strokeWidth={2.5} /> {points.toLocaleString()} PTS</span>
      </div>

      {/* Streak & Level */}
      <div className="streak-level-row">
        <div className="streak-card">
          <span className="streak-fire"><Flame size={26} strokeWidth={2} /></span>
          <span className="streak-num">{streak}</span>
          <span className="streak-label">Day Streak</span>
        </div>
        <div className="level-card">
          <span className="level-star"><Star size={26} strokeWidth={2} /></span>
          <span className="level-num">Lv. {level}</span>
          <span className="level-label">{points.toLocaleString()} points</span>
          <div className="level-progress-bar">
            <div className="level-progress-fill" style={{ width: `${levelProgress}%` }} />
          </div>
          <span className="level-next">{500 - (points - levelFloor)} pts to Lv. {level + 1}</span>
        </div>
      </div>

      {/* How points work explainer */}
      <button
        type="button"
        className={`how-toggle ${showHow ? 'open' : ''}`}
        onClick={() => setShowHow(s => !s)}
        aria-expanded={showHow}
      >
        <span className="how-toggle-label"><Info size={15} strokeWidth={2} /> How points &amp; streaks work</span>
        <ChevronDown size={16} strokeWidth={2} className="how-chevron" />
      </button>

      {showHow && (
        <div className="how-panel">
          <ul className="how-list">
            <li>
              <span className="how-icon report"><FileText size={15} strokeWidth={2} /></span>
              <span className="how-text">Submit a daily study report</span>
              <span className="how-pts">+20</span>
            </li>
            <li>
              <span className="how-icon task"><ClipboardList size={15} strokeWidth={2} /></span>
              <span className="how-text">Complete each daily task</span>
              <span className="how-pts">+10</span>
            </li>
            <li>
              <span className="how-icon bonus"><PartyPopper size={15} strokeWidth={2} /></span>
              <span className="how-text">Finish all daily tasks</span>
              <span className="how-pts">+50</span>
            </li>
            <li>
              <span className="how-icon streak"><Flame size={15} strokeWidth={2} /></span>
              <span className="how-text">Streak = days in a row you submit a report</span>
            </li>
            <li>
              <span className="how-icon freeze"><Snowflake size={15} strokeWidth={2} /></span>
              <span className="how-text">Streak-freeze token (protects a missed day)</span>
              <span className="how-pts cost">-100</span>
            </li>
          </ul>
          <p className="how-foot">Earn badges at 7, 14 &amp; 30-day streaks. Every 500 points levels you up.</p>
        </div>
      )}

      {/* Badges */}
      <div className="badges-list">
        {badges.map((badge, idx) => {
          const BadgeIcon = BADGE_ICONS[badge.name] || Trophy
          return (
            <div key={idx} className={`badge-card ${badge.earned ? 'earned' : 'locked'}`}>
              <div className="badge-icon-wrap">
                <span className="badge-icon"><BadgeIcon size={24} strokeWidth={2} /></span>
                {!badge.earned && <span className="badge-lock"><Lock size={13} strokeWidth={2.5} /></span>}
              </div>
              <div className="badge-info">
                <h4 className="badge-name">{badge.name}</h4>
                <p className="badge-desc">{badge.desc}</p>
                {badge.earned ? (
                  <span className="badge-date"><CheckCircle2 size={13} strokeWidth={2.5} /> Unlocked!</span>
                ) : (
                  <div className="badge-progress-wrap">
                    <div className="badge-progress-bar">
                      <div className="badge-progress-fill" style={{ width: `${badge.progress}%` }} />
                    </div>
                    <span className="badge-progress-text">{streak}/{badge.requirement} days</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RewardSystem
