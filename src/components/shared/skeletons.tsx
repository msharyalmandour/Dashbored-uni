import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading shapes. These are plain server components — they add
 * zero client JavaScript — and they mirror the real page layouts closely
 * enough that content swapping in doesn't shift the page around.
 */

export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {action && <Skeleton className="h-9 w-32 rounded-md" />}
    </div>
  );
}

export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[86px] rounded-lg" />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[58px] rounded-lg" />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6, className = "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" }) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[164px] rounded-xl" />
      ))}
    </div>
  );
}

/** Generic page: header, a stat row, then a list. Fits most module pages. */
export function PageSkeleton({ stats = 3, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {stats > 0 && <StatRowSkeleton count={stats} />}
      <ListSkeleton rows={rows} />
    </div>
  );
}

/** Mirrors the dashboard: hero, stat tiles, asymmetric today row, actions, worlds. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Ambient hero */}
      <div className="flex min-h-[220px] flex-col justify-between gap-6 rounded-2xl border border-border-subtle bg-surface-primary p-6 sm:min-h-[280px] sm:p-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-[19rem] max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[58px] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Today command center */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Skeleton className="h-[400px] rounded-xl lg:col-span-2" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[284px] rounded-xl" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-28" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[62px] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Academic worlds */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-[196px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[196px] rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[186px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Detail pages (subject, lecture): back link, header, tabs, content. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-32" />
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <CardGridSkeleton count={4} className="sm:grid-cols-2" />
    </div>
  );
}
