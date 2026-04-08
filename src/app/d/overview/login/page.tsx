import { notFound } from "next/navigation";

import { env } from "@/lib/env";
import { LoginForm } from "@/features/admin/_components/LoginForm";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login — TradeMusic",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Double-check gate key server-side (proxy already checks, this is defense-in-depth)
  if (params.key !== env.ADMIN_GATE_KEY) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <LoginForm />
    </main>
  );
}
