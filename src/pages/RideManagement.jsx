import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, AlertCircle, ExternalLink, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { fetchRidesPage, listenToRides } from '../services/rideService';
import RideDetailDrawer from '../components/RideDetailDrawer';
import {
    RIDE_PRESETS, isRidePreset, statusStyle, statusLabel,
    formatAge, formatDateTime, formatCurrency, isStaleActive, STALE_ACTIVE_HOURS,
} from '../lib/rideStatus';

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
        <div className="space-y-6">
            <div>
                <Link to="/dashboard" className="inline-flex items-center gap-1.5 mb-3 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to overview
                </Link>
                <h2 className="text-2xl font-bold text-slate-800">{preset.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{preset.blurb}</p>
            </div>

            {/* Preset tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(RIDE_PRESETS).map(([key, p]) => (
                    <button
                        key={key}
                        onClick={() => setSearchParams(key === 'all' ? {} : { status: key }, { replace: true })}
                        className={`px-3.5 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${key === presetKey
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {staleCount > 0 && (
                <div className="flex items-start gap-2 p-3 text-sm border rounded-xl bg-amber-50 border-amber-200 text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                        <strong>{staleCount}</strong> of these have sat in an active status for over {STALE_ACTIVE_HOURS} hours.
                        They are almost certainly abandoned rides that were never closed out, not rides in progress.
                    </span>
                </div>
            )}

            {/* Search + count */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search route, driver, vehicle, ride ID..."
                        className="w-full py-2.5 pl-9 pr-4 text-sm bg-white border rounded-lg border-slate-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                </div>
                <div className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{visibleRides.length}</span>
                    {preset.live && <span className="ml-2 text-xs font-medium text-emerald-600">● live</span>}
                </div>
            </div>

            {feed.status === 'error' ? (
                <div className="p-6 text-center bg-white border rounded-2xl border-rose-200">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 text-rose-500" />
                    <h3 className="font-semibold text-slate-800">
                        {isIndexError ? 'This view needs a Firestore index' : 'Could not load rides'}
                    </h3>
                    <p className="max-w-md mx-auto mt-2 text-sm text-slate-500">
                        {isIndexError
                            ? 'The composite index for this filter is still building, which usually takes a few minutes. Reload once it is ready.'
                            : feed.error?.message || 'Something went wrong talking to Firestore.'}
                    </p>
                    {indexUrl && (
                        <a href={indexUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                            Check index status <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
            ) : (
                <>
                    <div className="overflow-hidden bg-white border rounded-2xl border-slate-200">
                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-sm">
                                <thead className="text-left bg-slate-50 border-b border-slate-200">
                                    <tr className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Route</th>
                                        <th className="px-5 py-3">Fare</th>
                                        <th className="px-5 py-3">Driver</th>
                                        <th className="px-5 py-3">Requested</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <tr key={i}>
                                                <td colSpan={5} className="px-5 py-4">
                                                    <div className="h-5 rounded bg-slate-100 animate-pulse" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : visibleRides.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                                                <p className="font-medium">No rides here</p>
                                                <p className="mt-1 text-sm">
                                                    {search ? 'Try a different search.' : 'Nothing matches this filter yet.'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleRides.map((ride) => (
                                            <tr
                                                key={ride.id}
                                                onClick={() => setSelectedRide(ride)}
                                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${statusStyle(ride.status)}`}>
                                                        {statusLabel(ride.status)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 max-w-xs">
                                                    <div className="font-medium truncate text-slate-800">{ride.pickupName || '—'}</div>
                                                    <div className="text-xs truncate text-slate-500">→ {ride.destName || '—'}</div>
                                                </td>
                                                <td className="px-5 py-3.5 font-medium tabular-nums text-slate-800">
                                                    {formatCurrency(ride.fare)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="truncate text-slate-700">{ride.driverName || <span className="text-slate-400">Unassigned</span>}</div>
                                                    {ride.vehicleNumber && <div className="text-xs text-slate-500">{ride.vehicleNumber}</div>}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="text-slate-700">{formatAge(ride.requestTime)}</div>
                                                    {isStaleActive(ride) && !['completed', 'cancelled'].includes(ride.status) && (
                                                        <span className="text-xs font-medium text-amber-600">stalled</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="divide-y divide-slate-100 md:hidden">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-4"><div className="h-16 rounded bg-slate-100 animate-pulse" /></div>
                                ))
                            ) : visibleRides.length === 0 ? (
                                <div className="px-5 py-12 text-center text-slate-500">
                                    <p className="font-medium">No rides here</p>
                                </div>
                            ) : (
                                visibleRides.map((ride) => (
                                    <button
                                        key={ride.id} onClick={() => setSelectedRide(ride)}
                                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${statusStyle(ride.status)}`}>
                                                {statusLabel(ride.status)}
                                            </span>
                                            <span className="font-semibold text-slate-800">{formatCurrency(ride.fare)}</span>
                                        </div>
                                        <div className="text-sm font-medium truncate text-slate-800">{ride.pickupName || '—'}</div>
                                        <div className="text-xs truncate text-slate-500">→ {ride.destName || '—'}</div>
                                        <div className="mt-1.5 text-xs text-slate-400">
                                            {ride.driverName || 'Unassigned'} &middot; {formatAge(ride.requestTime)}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {feed.atLimit && (
                        <p className="text-xs text-center text-slate-400">
                            Showing the 200 most recent. Narrow the search to find older ones.
                        </p>
                    )}

                    {feed.hasMore && !loading && (
                        <div className="flex justify-center">
                            <button
                                onClick={handleLoadMore} disabled={loadingMore}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white border rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loadingMore ? 'Loading...' : 'Load more'}
                            </button>
                        </div>
                    )}

                    {!loading && visibleRides.length > 0 && (
                        <p className="text-xs text-center text-slate-400">
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
