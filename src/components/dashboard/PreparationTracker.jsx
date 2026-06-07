import { useState, useEffect } from 'react'
import axios from 'axios'
import { Target, Pencil, Save, Sun, CalendarDays, CalendarRange } from 'lucide-react'
import './PreparationTracker.css'

function PreparationTracker({ userKey }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userId = userKey || user.id || user.email || 'default'

  const [editMode, setEditMode] = useState(false)
  const [targets, setTargets] = useState({ daily: 6, weekly: 42, monthly: 180 })
  const [tempTargets, setTempTargets] = useState({ daily: 6, weekly: 42, monthly: 180 })
  const [hours, setHours] = useState({ today: 0, week: 0, month: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user._id) fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [progRes, targetRes] = await Promise.all([
        axios.get(`/api/student/progress/${user._id}`).catch(() => ({ data: {} })),
        axios.get(`/api/student/targets/${user._id}`).catch(() => ({ data: {} }))
      ])
      const p = progRes.data.progress || {}
      setHours({ 
        today: p.today?.studyHours || 0,
        week: p.week?.studyHours || 0,
        month: p.month?.studyHours || 0
      })
      const t = targetRes.data?.targets || { daily: 6, weekly: 42, monthly: 180 }
      setTargets(t)
      setTempTargets(t)
    } catch (err) {
      console.error('Failed to fetch tracker data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getColor = (pct) => {
    if (pct >= 80) return '#10b981'
    if (pct >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const handleSave = async () => {
    setTargets({ ...tempTargets })
    setEditMode(false)
    try {
      await axios.post(`/api/student/targets/${user._id}`, tempTargets)
    } catch (err) {
      console.error('Failed to save targets:', err)
    }
  }

  if (loading) return <div className="prep-tracker"><p style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>Loading tracker...</p></div>

  const cards = [
    {
      icon: <Sun size={18} strokeWidth={2} />,
      title: 'Daily',
      current: hours.today,
      target: targets.daily,
      unit: 'hours',
      key: 'daily',
    },
    {
      icon: <CalendarDays size={18} strokeWidth={2} />,
      title: 'Weekly',
      current: hours.week,
      target: targets.weekly,
      unit: 'hours',
      key: 'weekly',
    },
    {
      icon: <CalendarRange size={18} strokeWidth={2} />,
      title: 'Monthly',
      current: hours.month,
      target: targets.monthly,
      unit: 'hours',
      key: 'monthly',
    },
  ]

  return (
    <div className="prep-tracker">
      <div className="prep-header">
        <h3><Target size={18} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Preparation Tracker</h3>
        {!editMode ? (
          <button className="prep-edit-btn" onClick={() => { setTempTargets({ ...targets }); setEditMode(true) }}>
            <Pencil size={16} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Edit Targets
          </button>
        ) : (
          <button className="prep-save-btn" onClick={handleSave}>
            <Save size={16} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Save All Targets
          </button>
        )}
      </div>

      <div className="prep-cards">
        {cards.map(card => {
          const pct = card.target > 0 ? Math.min(100, Math.round((card.current / card.target) * 100)) : 0
          const barColor = getColor(pct)

          return (
            <div key={card.key} className="prep-card">
              <div className="prep-card-head">
                <span className="prep-icon">{card.icon}</span>
                <span className="prep-title">{card.title}</span>
              </div>
              <div className="prep-card-body">
                <div className="prep-progress-text">
                  <span className="prep-current">{card.current.toFixed(1)}</span>
                  <span className="prep-separator">/</span>
                  {editMode ? (
                    <input
                      type="number"
                      className="prep-target-input"
                      min="1"
                      value={tempTargets[card.key]}
                      onChange={e => setTempTargets(prev => ({ ...prev, [card.key]: Number(e.target.value) }))}
                    />
                  ) : (
                    <span className="prep-target">{card.target}</span>
                  )}
                  <span className="prep-unit">{card.unit}</span>
                </div>
                <div className="prep-progress-bar">
                  <div
                    className="prep-progress-fill"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <div className="prep-pct" style={{ color: barColor }}>{pct}% complete</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PreparationTracker
