import React from 'react';

export default function Leaderboard() {
  const top = [
    { name: 'Amit', score: 980 },
    { name: 'Priya', score: 940 },
    { name: 'Rahul', score: 900 }
  ];

  return (
    <div>
      <h2>Leaderboard</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900 }}>{top[1].score}</div>
            <div className="card">2<br/>{top[1].name}</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 900 }}>{top[0].score}</div>
            <div className="card">1<br/>{top[0].name}</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{top[2].score}</div>
            <div className="card">3<br/>{top[2].name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
