// ─── Bounty Card Component ───────────────────────────────────
import Link from 'next/link';
import { Clock, MessageSquare, Users, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const categoryColors = {
  CODING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  RESEARCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  DESIGN: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  DEBUGGING: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  DOCUMENTATION: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const statusBadge = {
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-in-progress',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
};

export default function BountyCard({ bounty }) {
  const timeAgo = formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true });

  return (
    <Link href={`/bounties/${bounty.id}`}>
      <div className="card p-5 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200 cursor-pointer group animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
            {bounty.title}
          </h3>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-sm whitespace-nowrap">
            <Award className="w-4 h-4" />
            {bounty.rewardPoints} pts
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
          {bounty.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`badge ${categoryColors[bounty.category] || categoryColors.OTHER}`}>
            {bounty.category}
          </span>
          <span className={statusBadge[bounty.status] || 'badge'}>
            {bounty.status.replace('_', ' ')}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            {bounty.creator && (
              <span className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300">
                  {bounty.creator.name[0]}
                </div>
                {bounty.creator.name}
                {bounty.creator.university && (
                  <span className="text-gray-400">• {bounty.creator.university.name}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {bounty._count && (
              <>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{bounty._count.bids}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{bounty._count.comments}</span>
              </>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{timeAgo}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
