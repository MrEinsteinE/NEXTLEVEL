import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { WidgetSkeleton, EmptyState } from '../components/common/Loaders.jsx';
import { ClipboardList, BarChart3, Plus, History } from 'lucide-react';
import './study-tools.css';

const accColor = (acc) => acc == null ? 'var(--color-text-muted)'
  : acc >= 70 ? 'var(--color-success)' : acc >= 40 ? 'var(--color-warning)' : 'var(--color-danger)';
const accClass = (acc) => acc == null ? '' : acc >= 70 ? 'ok' : acc >= 40 ? 'warn' : 'bad';

const PYQTracker = () => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);

  const [subject, setSubject] = useState('');
  const [attempted, setAttempted] = useState('');
  const [correct, setCorrect] = useState('');

  useEffect(() => {
    if (user) loadProgress();
    // eslint-disable-next-line
  }, [user]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/pyq/progress');
      if (res.data?.success) {
        setAnalysis(res.data.analysis || []);
        setRecent(res.data.recent || []);
      }
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  const logSet = async (e) => {
    e.preventDefault();
    const a = parseInt(attempted, 10);
    const c = parseInt(correct, 10);
    if (!subject.trim()) return;
    if (!Number.isFinite(a) || a < 1 || !Number.isFinite(c) || c < 0 || c > a) return;
    try {
      setLoading(true);
      await api.post('/api/pyq/set', { subject: subject.trim(), attempted: a, correct: c });
      setAttempted(''); setCorrect('');
      await loadProgress();
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  const totalAttempted = analysis.reduce((s, x) => s + (x.attempted || 0), 0);
  const aNum = parseInt(attempted, 10);
  const cNum = parseInt(correct, 10);
  const liveAcc = Number.isFinite(aNum) && aNum > 0 && Number.isFinite(cNum) && cNum >= 0 && cNum <= aNum
    ? Math.round((cNum / aNum) * 100) : null;
  const overflow = Number.isFinite(aNum) && Number.isFinite(cNum) && cNum > aNum;

  return (
    <div className="st-page">
      <h2>PYQ Tracker</h2>
      <p className="st-sub">After each practice session, log how many previous-year questions you attempted and how many you got right. Your accuracy by subject builds up so you know exactly where to focus.</p>

      {loading && <WidgetSkeleton />}

      {!loading && (
        <>
          <div className="st-card">
            <div className="st-card-head">
              <h3 className="st-section-title"><span className="st-ic"><BarChart3 size={17} strokeWidth={2} /></span> Accuracy by subject</h3>
              {totalAttempted > 0 && <span className="st-pill">{totalAttempted} attempted</span>}
            </div>
            {analysis.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No practice logged yet" message="Log a practice set below — your accuracy per subject will build up here." />
            ) : (
              <div className="st-list">
                {analysis.map((x, i) => (
                  <div key={i} style={{ background: 'var(--color-bg-input, var(--color-bg))', border: '1px solid var(--color-border)', borderRadius: 11, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="st-li-main">{x.subject}</span>
                      <span style={{ fontWeight: 800, color: accColor(x.accuracy) }}>
                        {x.accuracy != null ? `${x.accuracy}%` : 'N/A'} <span className="st-li-sub" style={{ display: 'inline' }}>· {x.attempted} attempted</span>
                      </span>
                    </div>
                    <div className="st-bar"><div className="st-bar-fill" style={{ width: `${x.accuracy || 0}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="st-card">
            <h3 className="st-section-title" style={{ marginBottom: 16 }}><span className="st-ic"><Plus size={17} strokeWidth={2} /></span> Log a practice set</h3>
            <form onSubmit={logSet} className="st-row">
              <div className="st-field" style={{ flex: 2 }}>
                <span className="st-label">Subject</span>
                <input className="st-input" placeholder="e.g. Network Theory" value={subject} onChange={e => setSubject(e.target.value)} required />
              </div>
              <div className="st-field" style={{ flex: 1 }}>
                <span className="st-label">Attempted</span>
                <input className="st-input" type="number" min="1" placeholder="20" value={attempted} onChange={e => setAttempted(e.target.value)} required />
              </div>
              <div className="st-field" style={{ flex: 1 }}>
                <span className="st-label">Got correct</span>
                <input className="st-input" type="number" min="0" placeholder="14" value={correct} onChange={e => setCorrect(e.target.value)} required />
              </div>
              <button type="submit" className="st-btn" disabled={loading || overflow}><Plus size={16} strokeWidth={2.2} /> Log set</button>
            </form>
            {liveAcc != null && <div className="st-li-sub" style={{ marginTop: 10 }}>That's <strong style={{ color: accColor(liveAcc) }}>{liveAcc}% accuracy</strong> for this set.</div>}
            {overflow && <div className="st-li-sub" style={{ marginTop: 10, color: 'var(--color-danger)' }}>Correct can't exceed attempted.</div>}
          </div>

          <div className="st-card">
            <h3 className="st-section-title" style={{ marginBottom: 16 }}><span className="st-ic"><History size={17} strokeWidth={2} /></span> Recent sets</h3>
            {recent.length === 0 ? (
              <p className="st-empty">No practice sets logged yet.</p>
            ) : (
              <div className="st-list">
                {recent.map((s, i) => {
                  const acc = s.attempted ? Math.round((s.correct / s.attempted) * 100) : null;
                  return (
                    <div key={i} className="st-li">
                      <div>
                        <div className="st-li-main">{s.subject}</div>
                        <div className="st-li-sub">{new Date(s.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <span className={`st-pill ${accClass(acc)}`}>{s.correct}/{s.attempted} · {acc}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PYQTracker;
