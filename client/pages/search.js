import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import BountyCard from '../components/BountyCard';
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

  // Debounce autocomplete so we're not hitting the API on every keystroke
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
      const data = await api.get(
        `/bounties/search?q=${encodeURIComponent(searchQuery)}&page=${searchPage}&limit=15`
      );
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
    <div className="max-w-4xl mx-auto space-y-0 animate-fade-in">

      {/* Page header */}
      <div className="py-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-gray-500 mt-0.5">Find bounties by title or description</p>
      </div>

      {/* Search input with autocomplete dropdown */}
      <div className="py-4 border-b border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="input pl-10 pr-10 py-2.5"
              placeholder="Search bounties... (e.g., machine learning, API, React)"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults(null); setSuggestions([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 card py-1 shadow-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <SearchIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Results count */}
      {!loading && results && (
        <div className="py-2.5 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500">
          {results.pagination?.total || 0} result{results.pagination?.total !== 1 ? 's' : ''} for &quot;{query}&quot;
        </div>
      )}

      {/* Forum-style thread list for results */}
      {(loading || (results?.data?.length > 0)) && (
        <div className={`border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-xl overflow-hidden ${loading ? '' : ''}`}>
          {loading ? (
            // Simple inline skeleton rows
            [...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-800 animate-pulse">
                <div className="skeleton w-14 h-14 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : (
            results.data.map((b) => <BountyCard key={b.id} bounty={b} />)
          )}
        </div>
      )}

      {!loading && results?.data?.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium">No results found for &quot;{query}&quot;</p>
          <p className="text-sm mt-1">Try different keywords or check your spelling</p>
        </div>
      )}

      {results?.pagination && (
        <div className="pt-4">
          <Pagination pagination={results.pagination} onPageChange={handlePageChange} />
        </div>
      )}

      {/* Empty state before any search */}
      {!results && !loading && (
        <div className="text-center py-20 text-gray-400">
          <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-25" />
          <p className="text-base">Type to search bounties</p>
        </div>
      )}

    </div>
  );
}
