import Link from "next/link";

import { HomeDropZone } from "@/components/HomeDropZone";
import { TradeCard } from "@/components/TradeCard";
import { TradeNavbar } from "@/components/TradeNavbar";
import { TradeSyncLogo } from "@/components/TradeSyncLogo";
import { WallpaperHero } from "@/components/WallpaperHero";

export default function HomePage() {
  return (
    <HomeDropZone>
      <main className="relative h-screen w-screen overflow-hidden bg-background">
        {/* Background wallpaper layer */}
        <WallpaperHero />

        {/* Logo — top left */}
        <Link
          href="/"
          className="absolute top-4 left-[80px] z-[90] max-md:left-6"
        >
          <TradeSyncLogo className="h-7 w-auto text-white" />
        </Link>

        {/* Navigation — top right */}
        <TradeNavbar />

        {/* Trade card — left side, WeTransfer style */}
        <TradeCard />

        {/* Legal links — bottom right */}
        <footer className="absolute right-6 bottom-4 z-[90] flex gap-3 text-xs text-white/70">
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
        </footer>
      </main>
    </HomeDropZone>
  );
}
