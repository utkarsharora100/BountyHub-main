// ─── Loading Skeleton Components ─────────────────────────────
export function BountyCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex justify-between">
        <div className="skeleton h-6 w-3/4" />
        <div className="skeleton h-6 w-16" />
      </div>
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="flex gap-2">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-14 rounded-full" />
      </div>
      <div className="flex justify-between">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-4 w-20" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="skeleton w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-4 w-32" />
        </div>
      </div>
      <div className="skeleton h-4 w-24" />
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-5 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}
