"use client";

import { useEffect, useRef, useState } from "react";
import { currency } from "../taka-fintrack-helpers";

function useAnimatedNumber(value: number, duration = 780) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mediaQuery?.matches) {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const startValue = previousValue.current;
    const difference = value - startValue;
    if (difference === 0) return;

    let frame = 0;
    let startTime: number | null = null;
    const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

    const tick = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      setDisplayValue(startValue + difference * easeOutCubic(progress));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        previousValue.current = value;
        setDisplayValue(value);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

export function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  const animatedValue = useAnimatedNumber(value);
  return <span className={className}>{currency.format(Math.round(animatedValue))}</span>;
}

export function AnimatedPercent({ value, className }: { value: number; className?: string }) {
  const animatedValue = useAnimatedNumber(value, 620);
  return <span className={className}>{Math.round(animatedValue)}%</span>;
}
