import React, { useState } from 'react';
import ActivityBadge from './ActivityBadge';
import EfficiencyBadge from './EfficiencyBadge';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function TrackerRowEditor({ log, idx, onSave }) {
  const [edit, setEdit] = useState(false);
  const [entries, setEntries] = useState(log.entries.map(e => ({ ...e })));
  const [mentorRemarks, setMentorRemarks] = useState(log.mentorRemarks || '');
  const [studentAnswers, setStudentAnswers] = useState(log.studentAnswers || '');
  const [saving, setSaving] = useState(false);

  const handleChange = (i, field, value) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/api/tracker/logs', {
        date: log.date,
        entries,
        mentorRemarks,
        studentAnswers
      });
      setEdit(false);
      if (onSave) onSave();
      try {
        toast.success("Today's log saved ✓");
        // compute simple efficiency: sum(actual) / sum(target)
        const sumActual = entries.reduce((s,e)=>s+(Number(e.actualHours)||0),0);
        const sumTarget = entries.reduce((s,e)=>s+(Number(e.targetHours)||0),0) || 1;
        const eff = Math.round((sumActual / sumTarget) * 100);
        toast.success(`Today's efficiency: ${eff}%`);
      } catch (e) { /* ignore toast errors */ }
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className={idx % 7 === 6 ? 'weekly-review-row' : ''}>
      <td>{new Date(log.date).toLocaleDateString()}</td>
      {entries.map((entry, i) => (
        <React.Fragment key={i}>
          <td>{edit ? <input value={entry.subject} onChange={e => handleChange(i, 'subject', e.target.value)} /> : entry.subject}</td>
          <td>{edit ? <input value={entry.activity} onChange={e => handleChange(i, 'activity', e.target.value)} /> : <ActivityBadge activity={entry.activity} />}</td>
          <td>{edit ? <input type="number" value={entry.targetHours} onChange={e => handleChange(i, 'targetHours', e.target.value)} /> : entry.targetHours}</td>
          <td>{edit ? <input type="number" value={entry.actualHours} onChange={e => handleChange(i, 'actualHours', e.target.value)} /> : entry.actualHours}</td>
          <td><EfficiencyBadge efficiency={entry.efficiency} /></td>
        </React.Fragment>
      ))}
      {Array.from({ length: 3 - entries.length }).map((_, i) => (
        <React.Fragment key={i}>
          <td></td><td></td><td></td><td></td><td></td>
        </React.Fragment>
      ))}
      <td><EfficiencyBadge efficiency={log.totalEfficiency} /></td>
      <td>{edit ? <input value={mentorRemarks} onChange={e => setMentorRemarks(e.target.value)} /> : log.mentorRemarks}</td>
      <td>{edit ? <input value={studentAnswers} onChange={e => setStudentAnswers(e.target.value)} /> : log.studentAnswers}</td>
      <td>
        {edit ? (
          <>
            <button onClick={handleSave} disabled={saving}>Save</button>
            <button onClick={() => setEdit(false)} disabled={saving}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setEdit(true)}>Edit</button>
        )}
      </td>
    </tr>
  );
}
