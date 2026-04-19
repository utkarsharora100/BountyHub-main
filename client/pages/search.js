// ─── Search Page ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import BountyCard from '../components/BountyCard';
import { BountyCardSkeleton } from '../components/Skeletons';
import Pagination from '../components/Pagination';
import { Search as SearchIcon, X } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [page, setPage] = useState(1);
  const inputRef = useRef();
  const debounceRef = useRef();

  // Autocomplete suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}`);
        setSuggestions(data);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function doSearch(searchQuery, searchPage = 1) {
    if (!searchQuery || searchQuery.length < 2) return;
    setLoading(true);
    setShowSuggestions(false);
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

  const handleSuggestionClick = (s) => {
    setQuery(s);
    setShowSuggestions(false);
    setPage(1);
    doSearch(s, 1);
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
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="input pl-12 pr-12 py-3 text-lg"
            placeholder="Search for bounties... (e.g., machine learning, API, React)"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults(null); setSuggestions([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 card py-2 shadow-lg">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
              >
                <SearchIcon className="w-3.5 h-3.5 text-gray-400" />
                {s}
              </button>
            ))}
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
