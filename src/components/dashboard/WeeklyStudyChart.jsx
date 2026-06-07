import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket.js';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function WeeklyStudyChart() {
  const [reports, setReports] = useState([]);
  const socket = useSocket();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchReports = async () => {
    if (!user._id) return;
    try {
      // Get last 7 days roughly by getting the last 30 reports
      const res = await axios.get(`/api/student/study-reports/${user._id}`);
      setReports(res.data.reports || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user._id]);

  useEffect(() => {
    if (!socket) return;
    socket.on('progress-updated', fetchReports);
    return () => socket.off('progress-updated', fetchReports);
  }, [socket]);
  // We want the last 7 days including today.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
  }

  // Aggregate hours by day
  const hoursData = Array(7).fill(0);
  
  if (reports && reports.length > 0) {
    reports.forEach(r => {
      const rDate = new Date(r.date);
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (6 - i));
        // If same date
        if (rDate.getUTCFullYear() === d.getUTCFullYear() &&
            rDate.getUTCMonth() === d.getUTCMonth() &&
            rDate.getUTCDate() === d.getUTCDate()) {
          hoursData[i] += parseFloat(r.studyHours || 0);
        }
      }
    });
  }

  const data = {
    labels: days,
    datasets: [
      {
        label: 'Study Hours',
        data: hoursData,
        borderColor: '#F97316',
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#E2E8F0'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="weekly-chart-container" style={{ width: '100%', height: '240px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', marginBottom: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={18} strokeWidth={2} /> Last 7 Days Overview
      </h3>
      <div style={{ height: '200px' }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

export default WeeklyStudyChart;
