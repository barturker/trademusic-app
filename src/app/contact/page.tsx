import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — TradeMusic",
};

const CONTACT_EMAIL = "info@trademusic.app";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-wt-dark">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-wt-dark/60 hover:text-wt-dark transition-colors"
      >
        &larr; Back to TradeMusic
      </Link>

      <h1 className="mb-8 text-2xl font-semibold">Contact</h1>

      <div className="space-y-6 text-sm leading-relaxed text-wt-dark/80">
        <p>
          Have a question, feedback, or need help with a trade? We&apos;d love to hear from you.
        </p>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-lg bg-wt-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-wt-dark/80"
        >
          Send us an email
        </a>

        <p className="text-wt-dark/60">
          You can also reach us directly at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-wt-dark underline hover:text-wt-dark/70 transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
