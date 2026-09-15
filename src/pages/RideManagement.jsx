import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, AlertCircle, ExternalLink, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { fetchRidesPage, listenToRides } from '../services/rideService';
import RideDetailDrawer from '../components/RideDetailDrawer';
import {
    RIDE_PRESETS, isRidePreset, statusStyle, statusLabel,
    formatAge, formatDateTime, formatCurrency, isStaleActive, STALE_ACTIVE_HOURS,
    statusStripe,
} from '../lib/rideStatus';
import { looksEncrypted } from '../lib/pii';

const EMPTY_FEED = { status: 'loading', rides: [], lastDoc: null, hasMore: false, atLimit: false, error: null, forPreset: null };

export default function RideManagement() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requested = searchParams.get('status');
    const presetKey = isRidePreset(requested) ? requested : 'all';
    const preset = RIDE_PRESETS[presetKey];

    const [feed, setFeed] = useState(EMPTY_FEED);
    const [search, setSearch] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedRide, setSelectedRide] = useState(null);

    const loading = feed.forPreset !== presetKey || feed.status === 'loading';

    useEffect(() => {
        let cancelled = false;
        const fail = (error) => setFeed({ ...EMPTY_FEED, status: 'error', error, forPreset: presetKey });

        // Presets an admin watches stream; presets they browse paginate.
        if (preset.live) {
            return listenToRides(
                preset.statuses,
                ({ rides, atLimit }) => setFeed({
                    status: 'ok', rides, lastDoc: null, hasMore: false, atLimit, error: null, forPreset: presetKey,
                }),
                fail,
            );
        }

        (async () => {
            try {
                const page = await fetchRidesPage({ statuses: preset.statuses });
                if (!cancelled) {
                    setFeed({ status: 'ok', ...page, atLimit: false, error: null, forPreset: presetKey });
                }
            } catch (error) {
                console.error('Failed to load rides:', error);
                if (!cancelled) fail(error);
            }
        })();

        return () => { cancelled = true; };
    }, [presetKey, preset.live, preset.statuses]);

    const handleLoadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const page = await fetchRidesPage({ statuses: preset.statuses, lastDoc: feed.lastDoc });
            setFeed((prev) => ({
                ...prev,
                rides: [...prev.rides, ...page.rides],
                lastDoc: page.lastDoc,
                hasMore: page.hasMore,
            }));
        } catch (error) {
            console.error('Failed to load more rides:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [preset.statuses, feed.lastDoc]);

    const visibleRides = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return feed.rides;
        return feed.rides.filter((r) => [
            r.id, r.pickupName, r.pickupAddress, r.destName, r.destAddress,
            r.driverName, r.vehicleNumber, r.userId, r.userEmail, r.status,
        ].some((f) => f && String(f).toLowerCase().includes(q)));
    }, [feed.rides, search]);

    const staleCount = useMemo(
        () => (presetKey === 'active' ? feed.rides.filter(isStaleActive).length : 0),
        [feed.rides, presetKey],
    );

    // A brand new composite index takes a few minutes to build; say so plainly
    // instead of showing a generic failure.
    const isIndexError = feed.error?.code === 'failed-precondition';
    const indexUrl = feed.error?.message?.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];

    return (
        <div className="flex flex-col gap-4">
            <div>
                <Link to="/dashboard" className="inline-flex items-center gap-1.5 mb-2 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-fg-3 hover:text-brand transition-colors">
                    <ArrowLeft className="w-3 h-3" /> Overview
                </Link>
                <h2 className="text-base font-semibold tracking-tight text-fg">{preset.label}</h2>
                <p className="mt-0.5 text-[13px] text-fg-3">{preset.blurb}</p>
            </div>

            {/* Preset tabs */}
            <div className="flex gap-1 p-1 overflow-x-auto border rounded-lg bg-surface border-line">
                {Object.entries(RIDE_PRESETS).map(([key, p]) => (
                    <button
                        key={key}
                        onClick={() => setSearchParams(key === 'all' ? {} : { status: key }, { replace: true })}
                        className={`px-3 py-1.5 text-[13px] font-medium rounded-md whitespace-nowrap transition-colors ${key === presetKey
                            ? 'bg-raised text-fg'
                            : 'text-fg-3 hover:text-fg'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {staleCount > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 text-[13px] border rounded-lg bg-warn-soft border-warn/30 text-fg-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warn" />
                    <span>
                        <strong className="font-mono text-fg">{staleCount}</strong> have sat in an active status for over {STALE_ACTIVE_HOURS} hours —
                        almost certainly abandoned rides that were never closed out, not rides in progress.
                    </span>
                </div>
            )}

            {/* Search + count */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-fg-3 pointer-events-none" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search route, driver, vehicle, ride ID…"
                        className="field pl-8"
                    />
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-fg-3">
                    <span><span className="font-semibold text-fg">{visibleRides.length}</span> shown</span>
                    {preset.live && (
                        <span className="flex items-center gap-1.5 text-ok">
                            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> LIVE
                        </span>
                    )}
                </div>
            </div>

            {feed.status === 'error' ? (
                <div className="p-6 text-center border rounded-lg bg-surface border-danger/40">
                    <AlertCircle className="w-6 h-6 mx-auto mb-3 text-danger" />
                    <h3 className="text-sm font-semibold text-fg">
                        {isIndexError ? 'This view needs a Firestore index' : 'Could not load rides'}
                    </h3>
                    <p className="max-w-md mx-auto mt-2 text-[13px] text-fg-3">
                        {isIndexError
                            ? 'The composite index for this filter is still building, which usually takes a few minutes. Reload once it is ready.'
                            : feed.error?.message || 'Something went wrong talking to Firestore.'}
                    </p>
                    {indexUrl && (
                        <a href={indexUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-medium text-brand hover:underline">
                            Check index status <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
            ) : (
                <>
                    <div className="panel-flush">
                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Route</th>
                                        <th className="text-right">Fare</th>
                                        <th>Driver</th>
                                        <th>Requested</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <tr key={i}>
                                                <td colSpan={5}>
                                                    <div className="h-5 skeleton" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : visibleRides.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center">
                                                <p className="text-[13px] font-medium text-fg-2">No rides here</p>
                                                <p className="mt-1 text-[13px] text-fg-3">
                                                    {search ? 'Try a different search.' : 'Nothing matches this filter yet.'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleRides.map((ride) => (
                                            <tr
                                                key={ride.id}
                                                onClick={() => setSelectedRide(ride)}
                                                style={{ '--stripe-color': statusStripe(ride.status) }}
                                                className="row-link"
                                            >
                                                <td className="stripe-cell">
                                                    <span className={statusStyle(ride.status)}>{statusLabel(ride.status)}</span>
                                                </td>
                                                <td className="max-w-xs">
                                                    <div className="font-medium truncate text-fg">{ride.pickupName || '—'}</div>
                                                    <div className="text-xs truncate text-fg-3">→ {ride.destName || '—'}</div>
                                                </td>
                                                <td className="font-mono text-right text-fg">
                                                    {formatCurrency(ride.fare)}
                                                </td>
                                                <td>
                                                    <div className="truncate text-fg-2">{ride.driverName || <span className="text-fg-3">Unassigned</span>}</div>
                                                    {ride.vehicleNumber && (
                                                        looksEncrypted(ride.vehicleNumber)
                                                            ? <div className="font-mono text-[10px] text-fg-3" title="Stored encrypted by the driver app; this panel has no key">ENCRYPTED</div>
                                                            : <div className="font-mono text-[11px] text-fg-3">{ride.vehicleNumber}</div>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    <div className="font-mono text-[11px] text-fg-2">{formatAge(ride.requestTime)}</div>
                                                    {isStaleActive(ride) && !['completed', 'cancelled'].includes(ride.status) && (
                                                        <span className="font-mono text-[10px] font-semibold uppercase text-warn">stalled</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-3 border-b border-line/60"><div className="h-14 skeleton" /></div>
                                ))
                            ) : visibleRides.length === 0 ? (
                                <div className="px-5 py-12 text-center">
                                    <p className="text-[13px] font-medium text-fg-2">No rides here</p>
                                </div>
                            ) : (
                                visibleRides.map((ride) => (
                                    <button
                                        key={ride.id} onClick={() => setSelectedRide(ride)}
                                        style={{ '--stripe-color': statusStripe(ride.status) }}
                                        className="stripe w-full px-4 py-3 text-left border-b border-line/60 last:border-b-0 hover:bg-raised transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className={statusStyle(ride.status)}>{statusLabel(ride.status)}</span>
                                            <span className="font-mono text-[13px] font-semibold text-fg">{formatCurrency(ride.fare)}</span>
                                        </div>
                                        <div className="text-[13px] font-medium truncate text-fg">{ride.pickupName || '—'}</div>
                                        <div className="text-xs truncate text-fg-3">→ {ride.destName || '—'}</div>
                                        <div className="mt-1 font-mono text-[10px] text-fg-3">
                                            {ride.driverName || 'UNASSIGNED'} &middot; {formatAge(ride.requestTime)}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {feed.atLimit && (
                        <p className="font-mono text-[10px] text-center text-fg-3">
                            Showing the 200 most recent &middot; narrow the search to find older ones
                        </p>
                    )}

                    {feed.hasMore && !loading && (
                        <div className="flex justify-center">
                            <button
                                onClick={handleLoadMore} disabled={loadingMore}
                                className="btn btn-default"
                            >
                                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {loadingMore ? 'Loading' : 'Load more'}
                            </button>
                        </div>
                    )}

                    {!loading && visibleRides.length > 0 && (
                        <p className="font-mono text-[10px] text-center text-fg-3">
                            Newest first &middot; oldest shown {formatDateTime(visibleRides[visibleRides.length - 1]?.requestTime)}
                        </p>
                    )}
                </>
            )}

            <RideDetailDrawer
                ride={selectedRide}
                isOpen={!!selectedRide}
                onClose={() => setSelectedRide(null)}
            />
        </div>
    );
}
