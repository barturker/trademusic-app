import type { SVGProps } from "react";

/** Standalone icon mark — two curved exchange arrows */
export function TradeSyncIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Top-right arrow arc */}
      <path d="M5 17a9 9 0 0 1 15.5-6.5" />
      <polyline points="20.5 6.5 20.5 11.5 15.5 11.5" />

      {/* Bottom-left arrow arc */}
      <path d="M23 11a9 9 0 0 1-15.5 6.5" />
      <polyline points="7.5 21.5 7.5 16.5 12.5 16.5" />
    </svg>
  );
}

/** Full logo — icon + wordmark */
export function TradeSyncLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 160 28"
      fill="currentColor"
      className={className}
      {...props}
    >
      {/* Icon */}
      <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17a9 9 0 0 1 15.5-6.5" />
        <polyline points="20.5 6.5 20.5 11.5 15.5 11.5" />
        <path d="M23 11a9 9 0 0 1-15.5 6.5" />
        <polyline points="7.5 21.5 7.5 16.5 12.5 16.5" />
      </g>

      {/* Wordmark */}
      <text
        x="32"
        y="20"
        fill="currentColor"
        stroke="none"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="-0.02em"
      >
        TradeMusic
      </text>
    </svg>
  );
}
