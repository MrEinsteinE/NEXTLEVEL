import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { WidgetSkeleton } from '../common/Loaders.jsx';
import { Bar } from 'react-chartjs-2';

export default function ReportsTab() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Example: fetch this week's and last week's logs
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    api.get('/api/tracker/reports', {
      params: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() }
    }).then(res => {
      setReport(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <WidgetSkeleton />;

  // Example chart data (replace with real data mapping)
  const chartData = {
    labels: ['This Week', 'Last Week'],
    datasets: [
      {
        label: 'Efficiency',
        data: [73.33, 0],
        backgroundColor: 'rgba(54, 162, 235, 0.7)'
      }
    ]
  };

  return (
    <div className="reports-tab">
      <h3>Weekly Performance</h3>
      <Bar data={chartData} />
      {/* Add more report details here */}
    </div>
  );
}
