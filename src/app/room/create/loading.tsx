export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        {/* Title skeleton */}
        <div className="mx-auto mb-2 h-6 w-52 animate-pulse rounded-lg bg-muted" />
        {/* Subtitle skeleton */}
        <div className="mx-auto mb-8 h-4 w-72 animate-pulse rounded-lg bg-muted" />
        {/* Card skeleton */}
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
