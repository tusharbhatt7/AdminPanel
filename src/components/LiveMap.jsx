import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, authFailure, MAPS_API_KEY, token, styleFor } from '../lib/googleMaps';

/**
 * The live map.
 *
 * The Maps API is driven imperatively rather than through a React wrapper on
 * purpose: positions arrive every few seconds per driver, and re-rendering a
 * component tree for each one would rebuild markers that should simply move.
 * Markers are cached by id and mutated in place, so a driver crossing the city
 * is one setPosition call, not a remount.
 */

// Padding around a fitted bounds, and the zoom range a fit may settle on.
const FIT_PADDING = 40;
const FIT_MAX_ZOOM = 15;
const FIT_MIN_ZOOM = 11;

// Centred on India so an empty map is not the middle of the Atlantic.
const FALLBACK_CENTRE = { lat: 20.5937, lng: 78.9629 };
const FALLBACK_ZOOM = 5;

const readTheme = () => (document.documentElement.classList.contains('light') ? 'light' : 'dark');

/**
 * A car that points where it is going.
 *
 * Symbols take a rotation in degrees clockwise from north, which is exactly
 * what the driver app publishes as `heading` — so the arrow can be pointed
 * without any trigonometry here.
 */
const driverIcon = (maps, heading, { stale, selected }) => ({
    path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: selected ? 6.5 : 5.5,
    rotation: heading ?? 0,
    fillColor: stale ? token('--c-fg-3') : selected ? token('--c-brand') : token('--c-info'),
    fillOpacity: 1,
    strokeColor: token('--c-surface'),
    strokeWeight: 2,
});

/** Pickup, drop and passenger are static points — a dot reads faster than a pin. */
const dotIcon = (maps, colourToken) => ({
    path: maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: token(colourToken),
    fillOpacity: 1,
    strokeColor: token('--c-surface'),
    strokeWeight: 2,
});

const DOT_TOKENS = {
    pickup: '--c-ok',
    drop: '--c-danger',
    passenger: '--c-violet',
};

const DOT_LABELS = { pickup: 'P', drop: 'D', passenger: 'R' };

// ── Motion ───────────────────────────────────────────────────────────────────
//
// A GPS fix arrives every few seconds, so setting the position directly makes
// the car teleport between points. Gliding across the segment is what reads as
// a vehicle moving rather than a dot blinking to a new place.
//
// The important limit: this is a visual smoothing, not data. If a driver drops
// out for half a minute and reappears three streets away, animating that gap
// would draw a confident path along a road they may never have taken. Past the
// thresholds below the marker snaps instead, so the map never shows movement
// that was not measured.

const GLIDE_MAX_GAP_MS = 10_000;   // longer silence than this is a reconnect, not travel
const GLIDE_MAX_METRES = 400;      // further than this in one fix is a GPS jump
const GLIDE_MIN_METRES = 1.5;      // below this it is receiver noise; moving looks like jitter
const GLIDE_MS = 900;              // long enough to read as motion, short enough to stay current

