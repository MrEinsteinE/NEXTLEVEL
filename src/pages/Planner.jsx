import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { WidgetSkeleton, EmptyState } from '../components/common/Loaders.jsx';
import { CalendarRange, Sparkles, CheckCircle2, Circle, CalendarPlus } from 'lucide-react';
import './study-tools.css';

const Planner = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [dailyHours, setDailyHours] = useState(4);
  const [planNote, setPlanNote] = useState(null);

  useEffect(() => {
    if (user) fetchPlan();
    // eslint-disable-next-line
  }, [user]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/planner');
      if (res.data?.success) setPlan(res.data.plan);
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (!targetDate) return;
    try {
      setLoading(true);
      const res = await api.post('/api/planner/generate', { targetDate, dailyHours });
      if (res.data?.success) { setPlan(res.data.plan); setPlanNote(res.data.note || null); }
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  const markDay = async (date) => {
    try {
      setLoading(true);
      await api.patch('/api/planner/mark-day', { date, actualHours: 1 });
      await fetchPlan();
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  // Export the plan as an .ics file (all-day events per day) so it drops into
  // Google / Apple / Outlook calendars with reminders. Built inline — no dependency.
  const downloadIcs = () => {
    const list = plan?.dailyPlans || [];
    if (!list.length) return;
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`; };
    const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const now = new Date();
    const stamp = `${ymd(now)}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NEXT_LEVEL//Study Planner//EN', 'CALSCALE:GREGORIAN'];
    list.forEach((dp, i) => {
      const start = new Date(dp.date);
      const end = new Date(start); end.setDate(start.getDate() + 1);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:nextlevel-plan-${i}-${ymd(dp.date)}@nextlevel`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${ymd(start)}`);
      lines.push(`DTEND;VALUE=DATE:${ymd(end)}`);
      lines.push(`SUMMARY:${esc(`Study: ${dp.topics?.length || 0} topics (~${dp.estimatedHours}h)`)}`);
      lines.push(`DESCRIPTION:${esc((dp.topics || []).join('\n'))}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nextlevel-study-plan.ics'; a.click();
    URL.revokeObjectURL(url);
  };

  const days = plan?.dailyPlans || [];
  const doneCount = days.filter(d => d.completed).length;
  const totalTopics = days.reduce((s, d) => s + (d.topics?.length || 0), 0);

  return (
    <div className="st-page">
      <h2>Study Planner</h2>
      <p className="st-sub">Generates a day-by-day schedule from the topics you haven't finished yet — weak subjects first — spread evenly between today and your target date.</p>

      <div className="st-card">
        <h3 className="st-section-title" style={{ marginBottom: 16 }}><span className="st-ic"><Sparkles size={17} strokeWidth={2} /></span> Generate a plan</h3>
        <div className="st-row">
          <div className="st-field" style={{ flex: 1 }}>
            <span className="st-label">Target date</span>
            <input className="st-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="st-field" style={{ flex: 1 }}>
            <span className="st-label">Hours per day</span>
            <input className="st-input" type="number" min={1} max={16} value={dailyHours} onChange={(e) => setDailyHours(Number(e.target.value))} />
          </div>
          <button className="st-btn" onClick={handleGenerate} disabled={loading || !targetDate}><Sparkles size={16} strokeWidth={2.2} /> Generate plan</button>
        </div>
        <p className="st-li-sub" style={{ marginTop: 12 }}>It pulls your remaining (unchecked) syllabus topics, prioritises subjects your mentor flagged as weak, estimates time by difficulty, then packs each day up to your daily-hours budget (2–8 topics/day).</p>
        {planNote && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-light)', color: 'var(--color-warning)', fontSize: '.86rem', fontWeight: 600, border: '1px solid var(--color-warning)' }}>
            ⚠ {planNote}
          </div>
        )}
      </div>

      {loading && <WidgetSkeleton />}

      {!plan && !loading && (
        <div className="st-card">
          <EmptyState icon={CalendarRange} title="No study plan yet" message="Pick a target date and hours per day, then hit Generate to build your schedule." />
        </div>
      )}

      {plan && !loading && (
        <div className="st-card">
          <div className="st-card-head">
            <h3 className="st-section-title"><span className="st-ic"><CalendarRange size={17} strokeWidth={2} /></span> Your plan</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {plan.targetDate && <span className="st-pill">Target {new Date(plan.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
              <button type="button" className="st-btn st-btn-ghost" onClick={downloadIcs}><CalendarPlus size={15} strokeWidth={2} /> Add to Calendar</button>
            </div>
          </div>

          <div className="st-stats" style={{ marginBottom: 18 }}>
            <div className="st-stat"><div className="st-stat-val">{days.length}</div><div className="st-stat-lab">Days planned</div></div>
            <div className="st-stat"><div className="st-stat-val">{totalTopics}</div><div className="st-stat-lab">Topics to cover</div></div>
            <div className="st-stat"><div className="st-stat-val">{doneCount}/{days.length}</div><div className="st-stat-lab">Days completed</div></div>
          </div>

          <div className="st-list">
            {days.map((dp, idx) => (
              <div key={idx} className="pl-day" style={{ opacity: dp.completed ? 0.7 : 1 }}>
                <div className="pl-day-head">
                  <div>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{new Date(dp.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                    <span className="st-li-sub" style={{ marginLeft: 8 }}>{dp.topics?.length || 0} topics · ~{dp.estimatedHours}h</span>
                  </div>
                  {dp.completed ? (
                    <span className="st-pill ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} strokeWidth={2.4} /> Done</span>
                  ) : (
                    <button className="st-btn st-btn-ghost" onClick={() => markDay(dp.date)} disabled={loading}><Circle size={14} strokeWidth={2} /> Mark done</button>
                  )}
                </div>
                {Array.isArray(dp.topics) && dp.topics.length > 0 && (
                  <div className="pl-topics">
                    {dp.topics.map((t, i) => <span key={i} className="pl-topic">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .pl-day { background: var(--color-bg-input, var(--color-bg)); border:1px solid var(--color-border); border-radius:12px; padding:14px 16px; }
        .pl-day-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .pl-topics { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .pl-topic { font-size:.78rem; font-weight:600; color:var(--color-text-secondary); background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:8px; padding:4px 9px; }
      `}</style>
    </div>
  );
};

export default Planner;
