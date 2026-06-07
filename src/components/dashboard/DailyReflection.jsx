import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Sun, Moon, Save } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
const authHeader = () => ({})
const MOODS = ['Motivated', 'Focused', 'Calm', 'Tired', 'Stressed']
const todayISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
const dayKey = (d) => new Date(d).toISOString().split('T')[0]

export default function DailyReflection() {
  const [form, setForm] = useState({ morningMood: '', morningGoal: '', estimatedHours: '', eveningActualHours: '', metGoal: null, learning: '', difficultyLevel: 0 })
  const [past, setPast] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchReflections = async () => {
    try {
      const res = await axios.get(`${API}/api/reflections/me`, authHeader())
      const list = res.data.reflections || []
      const today = dayKey(new Date())
      const t = list.find(r => dayKey(r.date) === today)
      if (t) setForm({
        morningMood: t.morningMood || '', morningGoal: t.morningGoal || '',
        estimatedHours: t.estimatedHours ?? '', eveningActualHours: t.eveningActualHours ?? '',
        metGoal: typeof t.metGoal === 'boolean' ? t.metGoal : null,
        learning: t.learning || '', difficultyLevel: t.difficultyLevel || 0,
      })
      setPast(list.filter(r => dayKey(r.date) !== today).slice(0, 10))
    } catch (e) { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { fetchReflections() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await axios.post(`${API}/api/reflections`, {
        date: todayISO(),
        morningMood: form.morningMood || undefined,
        morningGoal: form.morningGoal || undefined,
        estimatedHours: form.estimatedHours === '' ? undefined : Number(form.estimatedHours),
        eveningActualHours: form.eveningActualHours === '' ? undefined : Number(form.eveningActualHours),
        metGoal: form.metGoal,
        learning: form.learning || undefined,
        difficultyLevel: form.difficultyLevel || undefined,
      }, authHeader())
      toast.success('Reflection saved ✓')
      fetchReflections()
    } catch (e) { toast.error('Failed to save reflection') } finally { setSaving(false) }
  }

  return (
    <div className="reflect-board">
      <div className="reflect-grid">
        <div className="reflect-card">
          <h3><Sun size={18} strokeWidth={2} /> Morning Intention</h3>
          <label>How are you feeling?</label>
          <div className="reflect-chips">
            {MOODS.map(m => (
              <button key={m} type="button" className={`reflect-chip ${form.morningMood === m ? 'active' : ''}`} onClick={() => set('morningMood', m)}>{m}</button>
            ))}
          </div>
          <label>Today's #1 goal</label>
          <input value={form.morningGoal} maxLength={100} onChange={e => set('morningGoal', e.target.value)} placeholder="e.g. Finish Network Theory revision" />
          <label>Planned study hours</label>
          <input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} placeholder="e.g. 6" />
        </div>

        <div className="reflect-card">
          <h3><Moon size={18} strokeWidth={2} /> Evening Review</h3>
          <label>Actual hours studied</label>
          <input type="number" min="0" step="0.5" value={form.eveningActualHours} onChange={e => set('eveningActualHours', e.target.value)} placeholder="e.g. 5.5" />
          <label>Did you meet today's goal?</label>
          <div className="reflect-chips">
            <button type="button" className={`reflect-chip ${form.metGoal === true ? 'active' : ''}`} onClick={() => set('metGoal', true)}>Yes</button>
            <button type="button" className={`reflect-chip ${form.metGoal === false ? 'active' : ''}`} onClick={() => set('metGoal', false)}>No</button>
          </div>
          <label>How hard was today? (1 easy → 5 brutal)</label>
          <div className="reflect-chips">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" className={`reflect-chip ${form.difficultyLevel === n ? 'active' : ''}`} onClick={() => set('difficultyLevel', n)}>{n}</button>
            ))}
          </div>
          <label>One thing you learned</label>
          <textarea rows={3} maxLength={500} value={form.learning} onChange={e => set('learning', e.target.value)} placeholder="A concept, mistake, or insight from today…" />
        </div>
      </div>

      <button className="reflect-save" onClick={save} disabled={saving}><Save size={15} strokeWidth={2} /> {saving ? 'Saving…' : "Save today's reflection"}</button>

      <h3 className="reflect-past-title">Past reflections</h3>
      {loading ? (
        <p className="reflect-muted">Loading…</p>
      ) : past.length === 0 ? (
        <p className="reflect-muted">No past reflections yet — your daily entries will build a journal here.</p>
      ) : (
        <div className="reflect-past">
          {past.map(r => (
            <div key={r._id} className="reflect-past-item">
              <div className="reflect-past-date">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              <div className="reflect-past-body">
                {r.morningGoal && <div><strong>Goal:</strong> {r.morningGoal}{typeof r.metGoal === 'boolean' && <span className={`reflect-met ${r.metGoal ? 'yes' : 'no'}`}>{r.metGoal ? 'met' : 'missed'}</span>}</div>}
                {(r.estimatedHours != null || r.eveningActualHours != null) && <div className="reflect-past-meta">Planned {r.estimatedHours ?? '—'}h · Actual {r.eveningActualHours ?? '—'}h{r.difficultyLevel ? ` · Difficulty ${r.difficultyLevel}/5` : ''}</div>}
                {r.learning && <div className="reflect-past-learn">“{r.learning}”</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .reflect-board { max-width: 860px; }
        .reflect-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .reflect-card { background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:16px; padding:20px 22px; }
        .reflect-card h3 { display:inline-flex; align-items:center; gap:8px; font-size:1.02rem; font-weight:800; color:var(--color-text-primary); margin:0 0 4px; }
        .reflect-card label { display:block; font-size:.74rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-secondary); margin:14px 0 6px; }
        .reflect-card input, .reflect-card textarea { width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text-primary); font-family:inherit; font-size:.9rem; outline:none; resize:vertical; transition:border-color .15s, box-shadow .15s; }
        .reflect-card input:focus, .reflect-card textarea:focus { border-color:var(--color-primary); box-shadow:0 0 0 4px var(--color-primary-light); }
        .reflect-chips { display:flex; flex-wrap:wrap; gap:8px; }
        .reflect-chip { padding:7px 14px; border:1px solid var(--color-border); border-radius:999px; background:transparent; color:var(--color-text-secondary); font-weight:700; font-size:.82rem; cursor:pointer; transition:background .15s, color .15s, border-color .15s; }
        .reflect-chip.active { background:var(--gradient-primary); color:#fff; border-color:transparent; }
        .reflect-save { margin-top:16px; display:inline-flex; align-items:center; gap:7px; padding:11px 20px; border:none; border-radius:10px; background:var(--gradient-primary); color:#fff; font-weight:800; font-size:.92rem; cursor:pointer; transition:transform .15s; }
        .reflect-save:hover:not(:disabled) { transform:translateY(-1px); }
        .reflect-save:disabled { opacity:.6; cursor:not-allowed; }
        .reflect-past-title { font-size:1rem; font-weight:800; color:var(--color-text-primary); margin:26px 0 12px; }
        .reflect-muted { color:var(--color-text-muted); }
        .reflect-past { display:flex; flex-direction:column; gap:10px; }
        .reflect-past-item { display:flex; gap:14px; background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:12px; padding:12px 14px; }
        .reflect-past-date { font-weight:800; font-size:.8rem; color:var(--color-primary); min-width:84px; }
        .reflect-past-body { flex:1; font-size:.88rem; color:var(--color-text-primary); display:flex; flex-direction:column; gap:4px; }
        .reflect-met { font-size:.66rem; font-weight:800; text-transform:uppercase; padding:1px 7px; border-radius:999px; margin-left:8px; }
        .reflect-met.yes { background:#dcfce7; color:#16a34a; }
        .reflect-met.no { background:#fee2e2; color:#dc2626; }
        .reflect-past-meta { font-size:.8rem; color:var(--color-text-muted); }
        .reflect-past-learn { font-style:italic; color:var(--color-text-secondary); }
        @media (max-width:640px){ .reflect-grid { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
