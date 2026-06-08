import { useState, useEffect } from 'react'
import axios from 'axios'
import { Rocket, BookOpen, Clock, Pin, Star, ChevronDown, ChevronRight } from 'lucide-react'
import { getSyllabus, countAllTopics } from '../../data/syllabus.js'
import './SyllabusChecklist.css'
import { WidgetSkeleton } from '../common/Loaders.jsx'

// Isolated so the per-second tick only re-renders the countdown,
// not the entire (heavy) syllabus tree.
function GateCountdown() {
  const [t, setT] = useState({ days: 0, hours: 0, mins: 0, secs: 0 })

  useEffect(() => {
    const target = new Date('2027-02-07T09:00:00').getTime()
    const tick = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setT({ days: 0, hours: 0, mins: 0, secs: 0 }); return }
      setT({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        mins: Math.floor((diff / 60000) % 60),
        secs: Math.floor((diff / 1000) % 60)
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div className="countdown-container glass animate-fade-in">
      <div className="countdown-title">
        <span className="icon" style={{ display: 'inline-flex' }}><Rocket size={18} strokeWidth={2} /></span>
        <h3 className="gradient-text">GATE 2027 Countdown</h3>
      </div>
      <div className="countdown-display">
        <span className="countdown-value">{t.days}</span> Days{' '}
        <span className="countdown-value">{pad(t.hours)}</span> Hours{' '}
        <span className="countdown-value">{pad(t.mins)}</span> Mins{' '}
        <span className="countdown-value">{pad(t.secs)}</span> Secs
      </div>
    </div>
  )
}

function SyllabusChecklist({ branch, userKey }) {
  const [syllabus, setSyllabus] = useState([])
  const [progress, setProgress] = useState({})
  const [expandedSection, setExpandedSection] = useState('High Priority Subjects')
  const [loading, setLoading] = useState(true)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    const data = getSyllabus(branch)
    setSyllabus(data)
    
    if (user._id) {
      fetchProgress()
    } else {
      setLoading(false)
    }
  }, [branch, userKey])

  const fetchProgress = async () => {
    try {
      const res = await axios.get(`/api/student/syllabus-progress/${user._id}`)
      const progressMap = {}
      if (res.data.progress) {
        res.data.progress.forEach(p => {
          const key = `${p.subjectIndex}_${p.topicIndex}_${p.subtopicIndex}`
          progressMap[key] = p.completed
        })
      }
      setProgress(progressMap)
    } catch (err) {
      console.error('Failed to fetch syllabus progress:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSubtopic = async (sectionIdx, subjectIdx, topicIdx, currentCompleted) => {
    const key = `${sectionIdx}_${subjectIdx}_${topicIdx}`
    const newProgress = !currentCompleted
    
    // Optimistic UI update
    setProgress(prev => ({ ...prev, [key]: newProgress }))

    try {
      await axios.post(`/api/student/syllabus-progress/${user._id}`, {
        subjectIndex: sectionIdx,
        topicIndex: subjectIdx,
        subtopicIndex: topicIdx,
        completed: newProgress
      })
    } catch (err) {
      console.error('Failed to sync progress:', err)
      // Revert on failure
      setProgress(prev => ({ ...prev, [key]: currentCompleted }))
    }
  }

  const isSubtopicCompleted = (sectionIdx, subjectIdx, topicIdx) => {
    const key = `${sectionIdx}_${subjectIdx}_${topicIdx}`
    return progress[key] === true
  }

  const getTopicProgress = (sectionIdx, subjectIdx, subtopics) => {
    if (!subtopics || subtopics.length === 0) return { completed: 0, total: 0, percentage: 0 }
    
    let completed = 0
    subtopics.forEach((sub, tIdx) => {
      if (isSubtopicCompleted(sectionIdx, subjectIdx, tIdx)) completed++
    })
    
    return {
      completed,
      total: subtopics.length,
      percentage: Math.round((completed / subtopics.length) * 100)
    }
  }

  const getSubjectProgress = (subject, sectionIdx, subjectIdx) => {
    let completed = 0
    let total = 0
    
    subject.topics.forEach((topic, tIdx) => {
      if (isSubtopicCompleted(sectionIdx, subjectIdx, tIdx)) completed++
      total++
    })
    
    return {
      completed,
      total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100)
    }
  }

  const getOverallProgress = () => {
    let completed = 0
    let total = 0
    
    syllabus.forEach((section, sIdx) => {
      section.subjects.forEach((subject, subIdx) => {
        const stats = getSubjectProgress(subject, sIdx, subIdx)
        completed += stats.completed
        total += stats.total
      })
    })
    
    // Rough estimate: ~1.5 focused study + practice hours per remaining topic.
    const HOURS_PER_TOPIC = 1.5
    return {
      completed,
      total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      hoursLeft: Math.round((total - completed) * HOURS_PER_TOPIC)
    }
  }

  const getRecommendation = () => {
    const allSubjects = []
    syllabus.forEach((section, sIdx) => {
      if (section.priority === 'foundation' || section.priority === 'high') {
        section.subjects.forEach((subject, subIdx) => {
          allSubjects.push({ 
            name: subject.name, 
            ...getSubjectProgress(subject, sIdx, subIdx) 
          })
        })
      }
    })
    
    if (allSubjects.length === 0) return null

    const leastCompleted = allSubjects.sort((a, b) => a.percentage - b.percentage)[0]
    return leastCompleted
  }

  const overall = getOverallProgress()
  const recommendation = getRecommendation()
  
  if (loading) return <div className="syllabus-checklist"><WidgetSkeleton /></div>

  return (
    <div className="syllabus-checklist">
      {/* Live GATE countdown (isolated so the 1s tick doesn't re-render the syllabus tree) */}
      <GateCountdown />

      <div className="syllabus-header">
        <h2 className="section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} strokeWidth={2} /> {branch} Syllabus Progress
        </h2>
        <div className="overall-progress-bar">
          <div className="progress-fill" style={{ width: `${overall.percentage}%` }}></div>
        </div>
        <div className="overall-stats">
          <span>Overall: {overall.percentage}% Complete</span>
          <span>{overall.completed}/{overall.total} Topics</span>
          <span className="est-time" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={14} strokeWidth={2} /> Est. {overall.hoursLeft} hours left</span>
        </div>
      </div>

      {recommendation && (
        <div className="smart-recommendation">
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: '-3px' }}><Pin size={16} strokeWidth={2} /> Smart Recommendation:</strong> Focus on <span>{recommendation.name}</span> - {recommendation.percentage === 0 ? 'Not started yet.' : `Only ${recommendation.percentage}% complete.`}
        </div>
      )}

      <div className="subject-breakdown-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Subject Breakdown</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sorted by Priority</span>
        </div>
        <div className="subject-breakdown-grid">
          {[...syllabus]
            .map((section, sIdx) => ({ ...section, sIdx }))
            .sort((a, b) => {
              const weights = { foundation: 4, high: 3, medium: 2, supporting: 1 }
              return (weights[b.priority] || 0) - (weights[a.priority] || 0)
            })
            .flatMap(section => section.subjects.map((s, subIdx) => ({ ...s, priority: section.priority, sIdx: section.sIdx, subIdx })))
            .map((subject, idx) => {
              const stats = getSubjectProgress(subject, subject.sIdx, subject.subIdx)
              return (
                <div key={idx} className={`breakdown-card priority-${subject.priority}`}>
                  <div className="breakdown-header">
                    <span className="breakdown-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {(subject.priority === 'foundation' || subject.priority === 'high') && <Star size={14} strokeWidth={2} style={{ flexShrink: 0 }} />}
                      {subject.name}
                    </span>
                    <span className="breakdown-pct">{stats.percentage}%</span>
                  </div>
                  <div className="breakdown-progress-bg">
                    <div className="breakdown-progress-fill" style={{ width: `${stats.percentage}%` }}></div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      <div className="syllabus-accordion">
        {syllabus.map((section, idx) => (
          <div key={idx} className={`syllabus-section priority-${section.priority}`}>
            <div 
              className="section-header" 
              onClick={() => setExpandedSection(expandedSection === section.name ? null : section.name)}
            >
              <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {section.priority === 'high' && <Star size={15} strokeWidth={2} style={{ flexShrink: 0 }} />}
                {section.name}
              </h3>
              <span className="expand-icon" style={{ display: 'inline-flex' }}>{expandedSection === section.name ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}</span>
            </div>
            
            {expandedSection === section.name && (
              <div className="section-content">
                {section.subjects.map((subject, sIdx) => {
                  const subStats = getSubjectProgress(subject, idx, sIdx)
                  return (
                    <div key={sIdx} className="subject-card">
                      <div className="subject-header">
                        <h4>{subject.name}</h4>
                        <div className="subject-stats">
                          <span className="stat-pct">{subStats.percentage}%</span>
                          <span className="stat-count">({subStats.completed}/{subStats.total})</span>
                        </div>
                      </div>
                      <div className="subject-progress-bar">
                        <div className="progress-fill" style={{ width: `${subStats.percentage}%` }}></div>
                      </div>
                      
                      <div className="topics-list">
                        {subject.topics.map((topic, tIdx) => {
                          const isDone = isSubtopicCompleted(idx, sIdx, tIdx)
                          return (
                            <label key={tIdx} className={`topic-item ${isDone ? 'completed' : ''}`}>
                              <input 
                                type="checkbox" 
                                checked={isDone}
                                onChange={() => handleToggleSubtopic(idx, sIdx, tIdx, isDone)}
                              />
                              <span className="custom-checkbox"></span>
                              <span className="topic-name">{topic}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SyllabusChecklist
