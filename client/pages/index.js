import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import BountyCard from '../components/BountyCard';
import { TrendingUp, Clock, PlusCircle, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// Skeleton for a forum row while data loads
function RowSkeleton() {
  return (
    <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-800 animate-pulse">
      <div className="skeleton w-14 h-14 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [trendingData, recentData] = await Promise.all([
          api.get('/bounties/trending'),
          api.get('/bounties?limit=8&sortBy=newest'),
        ]);
        setTrending(trendingData);
        setRecent(recentData.data || []);
      } catch {
        // Non-critical — the page degrades gracefully if the API is down
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-0">

      {/* Site header — brief, forum-style. No big marketing hero needed. */}
      <div className="py-6 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BountyHub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Post tasks, find collaborators, earn reputation — across universities.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <Link href="/bounties/new" className="btn-primary text-sm gap-1">
              <PlusCircle className="w-4 h-4" />
              Post Bounty
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">Log in</Link>
              <Link href="/register" className="btn-primary text-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>

      {/* ── Trending feed ────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between px-0 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-base flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <TrendingUp className="w-4 h-4 text-primary-500" /> Trending
          </h2>
          <Link href="/bounties?sortBy=reward" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
            see all →
          </Link>
        </div>

        <div className="border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-xl overflow-hidden mb-6">
          {loading
            ? [...Array(4)].map((_, i) => <RowSkeleton key={i} />)
            : trending.slice(0, 5).map((b) => <BountyCard key={b.id} bounty={b} />)
          }
        </div>
      </section>

      {/* ── Recent posts feed ────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-base flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Clock className="w-4 h-4 text-gray-400" /> Recently Posted
          </h2>
          <Link href="/bounties" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
            see all →
          </Link>
        </div>

        <div className="border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-xl overflow-hidden mb-6">
          {loading
            ? [...Array(4)].map((_, i) => <RowSkeleton key={i} />)
            : recent.map((b) => <BountyCard key={b.id} bounty={b} />)
          }
        </div>
      </section>

      {/* Quick links footer — leaderboard and search are the other key pages */}
      <div className="flex items-center gap-4 py-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/leaderboard" className="flex items-center gap-1.5 hover:text-primary-600 transition-colors">
          <Trophy className="w-4 h-4" /> Leaderboard
        </Link>
        <Link href="/search" className="hover:text-primary-600 transition-colors">
          Search bounties
        </Link>
        {!user && (
          <Link href="/register" className="hover:text-primary-600 transition-colors">
            Create account
          </Link>
        )}
      </div>

    </div>
  );
}
