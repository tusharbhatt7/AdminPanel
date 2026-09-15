// The stamped class on <html> is the single source of truth; index.html resolves it
// before first paint so there is no flash, and this keeps it in sync afterwards.
const KEY = 'fc-theme';

export const getTheme = () => {
    try {
        return localStorage.getItem(KEY) || 'dark';
    } catch {
        return 'dark';
    }
};

export const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    try {
        localStorage.setItem(KEY, theme);
    } catch {
        // private browsing — the class still applies for this session
    }
};
