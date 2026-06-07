import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { WidgetSkeleton } from '../common/Loaders.jsx';
import TrackerRowEditor from './TrackerRowEditor';
import ActivityBadge from './ActivityBadge';
import EfficiencyBadge from './EfficiencyBadge';

export default function TrackerTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    api.get('/api/tracker/logs').then(res => {
      setLogs(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) return <WidgetSkeleton />;

  return (
    <div className="tracker-tab">
      <table className="tracker-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>Subject-1</th><th>Activity</th><th>Target Hrs</th><th>Actual</th><th>Efficiency%</th>
            <th>Subject-2</th><th>Activity</th><th>Target Hrs</th><th>Actual</th><th>Efficiency%</th>
            <th>Subject-3</th><th>Activity</th><th>Target Hrs</th><th>Actual</th><th>Efficiency%</th>
            <th>Total Efficiency</th><th>Mentor Remarks</th><th>Student Answers</th><th></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => (
            <TrackerRowEditor key={log._id || idx} log={log} idx={idx} onSave={fetchLogs} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
