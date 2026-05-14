import React, { useState, useEffect } from 'react';
import TrackerTab from '../components/tracker/TrackerTab';
import ReportsTab from '../components/tracker/ReportsTab';
import SubjectsTab from '../components/tracker/SubjectsTab';
import TrackerSetupModal from '../components/tracker/TrackerSetupModal';
import { useSocket } from '../hooks/useSocket';
import './ProgressTrackerPage.css';

const TABS = ['TRACKER', 'REPORTS', 'SUBJECTS'];

export default function ProgressTrackerPage() {
  const [active, setActive] = useState('TRACKER');
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('trackerSettings') || 'null'); } catch (e) { return null; }
  });

  useSocket(); // ensure socket connected and listening for updates

  useEffect(() => {
    // noop
  }, []);

  const onSetup = (s) => {
    setSettings(s);
    try { localStorage.setItem('trackerSettings', JSON.stringify(s)); } catch (e) {}
  };

  return (
    <div className="progress-tracker-page container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="gradient-text">Progress Tracker</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActive(t)} className={`btn ${active === t ? 'btn-primary' : 'btn-ghost'}`}>
              {t}
            </button>
          ))}
        </div>
      </header>

      {!settings && (
        <TrackerSetupModal onClose={() => {}} onSetup={onSetup} open={true} />
      )}

      <main>
        {active === 'TRACKER' && <TrackerTab settings={settings} />}
        {active === 'REPORTS' && <ReportsTab settings={settings} />}
        {active === 'SUBJECTS' && <SubjectsTab settings={settings} />}
      </main>
    </div>
  );
}
