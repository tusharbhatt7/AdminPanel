/**
 * Tone → class lookups.
 *
 * Tailwind finds classes by scanning source for literal strings, so
 * `text-${tone}` compiles to nothing: the class exists only if some *other*
 * file happens to spell it out. That is not a theoretical risk — it already
 * happened here. `border-warn/40` and `border-danger/40` were in the
 * stylesheet because two components wrote them literally, while
 * `border-info/40` and `border-ok/40` were absent, so a panel built with an
 * interpolated tone would have rendered with no border colour at all, and only
 * for some tones.
 *
 * Writing every class out in full is what makes them survive the scanner, and
 * it keeps the set of valid tones in one place instead of implied by template
 * literals scattered across components.
 */

export const TONES = ['ok', 'warn', 'danger', 'info', 'violet', 'brand', 'neutral'];

export const TONE_TEXT = {
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
    info: 'text-info',
    violet: 'text-violet',
    brand: 'text-brand',
    neutral: 'text-fg-3',
};

export const TONE_BG_SOFT = {
    ok: 'bg-ok-soft',
    warn: 'bg-warn-soft',
    danger: 'bg-danger-soft',
    info: 'bg-info-soft',
    violet: 'bg-violet-soft',
    brand: 'bg-brand-soft',
    neutral: 'bg-raised',
};

export const TONE_BORDER = {
    ok: 'border-ok/40',
    warn: 'border-warn/40',
    danger: 'border-danger/40',
    info: 'border-info/40',
    violet: 'border-violet/40',
    brand: 'border-brand/40',
    neutral: 'border-line',
};

export const TONE_DOT = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    info: 'bg-info',
    violet: 'bg-violet',
    brand: 'bg-brand',
    neutral: 'bg-line-strong',
};

const pick = (map, tone, fallback = 'neutral') => map[tone] ?? map[fallback];

export const toneText = (tone) => pick(TONE_TEXT, tone);
export const toneBgSoft = (tone) => pick(TONE_BG_SOFT, tone);
export const toneBorder = (tone) => pick(TONE_BORDER, tone);
export const toneDot = (tone) => pick(TONE_DOT, tone);

/** Soft-filled icon chip: the KPI and card-header treatment. */
export const toneChip = (tone) => `${toneBgSoft(tone)} ${toneText(tone)}`;

/** Soft-filled callout: background plus its matching border. */
export const toneCallout = (tone) => `${toneBgSoft(tone)} ${toneBorder(tone)}`;
