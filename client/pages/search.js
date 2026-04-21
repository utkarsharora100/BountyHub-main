// ─── Search Page ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import BountyCard from '../components/BountyCard';
import { BountyCardSkeleton } from '../components/Skeletons';
import Pagination from '../components/Pagination';
import { Award, Search as SearchIcon, X } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [page, setPage] = useState(1);
  const inputRef = useRef();
  const debounceRef = useRef();

  // Autocomplete match tiles
  useEffect(() => {
    if (query.length < 2) {
      setMatches([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/search/matches?q=${encodeURIComponent(query)}&limit=6`);
        setMatches(data);
        setShowMatches(true);
      } catch {
        setMatches([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function doSearch(searchQuery, searchPage = 1) {
    if (!searchQuery || searchQuery.length < 2) return;
    setLoading(true);
    setShowMatches(false);
    try {
      const data = await api.get(`/bounties/search?q=${encodeURIComponent(searchQuery)}&page=${searchPage}&limit=9`);
      setResults(data);
    } catch {
      setResults({ data: [], pagination: {} });
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    doSearch(query, 1);
  };

  const handleMatchClick = (match) => {
    setQuery(match.title);
    setShowMatches(false);
    setPage(1);
    doSearch(match.title, 1);
  };

  const handlePageChange = (p) => {
    setPage(p);
    doSearch(query, p);
    window.scrollTo(0, 0);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-center">Search Bounties</h1>

      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => matches.length > 0 && setShowMatches(true)}
            className="input pl-12 pr-12 py-3 text-lg"
            placeholder="Search for bounties... (e.g., machine learning, API, React)"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults(null); setMatches([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Autocomplete Match Tiles */}
        {showMatches && matches.length > 0 && (
          <div className="absolute z-10 w-full mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => handleMatchClick(match)}
                className="rounded-md border border-gray-100 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-gray-800 dark:hover:border-primary-700 dark:hover:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">{match.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                      {match.category}{match.department ? ` / ${match.department}` : ''}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Award className="w-3.5 h-3.5" />
                    {match.rewardPoints}
                  </span>
                </div>
                {match.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {match.skills.slice(0, 3).map((skill) => (
                      <span key={skill} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Results */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <BountyCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && results && (
        <>
          <p className="text-sm text-gray-500">
            {results.pagination?.total || 0} result{results.pagination?.total !== 1 ? 's' : ''} for &quot;{query}&quot;
          </p>

          {results.data?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.data.map((b) => <BountyCard key={b.id} bounty={b} />)}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No bounties found</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          )}

          {results.pagination && (
            <Pagination pagination={results.pagination} onPageChange={handlePageChange} />
          )}
        </>
      )}

      {!results && !loading && (
        <div className="text-center py-16 text-gray-400">
          <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Start typing to search bounties</p>
          <p className="text-sm mt-1">Search by title, description, or keywords</p>
        </div>
      )}
    </div>
  );
}
