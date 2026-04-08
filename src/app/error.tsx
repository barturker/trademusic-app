"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60">
          Reference: {error.digest}
        </p>
      )}
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
