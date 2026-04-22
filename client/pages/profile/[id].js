// ─── User Profile Page ───────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '../../lib/api';
import { ProfileSkeleton } from '../../components/Skeletons';
import { Award, Clock, GraduationCap, Star, ArrowUp, ArrowDown, Briefcase, Gavel } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const categoryColors = {
  CODING:    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DESIGN:    'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  RESEARCH:  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  WRITING:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  MATH:      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  OTHER:     'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

const statusColors = {
  OPEN:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPLETED:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const bidStatusColors = {
  PENDING:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState(null);
  const [repHistory, setRepHistory] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/users/${id}`),
      api.get(`/users/${id}/reputation?limit=20`),
      api.get(`/users/${id}/activity?limit=10`),
    ])
      .then(([p, r, a]) => {
        setProfile(p);
        setRepHistory(r.data || []);
        setActivity(a);
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
              {activity ? activity.total : repHistory.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Activities</p>
          </div>
        </div>
      </div>

      {/* ── Created Bounties ──────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary-500" /> Created Bounties
          {activity && <span className="text-sm font-normal text-gray-500">({activity.createdTotal})</span>}
        </h2>

        {!activity || activity.created.length === 0 ? (
          <p className="text-sm text-gray-500">No bounties created yet</p>
        ) : (
          <div className="space-y-3">
            {activity.created.map((b) => (
              <Link key={b.id} href={`/bounties/${b.id}`} className="block">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[b.category] || categoryColors.OTHER}`}>
                        {b.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[b.status] || statusColors.OPEN}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">{b._count.bids} bids</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    {b.rewardPoints} pts
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Bids Placed ───────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Gavel className="w-5 h-5 text-primary-500" /> Bids Placed
          {activity && <span className="text-sm font-normal text-gray-500">({activity.bidsTotal})</span>}
        </h2>

        {!activity || activity.bids.length === 0 ? (
          <p className="text-sm text-gray-500">No bids placed yet</p>
        ) : (
          <div className="space-y-3">
            {activity.bids.map((bid) => (
              <Link key={bid.id} href={`/bounties/${bid.bounty.id}`} className="block">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bid.bounty.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[bid.bounty.category] || categoryColors.OTHER}`}>
                        {bid.bounty.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bidStatusColors[bid.status] || bidStatusColors.PENDING}`}>
                        Bid: {bid.status}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
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
