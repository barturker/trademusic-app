"use client";

import Link from "next/link";

export function TradeNavbar() {
  return (
    <>
      {/* Desktop nav */}
      <nav className="absolute top-4 right-[80px] z-[89] hidden md:block max-md:right-6">
        <div className="flex items-start gap-2">
          <div className="flex h-12 items-center rounded-xl bg-white">
            <Link
              href="/"
              className="inline-flex items-center pl-6 pr-6 h-12 text-sm font-medium text-wt-dark transition-opacity duration-150 hover:opacity-70"
            >
              Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile nav */}
      <nav className="flex items-center justify-between p-4 md:hidden">
        <Link href="/" className="text-base font-semibold text-wt-dark">
          TradeMusic
        </Link>
      </nav>
    </>
  );
}
