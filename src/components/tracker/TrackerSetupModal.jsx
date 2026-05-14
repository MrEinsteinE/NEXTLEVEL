import React, { useState } from 'react';

export default function TrackerSetupModal({ open = false, onSetup = () => {}, onClose = () => {} }) {
  const [dailyTarget, setDailyTarget] = useState(6);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth()+3); return d.toISOString().slice(0,10);
  });

  const submit = (e) => {
    e.preventDefault();
    const settings = { dailyTarget: Number(dailyTarget), endDate };
    try { localStorage.setItem('trackerSettings', JSON.stringify(settings)); } catch (err) {}
    onSetup(settings);
    onClose();
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', left:0, top:0, right:0, bottom:0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
      <form onSubmit={submit} style={{ background: 'var(--color-bg-card)', padding: 20, borderRadius: 12, width: 520, boxShadow: 'var(--shadow-lg)' }}>
        <h3>Get started — Tracker setup</h3>
        <p>Set your daily study target and the tracker end date to enable auto calculations.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <label style={{ flex: 1 }}>
            Daily target (hours)
            <input className="input" type="number" min={1} value={dailyTarget} onChange={(e)=>setDailyTarget(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            End date
            <input className="input" type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Start Tracker</button>
        </div>
      </form>
    </div>
  );
}
