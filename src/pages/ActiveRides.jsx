import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Car, Clock, PlayCircle, AlertTriangle, RefreshCw, Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { PERMISSIONS } from '../lib/roles';
import ActiveRideList from '../components/ActiveRideList';
import ActiveRideDetail from '../components/ActiveRideDetail';
import {
    listenActiveRides, listenAllDriverPositions, listenPassengerPosition,
    fetchDriverLastLocation,
} from '../services/liveTrackingService';
import { normaliseRide, deriveIssues, AWAITING_STATUSES, IN_PROGRESS_STATUSES } from '../lib/activeRides';
import { toDate } from '../lib/rideStatus';
import { toneChip, toneText } from '../lib/tones';

/**
 * Active Rides — the dispatch console.
 *
 * Two sources joined on assignedDriverId: Firestore knows which rides are in
 * flight, RTDB knows where each driver is. Driver positions arrive as one
 * listener on the whole active_drivers node rather than one per ride; twenty
 * rides would otherwise be twenty sockets for a payload that comes down in a
 * single message.
 */

// A trail point closer than this to the last one is noise, not movement.
const TRAIL_MIN_METRES = 5;
const TRAIL_MAX_POINTS = 300;

const metresBetween = (a, b) => {
    const R = 6_371_000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.lat);
    const dLng = toRad(b.longitude - a.lng);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

const Kpi = ({ icon: Icon, value, label, hint, hintTone, tone }) => (
    <div className="flex items-start gap-3 p-4 border rounded-xl bg-surface border-line lift">
        <div className={`grid w-11 h-11 rounded-xl shrink-0 place-items-center ${toneChip(tone ?? 'info')}`}>
            {Icon ? <Icon className="w-5 h-5" /> : null}
        </div>
        <div className="min-w-0">
            <p className="text-[26px] font-bold leading-none text-fg tabular">{value}</p>
            <p className="mt-1.5 text-[13px] font-semibold leading-none text-fg">{label}</p>
            {hint && (
                <p className={`mt-1.5 text-[11px] leading-tight ${hintTone ? toneText(hintTone) : 'text-fg-3'}`}>
                    {hint}
                </p>
            )}
        </div>
    </div>
);

