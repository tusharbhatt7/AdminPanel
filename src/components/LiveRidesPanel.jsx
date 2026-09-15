import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Navigation, MapPinOff } from 'lucide-react';
import { statusStyle, statusLabel, formatAge, formatCurrency } from '../lib/rideStatus';

const mapsRoute = (r) =>
    typeof r.pickupLat === 'number' && typeof r.destLat === 'number'
        ? `https://www.google.com/maps/dir/?api=1&origin=${r.pickupLat},${r.pickupLng}&destination=${r.destLat},${r.destLng}`
        : null;

/**
 * Stands in for the mockup's live map. Rendering Delhi streets needs a keyed
 * tile provider; until there is one, the useful half of that panel — which rides
 * are in flight and where they are going — works with no key at all, and each
 * row opens the real coordinates in Google Maps.
 */
export default function LiveRidesPanel({ rides, loading = false }) {
    return (
        <div className="flex flex-col p-4 border rounded-xl bg-surface border-line lift">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-fg">Live Rides</h3>
                    {!loading && rides.length > 0 && (
                        <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.1em] uppercase text-ok">
                            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> Live
                        </span>
                    )}
                </div>
                <Link to="/rides?status=active" className="text-[12px] font-medium text-link hover:underline">View All</Link>
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 skeleton" />)}
                </div>
            ) : rides.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                    <MapPinOff className="w-6 h-6 mb-2 text-fg-3 opacity-50" />
                    <p className="text-[13px] text-fg-3">No rides in flight right now.</p>
                </div>
            ) : (
                <ul className="flex flex-col divide-y divide-line/60">
                    {rides.map((r) => {
                        const link = mapsRoute(r);
                        return (
                            <li key={r.id} className="flex items-center gap-3 py-2">
                                <Navigation className="w-3.5 h-3.5 shrink-0 text-info" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-medium truncate text-fg">
                                        {r.pickupName || 'Pickup'} <span className="text-fg-3">→</span> {r.destName || 'Drop'}
                                    </p>
                                    <p className="font-mono text-[10px] text-fg-3">
                                        {r.driverName || 'unassigned'} &middot; {formatAge(r.requestTime)}
                                    </p>
                                </div>
                                <span className="font-mono text-[12px] font-semibold text-fg shrink-0">{formatCurrency(r.fare)}</span>
                                <span className={`${statusStyle(r.status)} shrink-0 hidden sm:inline-flex`}>{statusLabel(r.status)}</span>
                                {link && (
                                    <a
                                        href={link} target="_blank" rel="noreferrer"
                                        aria-label="Open route in Google Maps"
                                        className="p-1 rounded text-fg-3 hover:text-link shrink-0"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <p className="mt-auto pt-3 text-[10px] leading-snug text-fg-3">
                Map view needs a Google Maps or Mapbox key — rows open the real coordinates meanwhile.
            </p>
        </div>
    );
}
