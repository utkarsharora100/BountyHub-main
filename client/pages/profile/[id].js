// ─── User Profile Page ───────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../../lib/api';
import { ProfileSkeleton } from '../../components/Skeletons';
import { Award, Clock, GraduationCap, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState(null);
  const [repHistory, setRepHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/users/${id}`),
      api.get(`/users/${id}/reputation?limit=20`),
    ])
      .then(([p, r]) => {
        setProfile(p);
        setRepHistory(r.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ProfileSkeleton />;
  if (!profile) return <div className="text-center py-20 text-gray-500">User not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* ── Profile Card ──────────────────────────────────── */}
      <div className="card p-8">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-3xl font-bold text-white shrink-0">
            {profile.name[0]}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{profile.email}</p>
            {profile.university && (
              <p className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <GraduationCap className="w-4 h-4" />
                {profile.university.name}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              <Award className="w-6 h-6" />
              {profile.reputation}
            </div>
            <p className="text-xs text-gray-500 mt-1">Reputation Points</p>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary-600 dark:text-primary-400">
              <Star className="w-6 h-6" />
              {repHistory.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Activities</p>
          </div>
        </div>
      </div>

      {/* ── Reputation History ────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" /> Reputation History
        </h2>

        {repHistory.length === 0 ? (
          <p className="text-sm text-gray-500">No reputation history yet</p>
        ) : (
          <div className="space-y-3">
            {repHistory.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${r.points >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                  {r.points >= 0 ? <ArrowUp className="w-4 h-4 text-green-600" /> : <ArrowDown className="w-4 h-4 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.reason}</p>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</p>
                </div>
                <span className={`font-bold text-sm ${r.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {r.points >= 0 ? '+' : ''}{r.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
