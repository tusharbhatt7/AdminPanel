// Loader for the Google Maps JavaScript API.
//
// The script tag may only be injected once per page: a second one throws
// "You have included the Google Maps JavaScript API multiple times" and the
// map silently stops responding. React's strict mode double-invokes effects in
// development, so a module-level promise — not component state — is what makes
// the load idempotent.

const CALLBACK = '__fcGoogleMapsReady';

let loadPromise = null;

/** Set by Google when the key is rejected. Read by the map to explain itself. */
export const authFailure = { failed: false };

export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const loadGoogleMaps = () => {
    if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
    if (loadPromise) return loadPromise;

    if (!MAPS_API_KEY) {
        return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set.'));
    }

    loadPromise = new Promise((resolve, reject) => {
        // Google calls this global on an auth failure — a bad key, a blocked
        // API, or a referrer the key does not allow. It is the only signal for
        // those: the script itself still loads and returns 200, and the map
        // just renders grey. Same shape of trap as a tile server answering 200
        // with a watermark, so it has to be handled explicitly.
        window.gm_authFailure = () => {
            authFailure.failed = true;
            window.dispatchEvent(new Event('fc-maps-auth-failure'));
        };

        window[CALLBACK] = () => {
            delete window[CALLBACK];
            resolve(window.google.maps);
        };

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js`
            + `?key=${encodeURIComponent(MAPS_API_KEY)}`
            + `&callback=${CALLBACK}&loading=async&v=weekly`;
        script.async = true;
        script.onerror = () => {
            loadPromise = null;
            reject(new Error('Google Maps script failed to load.'));
        };
        document.head.appendChild(script);
    });

    return loadPromise;
};

/**
 * Resolve a design token to a real colour.
 *
 * Google's marker Symbols take colour strings and cannot read CSS variables,
 * so `var(--c-info)` would be ignored and markers would fall back to black.
 * Reading the computed value keeps the map on the same palette as the panel,
 * in both themes.
 */
export const token = (name, fallback = '#888888') => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return value?.trim() || fallback;
};

// Dark styling via the classic `styles` array rather than a cloud-styled
// mapId. A mapId would unlock AdvancedMarkerElement, but it has to be created
// and styled in the Cloud console first — this keeps the dark map working from
// the repo alone, with no console setup to forget when someone redeploys.

// Google's default POI pins are the loudest thing on the map: dozens of
// saturated icons for restaurants and shops, each the same size as a driver.
// On a dispatch screen the cars are the content and everything else is
// context, so the pins come off in both themes. Place *names* stay — they are
// how an operator says where a driver is.
const DECLUTTER = [
    { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export const DARK_STYLE = [
    ...DECLUTTER,
    { elementType: 'geometry', stylers: [{ color: '#1a2537' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1420' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9fb0c6' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2f4059' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#e6edf6' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7d94' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16301f' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#223045' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#131c2b' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a99ab' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2f4059' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0d1420' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#223045' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1a2b' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#40566f' }] },
];

// Light keeps Google's own palette — it is already legible on white — and only
// takes the decluttering, so the two themes agree about what belongs on a
// dispatch map even though they do not agree about colour.
export const LIGHT_STYLE = [...DECLUTTER];

export const styleFor = (theme) => (theme === 'dark' ? DARK_STYLE : LIGHT_STYLE);
