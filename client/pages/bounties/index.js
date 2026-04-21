import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import BountyCard from '../../components/BountyCard';
import Pagination from '../../components/Pagination';
import { Filter, SortDesc, PlusCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function BountiesPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetched from /bounties/meta so they stay in sync with the DB enums.
  // No more hardcoded arrays that drift from the schema.
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sortOptions, setSortOptions] = useState([]);

  const [filters, setFilters] = useState({
    category: 'ALL',
    status: 'ALL',
    sortBy: 'newest',
    page: 1,
  });

  // Load filter options once on mount
  useEffect(() => {
    api.get('/bounties/meta').then((meta) => {
      setCategories([{ id: 'ALL', name: 'All Categories' }, ...meta.categories]);
      setStatuses(['ALL', ...meta.statuses]);
      setSortOptions(meta.sortOptions);
    }).catch(() => {
      // Fallback to empty — filters just won't render, page still works
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', filters.page);
        params.set('limit', '15');
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
    <div className="max-w-4xl mx-auto space-y-0">

      <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold">Bounties</h1>
          {data?.pagination?.total != null && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {data.pagination.total} tasks
            </p>
          )}
        </div>
        {user && (
          <Link href="/bounties/new" className="btn-primary text-sm gap-1">
            <PlusCircle className="w-4 h-4" />
            Post Bounty
          </Link>
        )}
      </div>

      {/* Filter bar — only renders once meta has loaded */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-800 text-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
              className="input w-auto text-sm py-1.5"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="input w-auto text-sm py-1.5"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <SortDesc className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value, page: 1 })}
              className="input w-auto text-sm py-1.5"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="skeleton w-16 h-16 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.data?.length > 0 ? (
          data.data.map((b) => <BountyCard key={b.id} bounty={b} />)
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p className="font-medium">No bounties found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {data?.pagination && (
        <div className="pt-4">
          <Pagination pagination={data.pagination} onPageChange={(p) => setFilters({ ...filters, page: p })} />
        </div>
      )}

    </div>
  );
}
