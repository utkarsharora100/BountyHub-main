// ─── Pagination Component ────────────────────────────────────
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, hasNext, hasPrev } = pagination;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="px-3 py-1 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">1</button>
          {start > 2 && <span className="px-1 text-gray-400">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            p === page ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
          <button onClick={() => onPageChange(totalPages)} className="px-3 py-1 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
