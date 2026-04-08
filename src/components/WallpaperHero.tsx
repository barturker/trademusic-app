"use client";

import Threads from "@/components/Threads";

const HERO_TITLE = "Trade Tracks\nSecurely";
const HERO_DESCRIPTION = "No accounts, no trust required — mutual escrow";

export function WallpaperHero() {
  return (
    <div
      className="absolute top-0 left-0 z-[9] h-screen w-screen overflow-hidden"
      aria-hidden="true"
    >
      {/* Dark base */}
      <div className="absolute inset-0 bg-[#050a18]" />

      {/* Animated background */}
      <Threads
        className="absolute inset-0"
        color={[0.9607843137254902, 0.596078431372549, 0.4]}
        amplitude={2.7}
        distance={0}
        enableMouseInteraction
      />

      {/* Hero text */}
      <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center md:block">
        <h1 className="mb-5 font-[family-name:var(--font-playfair)] text-[96px] leading-[0.95] font-black text-white whitespace-pre-line">
          {HERO_TITLE}
        </h1>
        <p className="mb-8 text-lg font-normal text-white/90">
          {HERO_DESCRIPTION}
        </p>
      </div>
    </div>
  );
}