export default function ActiveRides() {
    const { actor, can } = useAuth();
    const canCancel = can(PERMISSIONS.RIDES_READ) && can(PERMISSIONS.DRIVERS_WRITE);

    const [params, setParams] = useSearchParams();
    const selectedId = params.get('ride');

    const [rides, setRides] = useState(null);
    const [positions, setPositions] = useState({});
    const [lastKnown, setLastKnown] = useState({});
    const [passenger, setPassenger] = useState(null);
    const [trails, setTrails] = useState({});
    const [includeSearching, setIncludeSearching] = useState(true);
    const [error, setError] = useState(null);
    const [fullscreen, setFullscreen] = useState(false);

    // Bumping this re-creates both listeners, which forces a fresh server read.
    // The feed is already live, so Refresh is for the moment an operator stops
    // trusting the screen — it has to actually re-fetch, not just re-render.
    const [generation, setGeneration] = useState(0);
    const [lastSync, setLastSync] = useState(null);

    // A ticking clock, passed into every freshness label so they all agree and
    // none of them freeze between snapshots.
    const [now, setNow] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => listenActiveRides(
        (list) => { setRides(list); setLastSync(Date.now()); },
        () => { setRides([]); setError('rides'); },
        { includeSearching },
    ), [includeSearching, generation]);

    useEffect(
        () => listenAllDriverPositions(setPositions, () => setError('positions')),
        [generation],
    );

    const normalised = useMemo(() => (rides ?? []).map(normaliseRide), [rides]);

    const assignedDriverIds = useMemo(
        () => [...new Set(normalised.map((r) => r.driverId).filter(Boolean))],
        [normalised],
    );

    // A driver on a live ride who is absent from active_drivers has lost
    // connection. Their last-known position still helps, so it is read once and
    // always flagged stale.
    const fetchedRef = useRef(new Set());
    useEffect(() => {
        const live = new Set(assignedDriverIds);
        fetchedRef.current.forEach((id) => { if (!live.has(id)) fetchedRef.current.delete(id); });

        const missing = assignedDriverIds.filter((id) => !positions[id] && !fetchedRef.current.has(id));
        if (!missing.length) return undefined;

        missing.forEach((id) => fetchedRef.current.add(id));
        let cancelled = false;
        (async () => {
            const found = await Promise.all(missing.map(async (id) => [id, await fetchDriverLastLocation(id)]));
            if (!cancelled) setLastKnown((prev) => ({ ...prev, ...Object.fromEntries(found.filter(([, p]) => p)) }));
        })();
        return () => { cancelled = true; };
    }, [assignedDriverIds, positions]);

    // Breadcrumbs: where each driver has actually been while this tab has been
    // open. Nothing stores a position history, so this is session-scoped and
    // starts empty on reload — it is shown as the travelled path, never as the
    // whole journey.
    //
    // Kept in a ref and mirrored into state so appending a point does not
    // depend on the previous render having committed; RTDB can deliver several
    // fixes between paints.
    const trailRef = useRef({});
    useEffect(() => {
        let changed = false;

        for (const [driverId, position] of Object.entries(positions)) {
            if (position.stale) continue;
            const points = trailRef.current[driverId] ?? [];
            const last = points[points.length - 1];
            // Below five metres is receiver noise, and plotting it draws a
            // scribble over a parked car.
            if (last && metresBetween(last, position) < TRAIL_MIN_METRES) continue;

            trailRef.current[driverId] = [
                ...points.slice(-(TRAIL_MAX_POINTS - 1)),
                { lat: position.latitude, lng: position.longitude },
            ];
            changed = true;
        }

        // Drop drivers who are no longer on a tracked ride, so a long shift
        // does not accumulate paths for cars that finished hours ago.
        const live = new Set(assignedDriverIds);
        for (const id of Object.keys(trailRef.current)) {
            if (!live.has(id)) { delete trailRef.current[id]; changed = true; }
        }

        if (changed) setTrails({ ...trailRef.current });
    }, [positions, assignedDriverIds]);

    const visibleLastKnown = useMemo(() => {
        const live = new Set(assignedDriverIds);
        return Object.fromEntries(Object.entries(lastKnown).filter(([id]) => live.has(id)));
    }, [lastKnown, assignedDriverIds]);

    const positionFor = useCallback(
        (driverId) => (driverId ? positions[driverId] ?? visibleLastKnown[driverId] ?? null : null),
        [positions, visibleLastKnown],
    );

    // One pass that pairs each ride with its position and its derived problems,
    // so the list, the counters and the detail panel never disagree about
    // whether a ride is in trouble.
    const entries = useMemo(() => normalised.map((ride) => {
        const position = positionFor(ride.driverId);
        return {
            ride,
            position,
            issues: deriveIssues(ride, position, now),
            requestedMs: toDate(ride.requestTime)?.getTime() ?? 0,
        };
    }), [normalised, positionFor, now]);

    const selected = entries.find((e) => e.ride.id === selectedId) ?? null;

    // The passenger stream is attached only for the ride being looked at — one
    // document, and only while its panel is open.
    useEffect(() => {
        if (!selectedId) return undefined;
        return listenPassengerPosition(selectedId, (position) => setPassenger({ rideId: selectedId, position }));
    }, [selectedId]);

    const select = (id) => setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('ride', id); else next.delete('ride');
        return next;
    }, { replace: true });

    // A ride that ends while open should not strand the panel on a stale
    // document, but clearing the selection outright would yank the screen away
    // mid-read. The detail panel keeps rendering what it has; only the list
    // stops offering it.
    const stats = useMemo(() => ({
        total: entries.length,
        awaiting: entries.filter((e) => AWAITING_STATUSES.includes(e.ride.status)).length,
        progress: entries.filter((e) => IN_PROGRESS_STATUSES.includes(e.ride.status)).length,
        attention: entries.filter((e) => e.issues.length > 0).length,
    }), [entries]);

    const attentionHint = useMemo(() => {
        const labels = entries.flatMap((e) => e.issues.map((i) => i.label));
        if (!labels.length) return 'All rides healthy';
        const tally = labels.reduce((acc, l) => ({ ...acc, [l]: (acc[l] ?? 0) + 1 }), {});
        return Object.entries(tally).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ');
    }, [entries]);

    return (
        <div className={fullscreen ? 'fixed inset-0 z-50 flex flex-col gap-4 p-4 overflow-y-auto bg-canvas' : 'flex flex-col gap-4'}>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-[20px] font-bold tracking-tight text-fg">Active Rides</h1>
                        {rides !== null && (
                            <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.1em] uppercase text-ok">
                                <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> Live
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-fg-2">Monitor every ride in flight and handle problems as they appear.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-fg-3">
                        {lastSync ? `Synced ${new Date(lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                    </span>
                    <button
                        type="button" onClick={() => setIncludeSearching((v) => !v)}
                        className={`btn btn-sm ${includeSearching ? 'btn-primary' : 'btn-default'}`}
                    >
                        Include searching
                    </button>
                    <button type="button" onClick={() => setGeneration((g) => g + 1)} className="btn btn-default btn-sm">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button
                        type="button" onClick={() => setFullscreen((v) => !v)}
                        aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                        className="btn btn-default btn-sm"
                    >
                        {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                    icon={Car} value={stats.total} label="Active Rides" tone="info"
                    hint={includeSearching ? 'Including rides still searching' : 'Driver assigned'}
                />
                <Kpi
                    icon={Clock} value={stats.awaiting} label="Awaiting Pickup" tone="warn"
                    hint="Driver on the way" hintTone={stats.awaiting ? 'warn' : null}
                />
                <Kpi
                    icon={PlayCircle} value={stats.progress} label="In Progress" tone="ok"
                    hint="Passenger or parcel aboard"
                />
                <Kpi
                    icon={AlertTriangle} value={stats.attention} label="Needs Attention"
                    tone={stats.attention ? 'danger' : 'ok'}
                    hint={attentionHint} hintTone={stats.attention ? 'danger' : 'ok'}
                />
            </div>

            {error === 'positions' && (
                <p className="flex items-start gap-2 p-3 text-[12px] border rounded-lg border-warn/40 bg-warn-soft text-fg-2">
                    <AlertCircle className="w-4 h-4 mt-px shrink-0 text-warn" />
                    Driver positions are unavailable, so every ride will read as “no signal”. Check that
                    <span className="font-mono text-fg"> VITE_FIREBASE_DATABASE_URL</span> is set and that the Realtime
                    Database rules let an admin read <span className="font-mono text-fg">active_drivers</span>.
                </p>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,33rem)_minmax(0,1fr)]">
                <ActiveRideList
                    entries={entries}
                    loading={rides === null}
                    selectedId={selectedId}
                    onSelect={(id) => select(id === selectedId ? null : id)}
                />
                <ActiveRideDetail
                    ride={selected?.ride ?? null}
                    position={selected?.position ?? null}
                    passenger={passenger?.rideId === selectedId ? passenger : null}
                    trail={selected?.ride.driverId ? trails[selected.ride.driverId] : null}
                    actor={actor}
                    canCancel={canCancel}
                    onClose={() => select(null)}
                />
            </div>
        </div>
    );
}
