import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Play, Square, Volume2, Waves, Timer } from 'lucide-react';
import './study-tools.css';

const SOUNDS = [
  { id: 'pink', label: 'Pink', desc: 'Soft & balanced — easiest on the ears' },
  { id: 'brown', label: 'Brown', desc: 'Deep & rumbly, like distant rain' },
  { id: 'white', label: 'White', desc: 'Bright hiss — masks sudden noises' },
];
const PRESETS = [
  { id: 0, label: 'Free' },
  { id: 15, label: '15 min' },
  { id: 25, label: '25 min' },
  { id: 45, label: '45 min' },
];

// Build a few seconds of looping noise. Pink/brown are filtered so they're far
// gentler than raw white noise (which is the harsh hiss the old version used).
function buildBuffer(ctx, type) {
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.22;
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.2;
    }
  } else { // pink — Paul Kellet filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * 0.85;
      b6 = w * 0.115926;
    }
  }
  return buffer;
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Focus() {
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);
  const startRef = useRef(null);
  const targetRef = useRef(0); // target seconds (0 = free)
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [seconds, setSeconds] = useState(0);
  const [todayMins, setTodayMins] = useState(0);
  const [sound, setSound] = useState('pink');
  const [preset, setPreset] = useState(0);

  useEffect(() => {
    api.get('/api/focus/today').then(r => setTodayMins(r.data.totalMinutes || 0)).catch(() => {});
    return () => { stopAudio(); if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAudio = (type) => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buildBuffer(ctx, type);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.loop = true;
    src.connect(gain); gain.connect(ctx.destination); src.start();
    sourceRef.current = { src, gain };
  };

  const stopAudio = () => {
    try { if (sourceRef.current) { sourceRef.current.src.stop(); sourceRef.current = null; } } catch (e) {}
  };

  const start = () => {
    startAudio(sound);
    startRef.current = Date.now();
    targetRef.current = preset * 60;
    setSeconds(0);
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        const next = s + 1;
        if (targetRef.current > 0 && next >= targetRef.current) { setTimeout(stop, 0); }
        return next;
      });
    }, 1000);
    setPlaying(true);
  };

  const stop = () => {
    stopAudio();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const elapsedMs = startRef.current ? Date.now() - startRef.current : 0;
    const mins = Math.max(0, Math.round(elapsedMs / 60000));
    startRef.current = null;
    if (mins >= 1) {
      api.post('/api/focus/log', { subject: 'Focus', minutes: mins, notes: '' })
        .then(() => { setTodayMins(m => m + mins); try { toast.success(`Logged ${mins} min toward today's study hours`); } catch (e) {} })
        .catch(() => { try { toast.success(`Focus session complete! ${mins} min`); } catch (e) {} });
    } else {
      try { toast('Session ended'); } catch (e) {}
    }
    setPlaying(false);
    setSeconds(0);
  };

  const changeSound = (id) => {
    setSound(id);
    if (playing) { stopAudio(); startAudio(id); } // swap sound without ending the session
  };

  const onVolume = (v) => {
    setVolume(v);
    try { if (sourceRef.current) sourceRef.current.gain.gain.value = v; } catch (e) {}
  };

  const remaining = targetRef.current > 0 ? Math.max(0, targetRef.current - seconds) : null;
  const display = playing ? (remaining != null ? remaining : seconds) : 0;

  return (
    <div className="st-page">
      <h2>Focus Timer</h2>
      <p className="st-sub">Play gentle background noise to stay in the zone. Time spent here is logged toward today's study hours. Pink noise (the default) is the softest — white noise is the bright hiss most people find harsh.</p>

      <div className="st-card fc-focus">
        <div className="fc-clock">
          <div className="fc-time">{fmt(display)}</div>
          <div className="fc-status">{playing ? (remaining != null ? 'Time remaining' : 'Session active') : 'Ready'}</div>
        </div>

        <div className="fc-controls">
          <button className={`fc-play ${playing ? 'stop' : ''}`} onClick={() => (playing ? stop() : start())} aria-pressed={playing}>
            {playing ? <Square size={22} strokeWidth={2.4} fill="currentColor" /> : <Play size={24} strokeWidth={2.4} fill="currentColor" />}
            <span>{playing ? 'Stop' : 'Start'}</span>
          </button>
        </div>

        <div className="fc-group">
          <div className="st-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Waves size={14} strokeWidth={2.2} /> Sound</div>
          <div className="fc-chips">
            {SOUNDS.map(s => (
              <button key={s.id} className={`fc-chip ${sound === s.id ? 'active' : ''}`} onClick={() => changeSound(s.id)} title={s.desc}>{s.label}</button>
            ))}
          </div>
          <div className="st-li-sub" style={{ marginTop: 6 }}>{SOUNDS.find(s => s.id === sound)?.desc}</div>
        </div>

        <div className="fc-group">
          <div className="st-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={14} strokeWidth={2.2} /> Session length</div>
          <div className="fc-chips">
            {PRESETS.map(p => (
              <button key={p.id} className={`fc-chip ${preset === p.id ? 'active' : ''}`} onClick={() => setPreset(p.id)} disabled={playing}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="fc-group">
          <div className="st-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Volume2 size={14} strokeWidth={2.2} /> Volume — {Math.round(volume * 100)}%</div>
          <input className="fc-vol" type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => onVolume(Number(e.target.value))} />
        </div>

        <div className="fc-today">Today's focused time: <strong>{Math.floor(todayMins / 60)}h {todayMins % 60}m</strong></div>
      </div>

      <style>{`
        .fc-focus { max-width: 560px; }
        .fc-clock { text-align:center; margin-bottom:18px; }
        .fc-time { font-size:3.4rem; font-weight:900; letter-spacing:.02em; color:var(--color-text-primary); font-variant-numeric:tabular-nums; line-height:1; }
        .fc-status { font-size:.8rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--color-text-muted); margin-top:6px; }
        .fc-controls { display:flex; justify-content:center; margin-bottom:22px; }
        .fc-play { display:inline-flex; align-items:center; gap:10px; padding:14px 30px; border:none; border-radius:14px; font-family:inherit; font-weight:800; font-size:1.05rem; cursor:pointer; background:var(--color-primary); color:#fff; box-shadow:0 6px 18px rgba(108,99,255,.32); transition:transform .15s, background .15s; }
        .fc-play:hover { transform:translateY(-2px); background:var(--color-primary-dark); }
        .fc-play.stop { background:var(--color-danger); box-shadow:0 6px 18px rgba(239,68,68,.3); }
        .fc-play.stop:hover { background:#dc2626; }
        .fc-group { margin-top:16px; }
        .fc-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
        .fc-chip { padding:8px 16px; border-radius:999px; border:1px solid var(--color-border); background:var(--color-bg-input, var(--color-bg)); color:var(--color-text-secondary); font-family:inherit; font-weight:700; font-size:.85rem; cursor:pointer; transition:all .15s; }
        .fc-chip:hover:not(:disabled) { border-color:var(--color-primary); color:var(--color-primary); }
        .fc-chip.active { background:var(--color-primary); border-color:var(--color-primary); color:#fff; }
        .fc-chip:disabled { opacity:.5; cursor:not-allowed; }
        .fc-vol { width:100%; margin-top:10px; accent-color:var(--color-primary); }
        .fc-today { margin-top:22px; padding-top:16px; border-top:1px solid var(--color-border); text-align:center; color:var(--color-text-secondary); font-size:.9rem; }
        .fc-today strong { color:var(--color-primary); font-weight:800; }
      `}</style>
    </div>
  );
}
