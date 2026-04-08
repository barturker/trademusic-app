import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">This page does not exist.</p>
      <Link
        href="/"
        className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground"
      >
        Back to home
      </Link>
    </main>
  );
}
