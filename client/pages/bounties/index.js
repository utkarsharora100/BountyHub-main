// ─── Bounties Listing Page ───────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../../lib/api';
import BountyCard from '../../components/BountyCard';
import { BountyCardSkeleton } from '../../components/Skeletons';
import Pagination from '../../components/Pagination';
import { Filter, SortDesc } from 'lucide-react';

const CATEGORIES = ['ALL', 'CODING', 'RESEARCH', 'DESIGN', 'DEBUGGING', 'DOCUMENTATION', 'OTHER'];
const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'reward', label: 'Highest Reward' },
  { value: 'deadline', label: 'Deadline' },
];

export default function BountiesPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'ALL',
    status: 'ALL',
    sortBy: 'newest',
    page: 1,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', filters.page);
        params.set('limit', '9');
        params.set('sortBy', filters.sortBy);
        if (filters.category !== 'ALL') params.set('category', filters.category);
        if (filters.status !== 'ALL') params.set('status', filters.status);

        const result = await api.get(`/bounties?${params}`);
        setData(result);
      } catch {
        setData({ data: [], pagination: {} });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bounties</h1>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
              className="input w-auto text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="input w-auto text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <SortDesc className="w-4 h-4 text-gray-400" />
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value, page: 1 })}
              className="input w-auto text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? [...Array(6)].map((_, i) => <BountyCardSkeleton key={i} />)
          : data?.data?.map((b) => <BountyCard key={b.id} bounty={b} />)
        }
      </div>

      {!loading && data?.data?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No bounties found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {data?.pagination && (
        <Pagination pagination={data.pagination} onPageChange={(p) => setFilters({ ...filters, page: p })} />
      )}
    </div>
  );
}
