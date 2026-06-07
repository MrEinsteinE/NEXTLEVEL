
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { WidgetSkeleton } from '../common/Loaders.jsx';

export default function SubjectsTab() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editIdx, setEditIdx] = useState(-1);
  const [editVals, setEditVals] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchSubjects = () => {
    setLoading(true);
    api.get('/api/tracker/subjects').then(res => {
      setSubjects(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleEdit = (idx) => {
    setEditIdx(idx);
    setEditVals({
      videoDone: subjects[idx].videoDone,
      practiceDone: subjects[idx].practiceDone,
      revisionDone: subjects[idx].revisionDone
    });
  };

  const handleChange = (field, value) => {
    setEditVals(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (subject) => {
    setSaving(true);
    await api.put('/api/tracker/subjects', {
      subject: subject.subject,
      videoDone: Number(editVals.videoDone),
      practiceDone: Number(editVals.practiceDone),
      revisionDone: Number(editVals.revisionDone)
    });
    setEditIdx(-1);
    setSaving(false);
    fetchSubjects();
  };

  if (loading) return <WidgetSkeleton />;

  return (
    <div className="subjects-tab">
      <table className="subjects-table">
        <thead>
          <tr>
            <th>Subject</th><th>Video Target</th><th>Practice Target</th><th>Revision Target</th>
            <th>Video Done</th><th>Practice Done</th><th>Revision Done</th><th>Overall%</th><th></th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, idx) => (
            <tr key={s._id || idx}>
              <td>{s.subject}</td>
              <td>{s.videoTarget}</td>
              <td>{s.practiceTarget}</td>
              <td>{s.revisionTarget}</td>
              <td>{editIdx === idx ? <input type="number" value={editVals.videoDone} onChange={e => handleChange('videoDone', e.target.value)} /> : s.videoDone}</td>
              <td>{editIdx === idx ? <input type="number" value={editVals.practiceDone} onChange={e => handleChange('practiceDone', e.target.value)} /> : s.practiceDone}</td>
              <td>{editIdx === idx ? <input type="number" value={editVals.revisionDone} onChange={e => handleChange('revisionDone', e.target.value)} /> : s.revisionDone}</td>
              <td>{s.overallPercent || 0}%</td>
              <td>
                {editIdx === idx ? (
                  <>
                    <button onClick={() => handleSave(s)} disabled={saving}>Save</button>
                    <button onClick={() => setEditIdx(-1)} disabled={saving}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => handleEdit(idx)}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
