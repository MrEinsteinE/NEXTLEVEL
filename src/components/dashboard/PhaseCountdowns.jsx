import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

const targets = [
  { id: 'syllabus', title: 'Syllabus Completion', date: '2026-11-30T23:59:59Z', type: 'ring' },
  { id: 'revision', title: 'Revision Phase Starts', date: '2026-12-01T00:00:00Z', type: 'glow' },
  { id: 'mocks', title: 'Mock Tests Start', date: '2027-01-16T00:00:00Z', type: 'trophy' }
];

function remaining(to) {
  const now = new Date();
  const diff = Math.max(0, new Date(to).getTime() - now.getTime());
  const days = Math.floor(diff / (24*3600*1000));
  const hours = Math.floor((diff % (24*3600*1000)) / (3600*1000));
  const minutes = Math.floor((diff % (3600*1000)) / (60*1000));
  return { days, hours, minutes, totalMs: diff };
}

export default function PhaseCountdowns() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60*1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      {targets.map(t => {
        const rem = remaining(t.date);
        const status = rem.days > 30 ? 'On track' : rem.days > 7 ? 'Behind' : 'Critical';
        return (
          <div key={t.id} className="card card-hover" style={{ flex: 1, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 84, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {t.type === 'ring' ? (
                <svg width="72" height="72" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#eee" strokeWidth="3" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke="url(#g)" strokeWidth="3" strokeDasharray={`${Math.max(0, Math.round(100 - rem.totalMs/ (1000*60*60*24) ))},100`} transform="rotate(-90 18 18)" />
                </svg>
              ) : t.type === 'glow' ? (
                <div style={{ width: 64, height: 64, borderRadius: 12, background: 'linear-gradient(90deg,#60a5fa,#4f46e5)', boxShadow: '0 8px 28px rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>R</div>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 12, background: 'linear-gradient(90deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}><Trophy size={28} strokeWidth={2} /></div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{t.title}</strong>
                <span style={{ color: status === 'Critical' ? '#ef4444' : status === 'Behind' ? '#f59e0b' : '#10b981', fontWeight: 700 }}>{status}</span>
              </div>
              <div style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>{rem.days}d {rem.hours}h {rem.minutes}m</div>
              <div style={{ marginTop: 8 }}>{t.type === 'glow' && rem.days <= 1 ? <em>Revision begins tomorrow!</em> : t.type === 'trophy' ? <em>Mocks start in {rem.days} days – prepare!</em> : null}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