const metresBetween = (a, b) => {
    const R = 6_371_000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

const prefersReducedMotion = () =>
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const stopGlide = (marker) => {
    if (marker.__fcRaf) cancelAnimationFrame(marker.__fcRaf);
    marker.__fcRaf = null;
};

/**
 * Move a marker to `target`, animating when the step looks like real travel.
 * `gapMs` is the time between the two fixes, not the time since render.
 */
const moveMarker = (marker, target, gapMs) => {
    const current = marker.getPosition();
    const from = current ? { lat: current.lat(), lng: current.lng() } : null;

    const distance = from ? metresBetween(from, target) : Infinity;

    const snap = !from
        || prefersReducedMotion()
        || distance > GLIDE_MAX_METRES
        || distance < GLIDE_MIN_METRES
        || (gapMs != null && gapMs > GLIDE_MAX_GAP_MS);

    stopGlide(marker);

    if (snap) {
        marker.setPosition(target);
        return;
    }

    const start = performance.now();
    const step = (now) => {
        // Clamped, so a backgrounded tab resuming after minutes finishes the
        // glide rather than racing the marker across the city.
        const t = Math.min(1, (now - start) / GLIDE_MS);
        marker.setPosition({
            lat: from.lat + (target.lat - from.lat) * t,
            lng: from.lng + (target.lng - from.lng) * t,
        });
        marker.__fcRaf = t < 1 ? requestAnimationFrame(step) : null;
    };
    marker.__fcRaf = requestAnimationFrame(step);
};

export default function LiveMap({
    markers = [],
    route = null,
    routeIsRoad = true,
    approach = null,
    trail = null,
    focusId = null,
    onSelect,
    className = '',
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const mapsRef = useRef(null);
    const markerRefs = useRef(new Map());
    const routeRef = useRef(null);
    const approachRef = useRef(null);
    const trailRef = useRef(null);
    const didFitRef = useRef(false);
    const fittedWithRouteRef = useRef(false);

    const [theme, setTheme] = useState(readTheme);
    // A failure that happened before this mount (navigating back to the page
    // after Google rejected the key) is read in the initialiser rather than
    // set from the effect below — otherwise the map renders once as 'loading'
    // and only then admits it is broken.
    const [status, setStatus] = useState(() => {
        if (!MAPS_API_KEY) return 'no-key';
        return authFailure.failed ? 'auth' : 'loading';
    });

    // Create once. A map torn down and rebuilt loses the operator's pan and
    // zoom, which on a dispatch screen is the whole point of the view.
    useEffect(() => {
        if (!MAPS_API_KEY) return undefined;

        let cancelled = false;
        const cached = markerRefs.current;

        loadGoogleMaps()
            .then((maps) => {
                if (cancelled || !containerRef.current || mapRef.current) return;

                mapsRef.current = maps;
                mapRef.current = new maps.Map(containerRef.current, {
                    center: FALLBACK_CENTRE,
                    zoom: FALLBACK_ZOOM,
                    styles: styleFor(readTheme()),
                    disableDefaultUI: true,
                    zoomControl: true,
                    // Dispatch reads a map; it does not need Street View or the
                    // satellite toggle, and both steal space on a narrow panel.
                    clickableIcons: false,
                });
                setStatus('ready');
            })
            .catch((error) => {
                console.error('Google Maps failed to load:', error);
                if (!cancelled) setStatus('error');
            });

        return () => {
            cancelled = true;
            cached.forEach((marker) => { stopGlide(marker); marker.setMap(null); });
            cached.clear();
            routeRef.current?.setMap(null); routeRef.current = null;
            approachRef.current?.setMap(null); approachRef.current = null;
            trailRef.current?.setMap(null); trailRef.current = null;
            mapRef.current = null;
        };
    }, []);

    // An auth failure arrives long after the script resolves, so it is an
    // event rather than a rejected promise.
    useEffect(() => {
        const onFail = () => setStatus('auth');
        window.addEventListener('fc-maps-auth-failure', onFail);
        return () => window.removeEventListener('fc-maps-auth-failure', onFail);
    }, []);

    // The theme toggle stamps a class on <html>; the map styling has to follow
    // it or a daylight map sits inside a dark panel.
    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(readTheme()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (mapRef.current) mapRef.current.setOptions({ styles: styleFor(theme) });
    }, [theme]);

    // Reconcile markers: move the ones that exist, add the new, drop the gone.
    useEffect(() => {
        const map = mapRef.current;
        const maps = mapsRef.current;
        if (!map || !maps) return;

        const seen = new Set();

        for (const m of markers) {
            if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
            seen.add(m.id);

            const position = { lat: m.lat, lng: m.lng };
            const isDriver = m.kind === 'driver';

            // Rebuilding the icon object on every tick would repaint every
            // marker for a driver that only moved. The signature covers
            // everything the icon depends on, so it is rebuilt only when it
            // would actually differ.
            const signature = `${m.kind}|${Math.round(m.heading ?? 0)}|${m.stale ? 1 : 0}|${m.id === focusId ? 1 : 0}|${theme}`;

            const existing = markerRefs.current.get(m.id);
            if (existing) {
                // Only a genuinely new target restarts the animation. The
                // markers array is rebuilt every few seconds to refresh the
                // fix age, and re-gliding to the position the marker is
                // already heading for would reset it mid-flight and stutter.
                const target = `${position.lat},${position.lng}`;
                if (existing.__fcTarget !== target) {
                    const gapMs = existing.__fcFixAt && m.fixAt ? m.fixAt - existing.__fcFixAt : null;
                    moveMarker(existing, position, gapMs);
                    existing.__fcTarget = target;
                    existing.__fcFixAt = m.fixAt ?? null;
                }
                if (existing.__fcSignature !== signature) {
                    existing.setIcon(isDriver
                        ? driverIcon(maps, m.heading, { stale: m.stale, selected: m.id === focusId })
                        : dotIcon(maps, DOT_TOKENS[m.kind] ?? DOT_TOKENS.pickup));
                    existing.__fcSignature = signature;
                }
                if (m.label) existing.setTitle(m.label);
                continue;
            }

            const marker = new maps.Marker({
                position,
                map,
                title: m.label ?? '',
                icon: isDriver
                    ? driverIcon(maps, m.heading, { stale: m.stale, selected: m.id === focusId })
                    : dotIcon(maps, DOT_TOKENS[m.kind] ?? DOT_TOKENS.pickup),
                label: isDriver ? null : {
                    text: DOT_LABELS[m.kind] ?? '',
                    color: token('--c-surface'),
                    fontSize: '9px',
                    fontWeight: '700',
                },
                zIndex: isDriver ? 2 : 1,
            });
            marker.__fcSignature = signature;
            marker.__fcTarget = `${position.lat},${position.lng}`;
            marker.__fcFixAt = m.fixAt ?? null;

            // Only markers that belong to a ride are selectable. Clicking an
            // idle driver would otherwise set the selection to an id no ride
            // matches, silently clearing whichever ride was open.
            if (onSelect && m.rideId) marker.addListener('click', () => onSelect(m.rideId));

            markerRefs.current.set(m.id, marker);
        }

        for (const [id, marker] of markerRefs.current) {
            if (seen.has(id)) continue;
            stopGlide(marker);
            marker.setMap(null);
            markerRefs.current.delete(id);
        }

        // Fit once, on the first markers to arrive. Refitting on every update
        // would yank the view back each time a driver moves, making the map
        // impossible to pan.
        //
        // The fit is deferred to the map's next idle. Google sizes the viewport
        // from the container, and this effect can run while the panel is still
        // laying out — fitting then computes against the wrong height and lands
        // two or three zoom levels too wide, which is how a 5 km ride came to
        // be drawn across 30 km of Delhi.
        // The route arrives a second or so after the markers, from a network
        // call. Fitting only once would frame the endpoints and let the road
        // between them bulge off screen, so the arrival of a route earns one
        // more fit — and exactly one, or panning would be impossible.
        const hasRoute = (route?.length ?? 0) > 0;
        if (hasRoute && didFitRef.current && !fittedWithRouteRef.current) {
            didFitRef.current = false;
        }
        if (hasRoute) fittedWithRouteRef.current = true;

        if (!didFitRef.current && seen.size > 0) {
            const bounds = new maps.LatLngBounds();
            let count = 0;
            for (const m of markers) {
                if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
                bounds.extend({ lat: m.lat, lng: m.lng });
                count += 1;
            }
            // Include the route: a road that loops out of the box between two
            // nearby endpoints would otherwise be framed out of view.
            for (const p of route ?? []) { bounds.extend(p); count += 1; }
            if (count) {
                didFitRef.current = true;

                const clamp = () => {
                    // One marker fits to maximum zoom, which lands on a roof.
                    // A tight cluster does much the same, so the zoom is capped
                    // either way and floored so a long ride stays readable.
                    const zoom = map.getZoom();
                    if (count === 1 || zoom > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM);
                    else if (zoom < FIT_MIN_ZOOM) map.setZoom(FIT_MIN_ZOOM);
                };

                const applyFit = () => {
                    map.fitBounds(bounds, FIT_PADDING);
                    maps.event.addListenerOnce(map, 'idle', clamp);
                };

                // getBounds() is only defined once the map has drawn a
                // viewport, which makes it the test for "is it safe to fit
                // yet". Waiting unconditionally for `idle` does not work: a map
                // that has already settled fires it only on the next viewport
                // change, so the fit would wait for a change that never comes
                // and the ride stayed drawn across the whole city.
                if (map.getBounds()) applyFit();
                else maps.event.addListenerOnce(map, 'idle', applyFit);
            }
        }
    }, [markers, route, focusId, onSelect, theme, status]);

    // The planned route, pickup to drop.
    //
    // Drawn dashed and grey when it is not a real road route — a straight line
    // between two points looks authoritative at a glance, and someone deciding
    // whether a driver is off course must be able to tell a measured route from
    // two coordinates joined with a ruler.
    useEffect(() => {
        const map = mapRef.current;
        const maps = mapsRef.current;
        if (!map || !maps) return;

        if (!route?.length) {
            routeRef.current?.setMap(null);
            routeRef.current = null;
            return;
        }

        const options = routeIsRoad
            ? {
                strokeColor: token('--c-info'),
                strokeOpacity: 0.95,
                strokeWeight: 5,
            }
            : {
                // Dashed: icons every 12px with the stroke itself invisible.
                strokeOpacity: 0,
                strokeWeight: 0,
                icons: [{
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, strokeWeight: 3, scale: 3, strokeColor: token('--c-fg-3') },
                    offset: '0',
                    repeat: '12px',
                }],
            };

        if (routeRef.current) {
            routeRef.current.setPath(route);
            routeRef.current.setOptions(options);
        } else {
            routeRef.current = new maps.Polyline({ ...options, path: route, map, zIndex: 1 });
        }
    }, [route, routeIsRoad, status]);

    // Where the driver has actually been this session. Distinct from the route
    // on purpose: one is the plan, the other is what happened, and the gap
    // between them is the thing a dispatcher is looking for.
    useEffect(() => {
        const map = mapRef.current;
        const maps = mapsRef.current;
        if (!map || !maps) return;

        if (!trail || trail.length < 2) {
            trailRef.current?.setMap(null);
            trailRef.current = null;
            return;
        }

        // Where the driver has been.
        //
        // Solid and in the foreground tone. Two subtler treatments were tried
        // and both vanished: --c-fg-3 is close to the colour of the roads it
        // runs along, and dashing it at weight 4 left too little ink to find
        // on a busy basemap. Yellow is not available either -- that is now the
        // approach leg, and two yellow lines on one map are one line.
        const options = {
            strokeColor: token('--c-fg'),
            strokeOpacity: 0.7,
            strokeWeight: 3,
        };

        if (trailRef.current) {
            trailRef.current.setPath(trail);
            trailRef.current.setOptions(options);
        } else {
            trailRef.current = new maps.Polyline({ ...options, path: trail, map, zIndex: 2 });
        }
    }, [trail, status]);

    // Driver to pickup, while the driver is still on their way there.
    //
    // Drawn straight rather than along roads on purpose. A road route would
    // re-request directions every few metres the car moves — the cache keys on
    // ~11m of precision — and bill for each one. The useful fact here is how
    // far apart the two are and in which direction, which a straight line
    // carries honestly; it is visibly a connector, not a claimed path.
    useEffect(() => {
        const map = mapRef.current;
        const maps = mapsRef.current;
        if (!map || !maps) return;

        if (!approach || approach.length < 2) {
            approachRef.current?.setMap(null);
            approachRef.current = null;
            return;
        }

        const options = {
            strokeColor: token('--c-brand'),
            strokeOpacity: 0.95,
            strokeWeight: 4,
        };

        if (approachRef.current) {
            approachRef.current.setPath(approach);
            approachRef.current.setOptions(options);
        } else {
            approachRef.current = new maps.Polyline({ ...options, path: approach, map, zIndex: 3 });
        }
    }, [approach, status]);

    // Selecting a ride in the list centres it — the one time the view should move.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !focusId) return;
        const target = markers.find((m) => m.kind === 'driver' && m.rideId === focusId)
            ?? markers.find((m) => m.rideId === focusId);
        if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
            map.panTo({ lat: target.lat, lng: target.lng });
            if (map.getZoom() < 14) map.setZoom(14);
        }
    }, [focusId, markers]);

    if (status !== 'ready' && status !== 'loading') {
        return (
            <div className={`${className} grid place-items-center p-6 text-center`} style={{ background: 'var(--c-raised)' }}>
                <div className="max-w-sm">
                    <p className="text-[13px] font-medium text-fg">
                        {status === 'no-key' ? 'The map needs an API key.' : 'The map could not load.'}
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-fg-2">
                        {status === 'no-key' && (
                            <>Set <span className="font-mono text-fg">VITE_GOOGLE_MAPS_API_KEY</span> for this deployment
                            and restart. The ride list beside this map works without one.</>
                        )}
                        {status === 'auth' && (
                            <>Google rejected the key. Check that the Maps JavaScript API is enabled, that billing is on,
                            and that this domain is allowed by the key’s referrer restrictions.</>
                        )}
                        {status === 'error' && 'The Google Maps script did not load. Check the network tab.'}
                    </p>
                </div>
            </div>
        );
    }

    return <div ref={containerRef} className={className} style={{ background: 'var(--c-raised)' }} />;
}
