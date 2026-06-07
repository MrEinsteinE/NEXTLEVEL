import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Clock, Target, CalendarCheck, Crosshair } from 'lucide-react'
import { WidgetSkeleton, EmptyState } from '../common/Loaders.jsx'

const RANGES = [{ label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }, { label: '3 months', days: 90 }]

// Theme-agnostic chart palette (reads fine on light + dark).
const C = { primary: '#6C63FF', accent: '#22C55E', tick: '#94a3b8', grid: 'rgba(148,163,184,0.22)' }
const dayKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString().split('T')[0] }

export default function ProgressTrends({ userId }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    const uid = userId || JSON.parse(localStorage.getItem('user') || '{}')._id
    if (!uid) { setLoading(false); return }
    axios.get(`/api/student/study-reports/${uid}`)
      .then(r => setReports(r.data.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [userId])

  const series = useMemo(() => {
    const map = {}
    reports.forEach(r => {
      const k = dayKey(r.date)
      if (!map[k]) map[k] = { hours: 0, pyqs: 0, accSum: 0, accCount: 0 }
      map[k].hours += r.studyHours || 0
      map[k].pyqs += r.pyqsSolved || 0
      if (typeof r.accuracy === 'number' && r.accuracy >= 0) { map[k].accSum += r.accuracy; map[k].accCount++ }
    })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const out = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const m = map[dayKey(d)]
      out.push({
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        hours: m ? Math.round(m.hours * 10) / 10 : 0,
        pyqs: m ? m.pyqs : 0,
        accuracy: m && m.accCount ? Math.round(m.accSum / m.accCount) : null,
      })
    }
    return out
  }, [reports, days])

  const stats = useMemo(() => {
    const totalHours = series.reduce((s, d) => s + d.hours, 0)
    const activeDays = series.filter(d => d.hours > 0).length
    const accDays = series.filter(d => d.accuracy != null)
    const avgAcc = accDays.length ? Math.round(accDays.reduce((s, d) => s + d.accuracy, 0) / accDays.length) : null
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      activeDays,
      avgPerActive: activeDays ? Math.round((totalHours / activeDays) * 10) / 10 : 0,
      avgAcc,
    }
  }, [series])

  const hasData = reports.length > 0
  const hasAccuracy = series.some(d => d.accuracy != null)
  const labelEvery = Math.max(1, Math.floor(days / 7))

  if (loading) return <div className="pt-card"><WidgetSkeleton /></div>

  return (
    <div className="pt-card">
      <div className="pt-head">
        <h3><TrendingUp size={18} strokeWidth={2} /> Progress Trends</h3>
        <div className="pt-ranges">
          {RANGES.map(r => (
            <button key={r.days} className={`pt-range ${days === r.days ? 'active' : ''}`} onClick={() => setDays(r.days)}>{r.label}</button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState icon={TrendingUp} title="No trend data yet" message="Log a few daily study reports and your hours and accuracy trends will appear here." />
      ) : (
        <>
          <div className="pt-stats">
            <div className="pt-stat"><span className="pt-ic"><Clock size={16} /></span><div><div className="pt-val">{stats.totalHours}h</div><div className="pt-lab">Total hours</div></div></div>
            <div className="pt-stat"><span className="pt-ic"><CalendarCheck size={16} /></span><div><div className="pt-val">{stats.activeDays}</div><div className="pt-lab">Active days</div></div></div>
            <div className="pt-stat"><span className="pt-ic"><Target size={16} /></span><div><div className="pt-val">{stats.avgPerActive}h</div><div className="pt-lab">Avg / active day</div></div></div>
            <div className="pt-stat"><span className="pt-ic"><Crosshair size={16} /></span><div><div className="pt-val">{stats.avgAcc != null ? stats.avgAcc + '%' : '—'}</div><div className="pt-lab">Avg accuracy</div></div></div>
          </div>

          <div className="pt-chart-title">Study hours</div>
          <div className="pt-chart">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={series} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="ptHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.tick }} interval={labelEvery - 1} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.tick }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontSize: 12 }} labelStyle={{ color: 'var(--color-text-secondary)' }} formatter={(v) => [`${v}h`, 'Studied']} />
                <Area type="monotone" dataKey="hours" stroke={C.primary} strokeWidth={2.5} fill="url(#ptHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {hasAccuracy && (
            <>
              <div className="pt-chart-title">PYQ accuracy</div>
              <div className="pt-chart">
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={series} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.tick }} interval={labelEvery - 1} dy={8} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.tick }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontSize: 12 }} labelStyle={{ color: 'var(--color-text-secondary)' }} formatter={(v) => [`${v}%`, 'Accuracy']} />
                    <Line type="monotone" dataKey="accuracy" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        .pt-card { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,.05)); }
        .pt-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .pt-head h3 { display: inline-flex; align-items: center; gap: 8px; font-size: 1.05rem; font-weight: 800; color: var(--color-text-primary); margin: 0; }
        .pt-ranges { display: inline-flex; gap: 6px; }
        .pt-range { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg-input, var(--color-bg)); color: var(--color-text-secondary); font-family: inherit; font-weight: 700; font-size: .78rem; cursor: pointer; transition: all .15s; }
        .pt-range:hover { color: var(--color-primary); border-color: var(--color-primary); }
        .pt-range.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
        .pt-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px; }
        .pt-stat { display: flex; align-items: center; gap: 10px; background: var(--color-bg-input, var(--color-bg)); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px 14px; }
        .pt-ic { width: 32px; height: 32px; border-radius: 9px; background: rgba(108,99,255,0.14); color: var(--color-primary); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pt-val { font-size: 1.2rem; font-weight: 900; color: var(--color-text-primary); line-height: 1.1; }
        .pt-lab { font-size: .72rem; color: var(--color-text-muted); font-weight: 700; }
        .pt-chart-title { font-size: .82rem; font-weight: 800; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: .04em; margin: 6px 0 8px; }
        .pt-chart { width: 100%; }
        .pt-chart + .pt-chart-title { margin-top: 18px; }
      `}</style>
    </div>
  )
}
