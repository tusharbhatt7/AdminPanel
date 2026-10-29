import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, CornerDownLeft, Car, User, Route as RouteIcon, ArrowRight, Loader2, Lock,
} from 'lucide-react';
import { globalSearch } from '../services/searchService';
import { useAuth } from '../lib/useAuth';
import { PERMISSIONS } from '../lib/roles';

/**
 * ⌘K / Ctrl-K: jump to a page, or paste a ride id, phone number or plate and
 * go straight to the record.
 *
 * Mounted once in the layout, so it is reachable from every screen without
 * each page having to know about it.
 */

const PAGES = [
    { path: '/dashboard', name: 'Dashboard', icon: RouteIcon },
    { path: '/live', name: 'Active Rides', icon: Car, permission: PERMISSIONS.RIDES_READ },
    { path: '/rides', name: 'All Rides', icon: RouteIcon },
    { path: '/rides?status=active', name: 'Rides · Active', icon: RouteIcon },
    { path: '/rides?status=cancelled', name: 'Rides · Cancelled', icon: RouteIcon },
    { path: '/drivers', name: 'Drivers', icon: Car },
    { path: '/customers', name: 'Customers', icon: User },
    { path: '/payments', name: 'Payments', icon: RouteIcon },
    { path: '/wallets', name: 'Driver Wallets', icon: RouteIcon, permission: PERMISSIONS.WALLETS_READ },
    { path: '/wallets?tab=withdrawals', name: 'Wallets · Withdrawals', icon: RouteIcon, permission: PERMISSIONS.WALLETS_READ },
    { path: '/wallets?tab=review', name: 'Wallets · Needs review', icon: RouteIcon, permission: PERMISSIONS.WALLETS_READ },
    { path: '/reviews', name: 'Reviews', icon: RouteIcon },
    { path: '/analytics', name: 'Analytics', icon: RouteIcon },
    { path: '/users', name: 'Users & Roles', icon: User, permission: PERMISSIONS.USERS_READ },
    { path: '/audit', name: 'Audit Log', icon: RouteIcon, permission: PERMISSIONS.AUDIT_READ },
];

const KIND_ICON = { ride: RouteIcon, driver: Car, customer: User };
const KIND_LABEL = { ride: 'Ride', driver: 'Driver', customer: 'Customer' };

export default function CommandPalette() {
    const navigate = useNavigate();
    const { can } = useAuth();

    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [records, setRecords] = useState({ results: [], encryptedFields: 0, truncated: false });
    const [searching, setSearching] = useState(false);
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((v) => !v);
                return;
            }
            // "/" is the other muscle memory for search, but only when the
            // caret is not already in a field — otherwise it eats the
            // character someone is typing into a filter box.
            const tag = document.activeElement?.tagName;
            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
                e.preventDefault();
                setOpen(true);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (open) {
            setQ(''); setRecords({ results: [], encryptedFields: 0, truncated: false }); setCursor(0);
            // Focus after paint, or the browser restores focus to the trigger.
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    // Debounced, because each search can touch three collections. Typing stays
    // responsive and a fast typist issues one query, not eight.
    useEffect(() => {
        if (!open || q.trim().length < 2) { setRecords({ results: [], encryptedFields: 0, truncated: false }); return undefined; }
        setSearching(true);
        const id = setTimeout(async () => {
            try {
                setRecords(await globalSearch(q));
            } catch (error) {
                console.error('Search failed:', error);
                setRecords({ results: [], encryptedFields: 0, truncated: false });
            } finally {
                setSearching(false);
            }
        }, 220);
        return () => { clearTimeout(id); setSearching(false); };
    }, [q, open]);

    const pages = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return PAGES
            .filter((p) => !p.permission || can(p.permission))
            .filter((p) => !needle || p.name.toLowerCase().includes(needle));
    }, [q, can]);

    const rows = useMemo(
        () => [
            ...pages.map((p) => ({ type: 'page', path: p.path, title: p.name, icon: p.icon })),
            ...records.results.map((r) => ({
                type: 'record', path: r.path, title: r.title, subtitle: r.subtitle,
                detail: r.detail, kind: r.kind, icon: KIND_ICON[r.kind] ?? RouteIcon,
            })),
        ],
        [pages, records.results],
    );

    const go = useCallback((row) => { if (row) { setOpen(false); navigate(row.path); } }, [navigate]);

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
        if (e.key === 'Enter') { e.preventDefault(); go(rows[cursor]); }
    };

    useEffect(() => { setCursor(0); }, [rows.length]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh] bg-fg/40 backdrop-blur-sm"
             onClick={() => setOpen(false)}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl overflow-hidden border rounded-xl bg-surface border-line-strong lift"
            >
                <div className="flex items-center gap-2 px-3 border-b border-line">
                    <Search className="w-4 h-4 text-fg-3 shrink-0" />
                    <input
                        ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                        placeholder="Jump to a page, or paste a ride id, phone or plate…"
                        className="flex-1 py-3 text-[14px] bg-transparent text-fg placeholder:text-fg-3 focus:outline-none"
                    />
                    {searching && <Loader2 className="w-4 h-4 animate-spin text-fg-3 shrink-0" />}
                </div>

                <div className="max-h-[22rem] overflow-y-auto p-1.5">
                    {rows.length === 0 ? (
                        <p className="py-10 text-center text-[13px] text-fg-3">
                            {q.trim().length < 2 ? 'Type to search.' : 'Nothing matched.'}
                        </p>
                    ) : rows.map((row, i) => {
                        const Icon = row.icon;
                        return (
                            <button
                                key={`${row.type}-${row.path}-${i}`}
                                type="button"
                                onMouseEnter={() => setCursor(i)}
                                onClick={() => go(row)}
                                className={`flex items-center w-full gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                    i === cursor ? 'bg-raised' : ''
                                }`}
                            >
                                <Icon className="w-4 h-4 text-fg-3 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium truncate text-fg">{row.title}</p>
                                    {row.subtitle && <p className="text-[11px] truncate text-fg-3">{row.subtitle}</p>}
                                    {row.detail && <p className="text-[11px] truncate text-fg-3">{row.detail}</p>}
                                </div>
                                {row.type === 'record' && (
                                    <span className="pill pill-neutral shrink-0">{KIND_LABEL[row.kind]}</span>
                                )}
                                {i === cursor && <CornerDownLeft className="w-3.5 h-3.5 text-fg-3 shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Both of these are the difference between "no match" and "not
                    in the window I looked at", which are very different answers. */}
                {(records.encryptedFields > 0 || records.truncated) && (
                    <div className="flex items-start gap-2 px-3 py-2 border-t border-line bg-raised">
                        <Lock className="w-3 h-3 mt-0.5 text-fg-3 shrink-0" />
                        <p className="text-[11px] leading-snug text-fg-3">
                            {records.encryptedFields > 0 && (
                                <>Some phone and vehicle fields are encrypted and cannot be matched. </>
                            )}
                            {records.truncated && <>Searching the most recent records only, not the full history.</>}
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-3 px-3 py-2 border-t border-line text-[10px] text-fg-3">
                    <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 rotate-90" /> navigate</span>
                    <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> open</span>
                    <span className="ml-auto font-mono">esc to close</span>
                </div>
            </div>
        </div>
    );
}
