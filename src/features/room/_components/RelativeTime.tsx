"use client";

import { useEffect, useState } from "react";

import { formatDistanceToNowStrict } from "date-fns";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const REFRESH_INTERVAL_MS = 10_000;

interface RelativeTimeProps {
  timestamp: string;
}

/** Displays relative time ("2 minutes ago") with exact time on hover. */
export function RelativeTime({ timestamp }: RelativeTimeProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const date = new Date(timestamp);
  const relative = formatDistanceToNowStrict(date, { addSuffix: true, roundingMethod: "floor" });
  const exact = date.toLocaleString();

  return (
    <Tooltip>
      <TooltipTrigger
        className="text-muted-foreground cursor-default text-xs whitespace-nowrap"
      >
        {relative}
      </TooltipTrigger>
      <TooltipContent side="left">
        {exact}
      </TooltipContent>
    </Tooltip>
  );
}
