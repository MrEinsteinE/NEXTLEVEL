import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Clock, CalendarDays, CalendarRange, PartyPopper } from 'lucide-react'
import './WorkingHoursTracker.css'
import { WidgetSkeleton } from '../common/Loaders.jsx'

function WorkingHoursTracker() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const targets = user.targets || { daily: 6, weekly: 42, monthly: 180 }
  
  const [data, setData] = useState({ today: 0, week: 0, month: 0, weekData: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user._id) fetchAndProcessReports()
  }, [])

  const fetchAndProcessReports = async () => {
    try {
      const res = await axios.get(`/api/student/study-reports/${user._id}`)
      const reports = res.data.reports || []
      setData(getHoursFromReports(reports))
    } catch (err) {
      console.error('Failed to fetch reports for hours tracker:', err)
    } finally {
      setLoading(false)
    }
  }

  const getHoursFromReports = (reports) => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let today = 0, week = 0, month = 0

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekMap = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      weekMap[d.toISOString().split('T')[0]] = { day: dayNames[d.getDay()], hours: 0 }
    }

    reports.forEach(r => {
      const rDate = new Date(r.date)
      // r.date is a full ISO datetime (e.g. 2026-06-06T00:00:00.000Z); normalise
      // to YYYY-MM-DD before comparing with date-only keys.
      const rKey = rDate.toISOString().split('T')[0]
      const hours = Number(r.studyHours) || 0
      if (rKey === todayStr) today += hours
      if (rDate >= weekStart) week += hours
      if (rDate >= monthStart) month += hours
      if (weekMap[rKey]) weekMap[rKey].hours += hours
    })

    const weekData = Object.values(weekMap)

    return { today, week, month, weekData }
  }

  const todayPct = targets.daily > 0 ? Math.min(100, Math.round((data.today / targets.daily) * 100)) : 0
  const weekPct = targets.weekly > 0 ? Math.min(100, Math.round((data.week / targets.weekly) * 100)) : 0
  const monthPct = targets.monthly > 0 ? Math.min(100, Math.round((data.month / targets.monthly) * 100)) : 0

  if (loading) return <div className="hours-tracker"><WidgetSkeleton /></div>

  return (
    <div className="hours-tracker">
      <div className="hours-header">
        <h3><Clock size={18} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Working Hours</h3>
        <span className="hours-subtitle">From study reports</span>
      </div>

      {/* Today */}
      <div className="today-progress">
        <div className="progress-text">
          <span className="current">{data.today.toFixed(1)}h</span>
          <span className="target">/ {targets.daily}h Today</span>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${todayPct}%`, background: todayPct >= 100 ? 'var(--color-success, #10b981)' : 'var(--color-primary, #2563eb)' }}></div>
        </div>
        <p className="progress-msg">
          {todayPct >= 100 ? (
            <><PartyPopper size={16} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Target achieved! Great job.</>
          ) : `Keep going! ${Math.max(0, targets.daily - data.today).toFixed(1)}h remaining.`}
        </p>
      </div>

      {/* Week & Month summary */}
      <div className="hours-summary-row">
        <div className="hours-summary-item">
          <span className="hs-label"><CalendarDays size={16} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> This Week</span>
          <span className="hs-value">{data.week.toFixed(1)}h / {targets.weekly}h</span>
          <div className="hs-bar"><div className="hs-bar-fill" style={{ width: `${weekPct}%` }} /></div>
        </div>
        <div className="hours-summary-item">
          <span className="hs-label"><CalendarRange size={16} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> This Month</span>
          <span className="hs-value">{data.month.toFixed(1)}h / {targets.monthly}h</span>
          <div className="hs-bar"><div className="hs-bar-fill" style={{ width: `${monthPct}%` }} /></div>
        </div>
      </div>

      {/* Weekly chart */}
      {data.weekData.length > 0 && (
        <div className="chart-container">
          <h4>Weekly Trend</h4>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="hours" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkingHoursTracker
