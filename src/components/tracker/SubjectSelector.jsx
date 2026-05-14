import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const DEFAULT_SUBJECTS = [
  { subject: 'Networks', color: '#60a5fa' },
  { subject: 'Signals', color: '#fb7185' },
  { subject: 'Control', color: '#34d399' },
  { subject: 'Analog', color: '#f59e0b' }
];

export default function SubjectSelector({ value, onChange }) {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/api/tracker/subjects');
        if (!mounted) return;
        if (Array.isArray(res.data) && res.data.length) setSubjects(res.data.map(s => ({ subject: s.subject, color: s.color || '#a78bfa' })));
        else setSubjects(DEFAULT_SUBJECTS);
      } catch (err) {
        setSubjects(DEFAULT_SUBJECTS);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <select className="input" value={value || ''} onChange={(e) => onChange && onChange(e.target.value)}>
      <option value="">— Select subject —</option>
      {subjects.map((s, i) => (
        <option key={i} value={s.subject}>{s.subject}</option>
      ))}
    </select>
  );
}
