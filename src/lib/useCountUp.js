import { useEffect, useRef, useState } from 'react';

/**
 * Eases a number up to its new value. The tween runs inside requestAnimationFrame
 * rather than synchronously in the effect, which also keeps it clear of the
 * cascading-render lint rule.
 *
 * Honours prefers-reduced-motion by jumping straight to the value on the first
 * frame instead of skipping the hook, so the render path stays identical.
 */
export const useCountUp = (value, duration = 620) => {
    const [display, setDisplay] = useState(0);
    const fromRef = useRef(0);

    useEffect(() => {
        if (value === null || value === undefined) return undefined;

        const from = fromRef.current;
        if (from === value) return undefined;

        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const start = performance.now();
        let raf;

        const tick = (now) => {
            const t = reduced ? 1 : Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(Math.round(from + (value - from) * eased));
            if (t < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                fromRef.current = value;
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);

    return display;
};
