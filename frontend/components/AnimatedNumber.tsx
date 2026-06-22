"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/**
 * Smoothly tweens a displayed number toward `value`. Interruption-safe: if the
 * value changes mid-tween (e.g. during scenario playback) the next tween starts
 * from where the display actually is, so it chases rather than jumps.
 */
export function AnimatedNumber({
  value,
  from,
  decimals = 0,
  duration = 0.5,
  prefix = "",
  suffix = "",
  className,
  style,
}: {
  value: number;
  from?: number; // start value on first mount (e.g. 0 for a count-up intro)
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [display, setDisplay] = useState(from ?? value);
  const current = useRef(from ?? value);

  useEffect(() => {
    const controls = animate(current.current, value, {
      duration,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        current.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
