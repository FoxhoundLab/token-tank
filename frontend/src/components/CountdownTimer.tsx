/**
 * CountdownTimer — Shows time remaining until a usage window resets.
 * Accepts an ISO 8601 timestamp and updates every second via a interval-based
 * React effect.  Colors follow the fuel-gauge convention:
 *   green  — plenty of time remaining
 *   amber  — less than 1 hour left
 *   red    — less than 15 minutes left
 */

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface CountdownTimerProps {
  /** ISO-8601 timestamp when the usage window resets (e.g. "2026-06-26T22:00:00Z") */
  resetsAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Map a millisecond delta to a human-readable string. */
function formatRemaining(ms: number): string {
  const absMs = Math.max(0, ms);
  const totalMinutes = Math.floor(absMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (totalHours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "expired";
}

/** Pick the colour string based on remaining milliseconds. */
function getColor(ms: number): string {
  const absMs = Math.max(0, ms);

  if (absMs < 15 * 60 * 1000) {
    return "#ef4444"; // red — less than 15 minutes
  }

  if (absMs < 60 * 60 * 1000) {
    return "#f59e0b"; // amber — less than 1 hour
  }

  return "#22c55e"; // green — normal
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function CountdownTimer({ resetsAt }: CountdownTimerProps) {
  // Compute the target Date on mount (and if the prop changes).
  const [targetMs, setTargetMs] = useState(() => Date.parse(resetsAt));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Re-parse when the prop changes.
    setTargetMs(Date.parse(resetsAt));
  }, [resetsAt]);

  useEffect(() => {
    // Update the clock once per second.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = targetMs - now;
  const displayText = formatRemaining(remainingMs);
  const color = getColor(remainingMs);

  return (
    <span
      style={{
        color,
        fontWeight: 600,
        fontFamily: "monospace",
      }}
    >
      {displayText}
    </span>
  );
}
