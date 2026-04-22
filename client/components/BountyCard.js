import Link from 'next/link';
import { MessageSquare, Users, Award, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Category tag colors — kept in the component so they stay in sync with the DB enum values.
const categoryColors = {
  CODING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  RESEARCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  DESIGN: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
  DEBUGGING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  DOCUMENTATION: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const statusColors = {
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-in-progress',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
};

// Forum-style row (think StackOverflow question row).
// Stats panel on the left, content on the right — scales well in a list layout.
export default function BountyCard({ bounty }) {
  const timeAgo = formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true });
  const bidCount = bounty._count?.bids ?? 0;
  const commentCount = bounty._count?.comments ?? 0;

  return (
    <Link href={`/bounties/${bounty.id}`} className="block group animate-fade-in">
      <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors">

        {/* Left: reward points displayed like a vote counter */}
        <div className="flex flex-col items-center justify-start gap-1 w-16 shrink-0 pt-0.5">
          <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-center ${
            bounty.status === 'COMPLETED'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
          }`}>
            <Award className="w-4 h-4 mb-0.5" />
            <span className="text-base font-bold leading-none">{bounty.rewardPoints}</span>
            <span className="text-[10px] mt-0.5 opacity-75">pts</span>
          </div>

          {/* Bids count — the "answers" equivalent in a forum */}
          <div className={`flex flex-col items-center mt-1 px-2 py-1 rounded text-center text-xs ${
            bidCount > 0
              ? 'text-gray-600 dark:text-gray-400'
              : 'text-gray-400 dark:text-gray-600'
          }`}>
            <Users className="w-3.5 h-3.5 mb-0.5" />
            <span className="font-medium">{bidCount}</span>
          </div>
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title */}
          <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">
            {bounty.title}
          </h3>

          {/* Description snippet */}
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {bounty.description}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`badge text-[11px] ${categoryColors[bounty.category] || categoryColors.OTHER}`}>
              {bounty.category}
            </span>
            <span className={`${statusColors[bounty.status] || 'badge'} text-[11px]`}>
              {bounty.status.replace('_', ' ')}
            </span>
          </div>

          {/* Footer meta — poster info + activity stats */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500 pt-0.5">
            {bounty.creator && (
              <span className="flex items-center gap-1.5">
                {/* Tiny avatar initial */}
                <span className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-300">
                  {bounty.creator.name[0]}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{bounty.creator.name}</span>
                {bounty.creator.university && (
                  <span className="hidden sm:inline">• {bounty.creator.university.name}</span>
                )}
              </span>
            )}

            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {commentCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
            </span>
          </div>
        </div>

      </div>
    </Link>
  );
}
