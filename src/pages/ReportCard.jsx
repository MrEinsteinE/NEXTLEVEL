import { useEffect, useState } from 'react';
import api from '../utils/api';
import { BarChart3, Clock, Target, Flame, BookOpen, MessageCircle } from 'lucide-react';
import { WidgetSkeleton } from '../components/common/Loaders.jsx';

export default function ReportCard() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await api.get(`/api/reportcard/${user._id}`);
        setReport(res.data.report || null);
      } catch (err) { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <WidgetSkeleton />;
  if (!report) return <p style={{ color: 'var(--color-text-muted)' }}>Could not load your report card.</p>;

  const monthLabel = report.period?.start
    ? new Date(report.period.start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'This month';

  const stats = [
    { icon: Clock, label: 'Study Hours', value: `${report.totalStudyHours ?? 0}h` },
    { icon: Target, label: 'PYQs Solved', value: report.totalPYQs ?? 0 },
    { icon: BarChart3, label: 'Avg Accuracy', value: report.averageAccuracy != null ? `${report.averageAccuracy}%` : '—' },
    { icon: Flame, label: 'Streak', value: `${report.streak ?? 0} days` },
    { icon: BookOpen, label: 'Syllabus', value: report.syllabusPercent != null ? `${report.syllabusPercent}%` : '—' },
  ];

  return (
    <div className="rc-board">
      <div className="rc-head">
        <h2>Report Card</h2>
        <span className="rc-month">{monthLabel}</span>
      </div>

      <div className="rc-stats">
        {stats.map((s, i) => (
          <div key={i} className="rc-stat">
            <span className="rc-ic"><s.icon size={18} strokeWidth={2} /></span>
            <span className="rc-val">{s.value}</span>
            <span className="rc-lab">{s.label}</span>
          </div>
        ))}
      </div>

      <h3 className="rc-sec">Badges</h3>
      {(report.badges || []).length === 0 ? (
        <p className="rc-muted">No badges earned yet.</p>
      ) : (
        <div className="rc-badges">{report.badges.map((b, i) => <span key={i} className="rc-badge">{b.name || b}</span>)}</div>
      )}

      <h3 className="rc-sec"><MessageCircle size={16} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Mentor feedback this month</h3>
      {(report.mentorFeedbacks || []).length === 0 ? (
        <p className="rc-muted">No mentor feedback this month.</p>
      ) : (
        <div className="rc-feedbacks">
          {report.mentorFeedbacks.map((f, i) => (
            <div key={f._id || i} className="rc-fb">
              <p>{f.text}</p>
              <span className="rc-fb-date">{new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .rc-board { max-width: 840px; }
        .rc-head { display:flex; align-items:baseline; gap:12px; margin-bottom:16px; }
        .rc-head h2 { font-size:1.4rem; font-weight:900; color:var(--color-text-primary); margin:0; }
        .rc-month { color:var(--color-text-muted); font-weight:700; font-size:.9rem; }
        .rc-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:22px; }
        .rc-stat { background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:4px; }
        .rc-ic { width:34px; height:34px; border-radius:9px; background:var(--color-primary-light); color:var(--color-primary); display:inline-flex; align-items:center; justify-content:center; }
        .rc-val { font-size:1.5rem; font-weight:900; color:var(--color-text-primary); line-height:1.1; }
        .rc-lab { font-size:.74rem; color:var(--color-text-muted); font-weight:700; text-transform:uppercase; letter-spacing:.03em; }
        .rc-sec { font-size:1rem; font-weight:800; color:var(--color-text-primary); margin:18px 0 10px; }
        .rc-muted { color:var(--color-text-muted); }
        .rc-badges { display:flex; flex-wrap:wrap; gap:8px; }
        .rc-badge { background:var(--color-primary-light); color:var(--color-primary); font-weight:700; font-size:.8rem; padding:6px 12px; border-radius:999px; }
        .rc-feedbacks { display:flex; flex-direction:column; gap:10px; }
        .rc-fb { background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; gap:12px; }
        .rc-fb p { margin:0; font-size:.92rem; color:var(--color-text-primary); line-height:1.5; }
        .rc-fb-date { color:var(--color-text-muted); font-size:.78rem; white-space:nowrap; }
      `}</style>
    </div>
  );
}
