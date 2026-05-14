import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function ReportCard() {
  const [report, setReport] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/reportcard');
        setReport(res.data);
      } catch (err) { console.error(err); }
    })();
  }, []);

  return (
    <div>
      <h2>Report Card</h2>
      <div className="card">
        {!report && <p>Loading…</p>}
        {report && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(report, null, 2)}</pre>}
      </div>
    </div>
  );
}
