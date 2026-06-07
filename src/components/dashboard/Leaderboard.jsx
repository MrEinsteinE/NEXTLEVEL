import { useState, useEffect } from 'react'
import axios from 'axios'
import { Trophy, Medal, Flame } from 'lucide-react'
import './Leaderboard.css'
import { WidgetSkeleton } from '../common/Loaders.jsx'

function Leaderboard({ fullView }) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [tab, setTab] = useState('all')

  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get('/api/leaderboard')
      setLeaderboard(res.data.leaderboard || [])
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter by branch if tab is set
  const filtered = tab === 'all' ? leaderboard : leaderboard.filter(s => s.branch === tab)

  // Re-assign ranks dynamically based on the current filter
  const ranked = filtered.map((s, i) => ({ ...s, rank: i + 1 }))

  const displayList = (fullView || showAll) ? ranked : ranked.slice(0, 5)

  if (loading) return <div className="leaderboard-widget"><WidgetSkeleton /></div>

  const renderPodiumIcon = (rank) => {
    if (rank === 1) return <Trophy size={18} strokeWidth={2} />
    return <Medal size={18} strokeWidth={2} />
  }

  return (
    <div className={`leaderboard-widget ${fullView ? 'full' : ''}`}>
      <div className="lb-header">
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} strokeWidth={2} /> Top Aspirants
        </h3>
        <div className="lb-tabs">
          {['all', 'ECE', 'EE', 'CSE'].map(t => (
            <button
              key={t}
              className={`lb-tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {displayList.length === 0 && (
        <div className="lb-empty">
          <p>No students registered yet. Be the first to climb the ranks!</p>
        </div>
      )}

      <div className="lb-list">
        {displayList.map(student => {
          // Match by id (always present); email is only returned to mentors now.
          const isMe = String(student.id) === String(currentUser._id || currentUser.id)
            || (!!student.email && student.email === currentUser.email)
          return (
            <div key={student.id || student.rank} className={`lb-item ${isMe ? 'is-me' : ''} ${student.rank <= 3 ? `rank-${student.rank}` : ''}`}>
              <div className="lb-rank" style={student.rank <= 3 ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}>
                {student.rank <= 3 ? renderPodiumIcon(student.rank) : `#${student.rank}`}
              </div>
              <div className="lb-info">
                <div className="lb-name">
                  {student.name} {isMe && <span className="lb-you-tag">YOU</span>}
                </div>
                <div className="lb-details">
                  <span className="lb-branch">{student.branch}</span> •
                  <span className="lb-points"> {(student.points || 0).toLocaleString()} PTS</span> •
                  <span className="lb-hours"> {(student.totalHours || 0).toFixed(1)}h studied</span>
                </div>
              </div>
              <div className="lb-streak" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Flame size={13} strokeWidth={2} /> {student.streak}</div>
            </div>
          )
        })}
      </div>

      {!fullView && !showAll && ranked.length > 5 && (
        <button className="lb-view-all" onClick={() => setShowAll(true)}>
          View Full Leaderboard ({ranked.length})
        </button>
      )}
      {!fullView && showAll && ranked.length > 5 && (
        <button className="lb-view-all" onClick={() => setShowAll(false)}>
          Show Top 5
        </button>
      )}
    </div>
  )
}

export default Leaderboard
