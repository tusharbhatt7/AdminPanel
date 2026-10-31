import { loadGoogleMaps } from '../lib/googleMaps';

/**
 * Road route between two points, for drawing on the dispatch map.
 *
 * Uses the Maps JavaScript DirectionsService rather than the Directions REST
 * endpoint on purpose. The REST API is a server API and is refused by an
 * HTTP-referrer-restricted key — the restriction the panel's key should carry.
 * The JS service is designed to be called from a browser and works with one.
 *
 * Results are cached for the life of the tab and keyed by rounded coordinates.
 * A ride's endpoints do not move, but its driver position updates every few
 * seconds, and without the cache every one of those would re-request a route
 * that cannot have changed — each one billed.
 */

const cache = new Map();
const inFlight = new Map();

// ~11 m of precision. Enough to tell two pickups apart, coarse enough that
// floating-point noise in the stored coordinates still hits the same entry.
const keyOf = (a, b) =>
    `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * Returns `{ path, distanceText, durationText }`, or null when no route could
 * be had. Null is a real answer — the caller draws a straight line instead and
 * says it is not a route, rather than pretending the road goes that way.
 */
export const fetchRoute = async (origin, destination) => {
    if (!valid(origin) || !valid(destination)) return null;

    const key = keyOf(origin, destination);
    if (cache.has(key)) return cache.get(key);
    // Two panels mounting at once must not fire two identical requests.
    if (inFlight.has(key)) return inFlight.get(key);

    const request = (async () => {
        try {
            await loadGoogleMaps();
            const { DirectionsService, DirectionsStatus } = await window.google.maps.importLibrary('routes');

            const result = await new Promise((resolve, reject) => {
                new DirectionsService().route(
                    {
                        origin,
                        destination,
                        travelMode: window.google.maps.TravelMode.DRIVING,
                    },
                    (res, status) => (status === DirectionsStatus.OK
                        ? resolve(res)
                        : reject(new Error(`Directions ${status}`))),
                );
            });

            const route = result.routes[0];
            const leg = route?.legs?.[0];
            const value = {
                path: route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
                distanceText: leg?.distance?.text ?? null,
                durationText: leg?.duration?.text ?? null,
            };
            cache.set(key, value);
            return value;
        } catch (error) {
            // Most often REQUEST_DENIED (Directions API not enabled on the
            // key) or ZERO_RESULTS. Cached as null so a dead key is not
            // re-asked on every render.
            console.warn('Route unavailable:', error.message);
            cache.set(key, null);
            return null;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, request);
    return request;
};
