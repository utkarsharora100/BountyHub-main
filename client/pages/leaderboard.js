// ─── Leaderboard Page ────────────────────────────────────────
import { useEffect, useState } from 'react';
import api from '../lib/api';
import Link from 'next/link';
import { LeaderboardSkeleton } from '../components/Skeletons';
import { Trophy, Medal, Award } from 'lucide-react';

const rankIcons = {
  0: <Trophy className="w-6 h-6 text-yellow-500" />,
  1: <Medal className="w-6 h-6 text-gray-400" />,
  2: <Medal className="w-6 h-6 text-amber-700" />,
};

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/leaderboard?limit=30')
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8 text-yellow-500" /> Leaderboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Top contributors across all universities</p>
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : (
        <div className="space-y-2">
          {users.map((u, i) => (
            <Link key={u.id} href={`/profile/${u.id}`}>
              <div className={`card p-4 flex items-center gap-4 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer ${i < 3 ? 'border-l-4' : ''} ${i === 0 ? 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10' : i === 1 ? 'border-l-gray-400 bg-gray-50/50 dark:bg-gray-800/30' : i === 2 ? 'border-l-amber-600 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                {/* Rank */}
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  {rankIcons[i] || <span className="text-lg font-bold text-gray-400">#{i + 1}</span>}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-300 shrink-0">
                  {u.name[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.university?.name} • {u.university?.country}</p>
                </div>

                {/* Reputation */}
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                  <Award className="w-5 h-5" />
                  {u.reputation}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
