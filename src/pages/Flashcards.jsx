import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { WidgetSkeleton, EmptyState } from '../components/common/Loaders.jsx';
import { BookMarked, RotateCcw, Plus, Layers, Trash2 } from 'lucide-react';
import './study-tools.css';

// Spaced-repetition rating → backend quality score (SM-2 style: <3 = lapse).
const RATINGS = [
  { label: 'Again', q: 1, cls: 'bad' },
  { label: 'Hard', q: 3, cls: 'warn' },
  { label: 'Good', q: 4, cls: 'ok' },
  { label: 'Easy', q: 5, cls: 'ok' },
];

const Flashcards = () => {
  const { user } = useAuth();
  const [due, setDue] = useState([]);
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [subject, setSubject] = useState('');
  const [flippedCustom, setFlippedCustom] = useState({});

  useEffect(() => {
    if (user) loadCards();
    // eslint-disable-next-line
  }, [user]);

  const loadCards = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/flashcards/due');
      if (res.data?.success) {
        setDue(res.data.due || []);
        setCustom(res.data.custom || []);
        setIndex(0);
        setFlipped(false);
      }
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  const review = async (card, q) => {
    try {
      const cardId = card.cardId || card._id || card.id || String(index);
      await api.post('/api/flashcards/review', { cardId, rating: q });
      setFlipped(false);
      // Move to next due card locally; reload when we run out.
      if (index + 1 < due.length) setIndex(index + 1);
      else loadCards();
    } catch (err) { /* ignore */ }
  };

  const addCustom = async (e) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    try {
      setLoading(true);
      await api.post('/api/flashcards/custom', { front, back, subject });
      setFront(''); setBack(''); setSubject('');
      await loadCards();
    } catch (err) { /* ignore */ } finally { setLoading(false); }
  };

  const deleteCustom = async (id) => {
    if (!id) return;
    try {
      await api.delete(`/api/flashcards/custom/${id}`);
      await loadCards();
    } catch (err) { /* ignore */ }
  };

  const card = due[index];

  return (
    <div className="st-page">
      <h2>Flashcards</h2>
      <p className="st-sub">Review cards on a spaced-repetition schedule — rate how well you knew each one and they'll resurface at the right time.</p>

      {loading && <WidgetSkeleton />}

      {!loading && (
        <>
          <div className="st-card">
            <div className="st-card-head">
              <h3 className="st-section-title"><span className="st-ic"><Layers size={17} strokeWidth={2} /></span> Due for review</h3>
              {due.length > 0 && <span className="st-pill">{index + 1} / {due.length}</span>}
            </div>

            {due.length === 0 ? (
              <EmptyState icon={BookMarked} title="All caught up!" message="No cards are due right now. Add your own below, or check back later as scheduled cards come due." />
            ) : (
              <>
                <button className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)} aria-label="Flip card">
                  <div className="fc-inner">
                    <div className="fc-face fc-front">
                      <span className="fc-tag">Question</span>
                      <div className="fc-text">{card.front}</div>
                      <span className="fc-hint">Tap to reveal answer</span>
                    </div>
                    <div className="fc-face fc-back">
                      <span className="fc-tag">Answer</span>
                      <div className="fc-text">{card.back}</div>
                      <span className="fc-hint">Tap to see question</span>
                    </div>
                  </div>
                </button>

                <div className="fc-ratings">
                  {RATINGS.map(r => (
                    <button key={r.label} className={`st-btn fc-rate ${r.cls}`} onClick={() => review(card, r.q)} disabled={!flipped} title={flipped ? '' : 'Reveal the answer first'}>
                      {r.label}
                    </button>
                  ))}
                </div>
                {!flipped && <div className="st-li-sub" style={{ marginTop: 10, textAlign: 'center' }}>Reveal the answer, then rate how well you knew it.</div>}
              </>
            )}
          </div>

          <div className="st-card">
            <div className="st-card-head">
              <h3 className="st-section-title"><span className="st-ic"><Plus size={17} strokeWidth={2} /></span> Add your own card</h3>
              <button type="button" className="st-btn st-btn-ghost" onClick={loadCards}><RotateCcw size={15} strokeWidth={2} /> Refresh</button>
            </div>
            <form onSubmit={addCustom} className="st-grid" style={{ gap: 12 }}>
              <div className="st-field">
                <span className="st-label">Front (question)</span>
                <input className="st-input" placeholder="e.g. What is the time complexity of binary search?" value={front} onChange={(e) => setFront(e.target.value)} required />
              </div>
              <div className="st-field">
                <span className="st-label">Back (answer)</span>
                <input className="st-input" placeholder="e.g. O(log n)" value={back} onChange={(e) => setBack(e.target.value)} required />
              </div>
              <div className="st-row">
                <div className="st-field" style={{ flex: 1 }}>
                  <span className="st-label">Subject (optional)</span>
                  <input className="st-input" placeholder="e.g. Algorithms" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <button type="submit" className="st-btn" disabled={loading}><Plus size={16} strokeWidth={2.2} /> Add card</button>
              </div>
            </form>

            {custom.length > 0 && (
              <div className="cc-list">
                <div className="st-li-sub" style={{ marginBottom: 2 }}>Your cards — tap to flip:</div>
                {custom.map((c, i) => {
                  const key = c._id || i;
                  const open = !!flippedCustom[key];
                  return (
                    <div
                      key={key}
                      className={`cc-card ${open ? 'flipped' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setFlippedCustom(p => ({ ...p, [key]: !p[key] }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlippedCustom(p => ({ ...p, [key]: !p[key] })); } }}
                    >
                      <div className="cc-top">
                        <span className="cc-tag">{open ? 'Answer' : 'Question'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.subject && <span className="st-pill">{c.subject}</span>}
                          {c._id && (
                            <button
                              type="button"
                              className="cc-del"
                              aria-label="Delete card"
                              title="Delete card"
                              onClick={(e) => { e.stopPropagation(); deleteCustom(c._id); }}
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="cc-text">{open ? c.back : c.front}</div>
                      <div className="cc-hint">{open ? 'Tap to see question' : 'Tap to reveal answer'}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        .fc-card { display:block; width:100%; max-width:480px; height:240px; margin:0 auto; border:none; background:none; padding:0; cursor:pointer; perspective:1200px; }
        .fc-inner { position:relative; width:100%; height:100%; transition:transform .5s cubic-bezier(.2,.8,.2,1); transform-style:preserve-3d; }
        .fc-card.flipped .fc-inner { transform:rotateY(180deg); }
        .fc-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:16px; border:1px solid var(--color-border); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:24px; text-align:center; }
        .fc-front { background:var(--color-bg-input, var(--color-bg)); }
        .fc-back { background:linear-gradient(135deg, rgba(108,99,255,0.10), rgba(255,107,53,0.06)); transform:rotateY(180deg); }
        .fc-tag { font-size:.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--color-primary); }
        .fc-text { font-size:1.15rem; font-weight:700; color:var(--color-text-primary); line-height:1.45; }
        .fc-hint { font-size:.72rem; color:var(--color-text-muted); }
        .fc-ratings { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; max-width:480px; margin:18px auto 0; }
        .fc-rate { padding:10px 8px; }
        .fc-rate.bad { background:var(--color-danger); } .fc-rate.bad:hover:not(:disabled){ background:#dc2626; }
        .fc-rate.warn { background:var(--color-warning); } .fc-rate.warn:hover:not(:disabled){ background:#d97706; }
        .fc-rate.ok { background:var(--color-success); } .fc-rate.ok:hover:not(:disabled){ background:#16a34a; }
        .cc-list { display:flex; flex-direction:column; gap:10px; margin-top:18px; }
        .cc-card { display:block; width:100%; text-align:left; cursor:pointer; background:var(--color-bg-input, var(--color-bg)); border:1px solid var(--color-border); border-radius:12px; padding:14px 16px; font-family:inherit; transition:border-color .15s, background .15s; }
        .cc-card:hover { border-color:var(--color-primary); }
        .cc-card.flipped { background:linear-gradient(135deg, rgba(108,99,255,0.12), rgba(255,107,53,0.05)); }
        .cc-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
        .cc-tag { font-size:.66rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--color-primary); }
        .cc-text { font-size:1rem; font-weight:700; color:var(--color-text-primary); line-height:1.45; }
        .cc-hint { font-size:.72rem; color:var(--color-text-muted); margin-top:8px; }
        .cc-del { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:0; border:1px solid var(--color-border); border-radius:7px; background:transparent; color:var(--color-text-muted); cursor:pointer; transition:color .15s, border-color .15s, background .15s; }
        .cc-del:hover { color:#fff; background:var(--color-danger, #e5484d); border-color:var(--color-danger, #e5484d); }
      `}</style>
    </div>
  );
};

export default Flashcards;
