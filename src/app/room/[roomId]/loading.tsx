export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="w-full max-w-2xl lg:max-w-5xl">
        {/* Header skeleton */}
        <header className="mb-6">
          <div className="h-5 w-24 animate-pulse rounded-lg bg-muted" />
        </header>

        <div className="space-y-5">
          {/* Role + status bar skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-3 w-36 animate-pulse rounded-lg bg-muted" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
          </div>

          {/* Room info card skeleton */}
          <div className="rounded-2xl bg-card shadow-sm">
            <div className="h-44 animate-pulse rounded-2xl bg-muted" />
          </div>

          {/* Status card skeleton */}
          <div className="rounded-2xl bg-card shadow-sm">
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          </div>

          {/* Trade overview skeleton */}
          <div className="rounded-2xl bg-card shadow-sm">
            <div className="h-52 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    </main>
  );
}
