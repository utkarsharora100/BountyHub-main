// ─── Home Page ───────────────────────────────────────────────
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import BountyCard from '../components/BountyCard';
import { BountyCardSkeleton } from '../components/Skeletons';
import { TrendingUp, Clock, ArrowRight, Zap, Globe, Shield } from 'lucide-react';

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [trendingData, recentData] = await Promise.all([
          api.get('/bounties/trending'),
          api.get('/bounties?limit=6&sortBy=newest'),
        ]);
        setTrending(trendingData);
        setRecent(recentData);
      } catch {
        // silent fail for homepage
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-12">
      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="text-center py-12 space-y-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
          Collaborate Across Universities
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Post tasks, bid on bounties, earn reputation. A scalable platform connecting students
          from <strong>multiple universities</strong> to solve problems together.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/bounties" className="btn-primary px-6 py-3 text-base">
            Browse Bounties <ArrowRight className="w-4 h-4 ml-1 inline" />
          </Link>
          <Link href="/register" className="btn-secondary px-6 py-3 text-base">
            Get Started
          </Link>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Zap, title: 'Fast & Scalable', desc: 'Master-Replica DB architecture with Redis caching for blazing reads.' },
          { icon: Globe, title: 'Cross-University', desc: 'Students from any university can collaborate on tasks worldwide.' },
          { icon: Shield, title: 'Reputation System', desc: 'Earn points by completing bounties. Build your academic portfolio.' },
        ].map((f) => (
          <div key={f.title} className="card p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center">
              <f.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── Trending Bounties ─────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary-500" /> Trending Bounties
          </h2>
          <Link href="/bounties?sortBy=reward" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? [...Array(3)].map((_, i) => <BountyCardSkeleton key={i} />)
            : trending.slice(0, 6).map((b) => <BountyCard key={b.id} bounty={b} />)
          }
        </div>
      </section>

      {/* ── Recent Bounties ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-gray-500" /> Recent Tasks
          </h2>
          <Link href="/bounties" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? [...Array(3)].map((_, i) => <BountyCardSkeleton key={i} />)
            : recent?.data?.slice(0, 6).map((b) => <BountyCard key={b.id} bounty={b} />)
          }
        </div>
      </section>
    </div>
  );
}
