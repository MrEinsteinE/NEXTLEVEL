import { useState, useEffect } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'
import { BarChart3, ChevronDown, Check } from 'lucide-react'
import { getSyllabus } from '../../data/syllabus.js'
import './ProgressVisualization.css'
import { WidgetSkeleton } from '../common/Loaders.jsx'

function ProgressVisualization({ branch, fullView, userKey }) {
  const [view, setView] = useState('overall') // overall, high, medium
  const [ddOpen, setDdOpen] = useState(false)
  const [savedProgress, setSavedProgress] = useState({})
  const [loading, setLoading] = useState(true)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user._id) fetchProgress()
  }, [])

  const fetchProgress = async () => {
    try {
      const res = await axios.get(`/api/student/syllabus-progress/${user._id}`)
      const map = {}
      ;(res.data.progress || []).forEach(p => { map[`${p.subjectIndex}_${p.topicIndex}_${p.subtopicIndex}`] = p.completed })
      setSavedProgress(map)
    } catch (err) {
      console.error('Failed to fetch syllabus progress:', err)
    } finally {
      setLoading(false)
    }
  }
  
  // Progress is keyed by sectionIdx_subjectIdx_topicIdx — the same scheme the
  // Syllabus Tracker uses when it saves a toggle (so both views agree).
  const includeByView = (section) => {
    if (view === 'high') return section.priority === 'high' || section.priority === 'foundation'
    if (view === 'medium') return section.priority === 'medium'
    return true // 'overall'
  }

  const getProgressData = () => {
    const syllabus = getSyllabus(branch)
    let totalTopics = 0
    let completedTopics = 0
    syllabus.forEach((section, sIdx) => {
      if (!includeByView(section)) return
      section.subjects.forEach((sub, subIdx) => {
        sub.topics.forEach((topic, tIdx) => {
          totalTopics++
          if (savedProgress[`${sIdx}_${subIdx}_${tIdx}`]) completedTopics++
        })
      })
    })
    const notStartedTopics = totalTopics - completedTopics
    const completedPct = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100)
    const notStartedPct = totalTopics === 0 ? 100 : Math.round((notStartedTopics / totalTopics) * 100)
    return [
      { name: 'Completed', value: completedPct, color: 'var(--color-success)' },
      { name: 'Not Started', value: notStartedPct, color: '#e2e8f0' }
    ]
  }

  const getSubjectData = () => {
    const syllabus = getSyllabus(branch)
    const priorityWeights = { foundation: 4, high: 3, medium: 2, supporting: 1 }
    const subjectStats = []
    syllabus.forEach((section, sIdx) => {
      if (!includeByView(section)) return
      section.subjects.forEach((sub, subIdx) => {
        let subTotal = 0
        let subCompleted = 0
        sub.topics.forEach((topic, tIdx) => {
          subTotal++
          if (savedProgress[`${sIdx}_${subIdx}_${tIdx}`]) subCompleted++
        })
        if (subTotal > 0) {
          subjectStats.push({
            name: sub.name,
            pct: Math.round((subCompleted / subTotal) * 100),
            weight: priorityWeights[section.priority] || 0
          })
        }
      })
    })
    return subjectStats.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      if (b.pct !== a.pct) return b.pct - a.pct
      return a.name.localeCompare(b.name)
    })
  }

  const data = getProgressData()
  const subjectData = getSubjectData()

  if (loading) return <div className={`progress-viz-widget ${fullView ? 'full' : ''}`}><WidgetSkeleton /></div>

  return (
    <div className={`progress-viz-widget ${fullView ? 'full' : ''}`}>
      <div className="viz-header">
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={18} /> {branch} Progress Analytics</h3>
        <div className="viz-dropdown">
          <button
            type="button"
            className="viz-dropdown-trigger"
            onClick={() => setDdOpen(o => !o)}
            onBlur={() => setTimeout(() => setDdOpen(false), 120)}
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
          >
            {{ overall: 'Overall', high: 'High Priority', medium: 'Medium Priority' }[view]}
            <ChevronDown size={15} strokeWidth={2.2} className={`viz-dd-chevron ${ddOpen ? 'open' : ''}`} />
          </button>
          {ddOpen && (
            <div className="viz-dropdown-menu" role="listbox">
              {[['overall', 'Overall'], ['high', 'High Priority'], ['medium', 'Medium Priority']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  role="option"
                  aria-selected={view === val}
                  className={`viz-dd-option ${view === val ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setView(val); setDdOpen(false) }}
                >
                  {label}
                  {view === val && <Check size={14} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="viz-content">
        <div className="pie-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-center-text">
            <span>{data[0].value}%</span>
            <label>Done</label>
          </div>
        </div>

        <div className="subject-bars">
          <h4>Subject Breakdown</h4>
          {subjectData.map((sub, i) => (
            <div key={i} className="sub-bar-row">
              <div className="sub-bar-info">
                <span className="sub-name">{sub.name}</span>
                <span className="sub-pct">{sub.pct}%</span>
              </div>
              <div className="sub-bar-bg">
                <div className="sub-bar-fill" style={{ width: `${sub.pct}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProgressVisualization
