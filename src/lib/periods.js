// Reporting windows offered in the top bar. Every trend on the dashboard compares
// the selected window against the window immediately before it.
export const PERIODS = [
    { days: 1, label: 'Today' },
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
];

export const periodLabel = (days) =>
    PERIODS.find((p) => p.days === days)?.label ?? `Last ${days} days`;
