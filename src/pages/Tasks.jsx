import DailyTaskChecklist from '../components/dashboard/DailyTaskChecklist.jsx';

// Standalone tasks page — reuses the dynamic daily-task checklist (live data
// from /api/student/daily-tasks) instead of the old placeholder list.
export default function TasksPage() {
  return (
    <div>
      <h2>Today's Tasks</h2>
      <DailyTaskChecklist fullView />
    </div>
  );
}
