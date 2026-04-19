import { useState, useEffect, useRef } from 'react';

/**
 * A custom hook to smoothly animate a number "ticking" up or down to a target value.
 * @param targetValue The value to animate towards.
 * @param duration Duration of the animation in milliseconds.
 */
export const useAnimatedScore = (targetValue: number | null, duration: number = 800) => {
  const [displayValue, setDisplayValue] = useState<number | null>(targetValue);
  const prevValueRef = useRef<number | null>(targetValue);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // If target is null, set null immediately
    if (targetValue === null) {
      setDisplayValue(null);
      prevValueRef.current = null;
      return;
    }

    // If initial value was null, snap to target
    if (prevValueRef.current === null) {
      setDisplayValue(targetValue);
      prevValueRef.current = targetValue;
      return;
    }

    // If target is same as previous, do nothing
    if (prevValueRef.current === targetValue) return;

    let startTime: number | null = null;
    const startValue = prevValueRef.current;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Use easeOutQuad for smoother feel
      const easeProgress = progress * (2 - progress);
      const current = startValue + (targetValue - startValue) * easeProgress;
      
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = targetValue;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetValue, duration]);

  return displayValue;
};
