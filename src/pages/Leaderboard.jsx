import Leaderboard from '../components/dashboard/Leaderboard.jsx';

// Standalone leaderboard page — reuses the dynamic dashboard widget (live data
// from /api/leaderboard) instead of the old hardcoded placeholder.
export default function LeaderboardPage() {
  return (
    <div>
      <h2>Leaderboard</h2>
      <Leaderboard fullView />
    </div>
  );
}
