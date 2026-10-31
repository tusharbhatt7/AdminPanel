import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Copy, Check, Star, Phone, Navigation, MapPin, Car, CreditCard, Calendar,
    Route as RouteIcon, AlertCircle, Ban, FileText, Clock, User, ArrowRight, ArrowUpRight, Wallet,
} from 'lucide-react';
import LiveMap from './LiveMap';
import { StatusChip, Avatar } from './RideBits';
import { statusLabel, statusTone, formatCompact, formatCurrency, toDate } from '../lib/rideStatus';
import { rideTimeline, deriveIssues, worstTone } from '../lib/activeRides';
import { formatFix } from '../services/liveTrackingService';
import { cancelRideAsAdmin } from '../services/rideService';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService';
import { toneText, toneCallout, toneDot } from '../lib/tones';
import { fetchRoute } from '../services/directionsService';

/**
 * Everything dispatch needs about one ride.
 *
 * Only actions backed by data in this system appear. Reassign Driver, Send
 * Notification, Flag an Issue and the chat view are drawn in the mockups and
 * are absent here on purpose — each needs a Cloud Function or a collection
 * that does not exist, and a button that cannot act is worse than no button.
 */

const Panel = ({ title, icon: Icon, children, className = '', action = null }) => (
    <section className={`p-3.5 border rounded-xl bg-surface border-line ${className}`}>
        {title && (
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                    {Icon ? <Icon className="w-3.5 h-3.5 text-fg-3" /> : null}
                    <h3 className="text-[13px] font-bold text-fg">{title}</h3>
                </div>
                {action}
            </div>
        )}
        {children}
    </section>
);

const Fact = ({ icon: Icon, label, value, tone }) => (
    <div className="flex items-start gap-2 min-w-0">
        {Icon ? <Icon className="w-3.5 h-3.5 mt-0.5 text-fg-3 shrink-0" /> : null}
        <div className="min-w-0">
            <p className="text-[11px] leading-tight text-fg-3">{label}</p>
            {/* Wraps rather than truncates: a clipped fare or time is worse
                than a two-line one. */}
            <p className={`text-[12.5px] font-medium leading-tight mt-0.5 break-words ${tone ? toneText(tone) : 'text-fg'}`}>
                {value ?? '—'}
            </p>
        </div>
    </div>
);

/**
 * Phone and id, laid out as in the mockups' people cards.
 *
 * The id is a link to that person's record. A dispatcher looking at a ride
 * almost always wants the person next — whether this driver has done this
 * before, whether this customer cancels a lot — and retyping a name into
 * another page to find out is the friction worth removing.
 */
const ContactLines = ({ phone, id, idLabel, profileHref }) => (
    <div className="flex flex-col gap-1.5 mt-2.5">
        {phone ? (
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-[12.5px] text-link hover:underline w-fit">
                <Phone className="w-3.5 h-3.5 shrink-0" /> {phone}
            </a>
        ) : (
            <span className="flex items-center gap-2 text-[12px] text-fg-3">
                <Phone className="w-3.5 h-3.5 shrink-0" /> Encrypted or missing
            </span>
        )}
        {id && profileHref ? (
            <Link to={profileHref} className="flex items-center gap-2 font-mono text-[11px] text-link hover:underline w-fit">
                <User className="w-3.5 h-3.5 shrink-0" /> {idLabel}-{id.slice(-6).toUpperCase()}
            </Link>
        ) : (
            <span className="flex items-center gap-2 font-mono text-[11px] text-fg-3">
                <User className="w-3.5 h-3.5 shrink-0" /> {id ? `${idLabel}-${id.slice(-6).toUpperCase()}` : '—'}
            </span>
        )}
    </div>
);

export default function ActiveRideDetail({ ride, position, passenger, trail, actor, canCancel = false, onClose }) {
    const [copied, setCopied] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [route, setRoute] = useState(null);

    const pickupLat = ride?.pickup.lat;
    const pickupLng = ride?.pickup.lng;
    const destLat = ride?.destination.lat;
    const destLng = ride?.destination.lng;

    // The road route, fetched once per pair of endpoints and cached in the
    // service. Depending on the coordinates rather than the ride object means
    // a position update every few seconds does not re-request a route that
    // cannot have changed.
    //
    // The result carries the endpoints it was fetched for, and is only drawn
    // when those still match. Clearing it on change would do the same job but
    // one render later — long enough to paint the previous ride's route across
    // the new ride's map, which is exactly the kind of wrong line someone
    // would act on.
    const routeKey = `${pickupLat},${pickupLng}>${destLat},${destLng}`;

    useEffect(() => {
        let cancelled = false;
        if (![pickupLat, pickupLng, destLat, destLng].every(Number.isFinite)) return undefined;

        fetchRoute({ lat: pickupLat, lng: pickupLng }, { lat: destLat, lng: destLng })
            .then((result) => { if (!cancelled) setRoute({ key: routeKey, ...(result ?? {}) }); });

        return () => { cancelled = true; };
    }, [pickupLat, pickupLng, destLat, destLng, routeKey]);

    const activeRoute = route?.key === routeKey ? route : null;

    if (!ride) {
        return (
            <div className="grid p-8 text-center border rounded-xl bg-surface border-line lift place-items-center min-h-[24rem]">
                <div>
                    <Car className="w-7 h-7 mx-auto mb-3 text-fg-3 opacity-40" />
                    <p className="text-[13px] font-medium text-fg">Select a ride</p>
                    <p className="mt-1 text-[12px] text-fg-3">Pick one from the queue to see its map, people and timeline.</p>
                </div>
            </div>
        );
    }

    const issues = deriveIssues(ride, position);
    const issueTone = worstTone(issues);
    const timeline = rideTimeline(ride);

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(ride.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Could not copy the ride id.');
        }
    };

    const markers = [];
    if (position && Number.isFinite(position.latitude)) {
        markers.push({
            id: `driver-${ride.driverId}`, rideId: ride.id, kind: 'driver',
            lat: position.latitude, lng: position.longitude,
            heading: position.heading, stale: position.stale, fixAt: position.timestamp,
            label: `${ride.driverName || 'Driver'} · ${formatFix(position.timestamp)}`,
        });
    }
    if (ride.pickup.lat != null) {
        markers.push({
            id: `pickup-${ride.id}`, rideId: ride.id, kind: 'pickup',
            lat: ride.pickup.lat, lng: ride.pickup.lng, label: ride.pickup.address || 'Pickup',
        });
    }
    if (ride.destination.lat != null) {
        markers.push({
            id: `drop-${ride.id}`, rideId: ride.id, kind: 'drop',
            lat: ride.destination.lat, lng: ride.destination.lng,
            label: ride.destination.address || 'Destination',
        });
    }
    if (passenger?.position) {
        markers.push({
            id: `rider-${ride.id}`, rideId: ride.id, kind: 'passenger',
            lat: passenger.position.latitude, lng: passenger.position.longitude,
            fixAt: passenger.position.timestamp,
            label: `Rider · ${formatFix(passenger.position.timestamp)}`,
        });
    }

    const navTo = (p) => (p.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : null);

    const straightFallback = [pickupLat, pickupLng, destLat, destLng].every(Number.isFinite)
        ? [{ lat: pickupLat, lng: pickupLng }, { lat: destLat, lng: destLng }]
        : null;
    const startedAt = ride.startedAt ?? ride.acceptedAt ?? ride.requestTime;

    return (
        <div className="flex flex-col gap-3 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-[18px] font-bold tracking-tight text-fg">{ride.shortId}</h2>
                    <button
                        type="button" onClick={copyId} title="Copy the full ride id" aria-label="Copy the full ride id"
                        className="p-1 rounded text-fg-3 hover:text-fg hover:bg-raised"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <StatusChip
                        label={issues[0]?.label ?? statusLabel(ride.status)}
                        tone={issueTone ?? statusTone(ride.status)}
                    />
                </div>
                <div className="text-right">
                    <p className="text-[11px] text-fg-3">Started at {formatCompact(startedAt)}</p>
                    {position && (
                        <p className="text-[11px] text-fg-3">
                            Last location: {formatFix(position.timestamp)}
                        </p>
                    )}
                </div>
            </div>

            {/* The alert that made dispatch open this ride */}
            {issues.length > 0 && (
                <div className={`flex flex-col gap-2 p-3 border rounded-xl ${toneCallout(issueTone)}`}>
                    {issues.map((issue) => (
                        <div key={issue.key} className="flex items-start gap-2">
                            <AlertCircle className={`w-4 h-4 mt-px shrink-0 ${toneText(issue.tone)}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-[12.5px] font-bold text-fg">{issue.label}</p>
                                <p className="text-[12px] leading-relaxed text-fg-2">{issue.detail}</p>
                            </div>
                            {issue.key.startsWith('credit_') && ride.driverId && (
                                <Link to={`/wallets?tab=review`} className="btn btn-default btn-sm shrink-0">
                                    <Wallet className="w-3.5 h-3.5" /> Review
                                </Link>
                            )}
                            {(issue.key === 'location_stale' || issue.key === 'no_signal') && ride.driverPhone && (
                                <a href={`tel:${ride.driverPhone}`} className="btn btn-default btn-sm shrink-0">
                                    <Phone className="w-3.5 h-3.5" /> Reach driver
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="overflow-hidden border rounded-xl border-line lift">
                {/* No focusId here, unlike the list view. Focus pans to the
                    driver and zooms in; with one ride on screen that framed the
                    destination off the edge and cut the route in half. This map
                    should show the whole journey. */}
                <LiveMap
                    markers={markers}
                    // A road route when Directions returns one; otherwise the
                    // two endpoints joined, drawn dashed so it cannot be
                    // mistaken for the way the car will actually go.
                    route={activeRoute?.path ?? straightFallback}
                    routeIsRoad={!!activeRoute?.path}
                    trail={trail}
                    className="w-full h-[17rem]"
                />
                {/* Legend, as drawn — it is the only way to read the dots. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t bg-surface border-line">
                    {[['ok', 'Pickup'], ['danger', 'Destination'], ['info', 'Driver'], ['violet', 'Rider']].map(([tone, label]) => (
                        <span key={label} className="flex items-center gap-1.5 text-[11px] text-fg-2">
                            <span className={`w-2 h-2 rounded-full ${toneDot(tone)}`} /> {label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5 text-[11px] text-fg-2">
                        <span className={`w-4 h-0.5 rounded ${activeRoute?.path ? 'bg-info' : 'bg-fg-3'}`} />
                        {activeRoute?.path ? 'Route' : 'Direct line'}
                    </span>
                    {trail?.length > 1 && (
                        <span className="flex items-center gap-1.5 text-[11px] text-fg-2">
                            <span className="w-4 h-0.5 rounded bg-brand" /> Travelled
                        </span>
                    )}
                    {activeRoute?.distanceText && (
                        <span className="ml-auto font-mono text-[11px] text-fg-3">
                            {activeRoute.distanceText} · {activeRoute.durationText}
                        </span>
                    )}
                </div>
            </div>

            {/* People */}
            <div className="grid gap-3 lg:grid-cols-2">
                <Panel
                    title="Customer Details"
                    action={ride.customerId && (
                        <Link
                            to={`/customers?customer=${ride.customerId}`}
                            className="flex items-center gap-1 text-[11.5px] font-medium text-link hover:underline"
                        >
                            View profile <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    )}
                >
                    <div className="flex items-start gap-3">
                        <Avatar name={ride.customerName} size={44} />
                        <div className="min-w-0">
                            {ride.customerId ? (
                                <Link
                                    to={`/customers?customer=${ride.customerId}`}
                                    className="block text-[14px] font-bold truncate text-fg hover:text-link hover:underline"
                                >
                                    {ride.customerName || 'Unnamed'}
                                </Link>
                            ) : (
                                <p className="text-[14px] font-bold truncate text-fg">{ride.customerName || 'Unnamed'}</p>
                            )}
                            <ContactLines
                                phone={ride.customerPhone} id={ride.customerId} idLabel="CUS"
                                profileHref={ride.customerId ? `/customers?customer=${ride.customerId}` : null}
                            />
                            {ride.customerId && (
                                <Link to={`/rides?user=${ride.customerId}`} className="btn btn-default btn-sm mt-2">
                                    <RouteIcon className="w-3.5 h-3.5" /> Ride history
                                </Link>
                            )}
                        </div>
                    </div>
                </Panel>

                <Panel
                    title="Driver Details"
                    action={ride.driverId && (
                        <Link
                            to={`/drivers?driver=${ride.driverId}`}
                            className="flex items-center gap-1 text-[11.5px] font-medium text-link hover:underline"
                        >
                            View profile <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    )}
                >
                    {ride.driverId ? (
                        <div className="flex items-start gap-3">
                            <Avatar name={ride.driverName} src={ride.driverPhotoUrl} size={44} />
                            <div className="flex-1 min-w-0">
                                <Link
                                    to={`/drivers?driver=${ride.driverId}`}
                                    className="block text-[14px] font-bold truncate text-fg hover:text-link hover:underline"
                                >
                                    {ride.driverName || 'Unnamed'}
                                </Link>
                                {ride.driverRating != null && (
                                    <span className="flex items-center gap-1 text-[12px] text-fg-2">
                                        <Star className="w-3.5 h-3.5 text-brand fill-brand" />
                                        {ride.driverRating.toFixed(1)}
                                        {ride.driverTotalTrips != null && (
                                            <span className="text-fg-3">({ride.driverTotalTrips} rides)</span>
                                        )}
                                    </span>
                                )}
                                <ContactLines
                                    phone={ride.driverPhone} id={ride.driverId} idLabel="DRV"
                                    profileHref={`/drivers?driver=${ride.driverId}`}
                                />
                                <Link to={`/rides?driver=${ride.driverId}`} className="btn btn-default btn-sm mt-2">
                                    <RouteIcon className="w-3.5 h-3.5" /> Ride history
                                </Link>
                            </div>
                            <div className="pl-3 text-right border-l border-line shrink-0">
                                <p className="text-[12.5px] font-semibold text-fg">
                                    {ride.vehicleDisplayName || ride.vehicleType || 'Vehicle'}
                                </p>
                                <p className="font-mono text-[11px] text-fg-3">{ride.vehicleNumber || '—'}</p>
                                <Link to={`/wallets?driver=${ride.driverId}`} className="btn btn-default btn-sm mt-2">
                                    <Wallet className="w-3.5 h-3.5" /> Wallet
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[12px] text-fg-3">No driver assigned yet.</p>
                    )}
                </Panel>
            </div>

            {/* Pickup → distance → Destination */}
            <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <Panel>
                    <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-ok" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-fg-3">Pickup Location</p>
                            <p className="text-[12.5px] font-medium text-fg">{ride.pickup.address || '—'}</p>
                        </div>
                        {navTo(ride.pickup) && (
                            <a href={navTo(ride.pickup)} target="_blank" rel="noreferrer" className="btn btn-default btn-sm shrink-0">
                                <Navigation className="w-3.5 h-3.5" /> Navigate
                            </a>
                        )}
                    </div>
                </Panel>

                <div className="grid px-2 place-items-center">
                    <p className="font-mono text-[12px] font-bold text-fg whitespace-nowrap">
                        {ride.distanceKm != null ? `${ride.distanceKm.toFixed(1)} km` : '—'}
                    </p>
                    <ArrowRight className="w-4 h-4 my-0.5 text-fg-3" />
                    <p className="text-[10px] text-fg-3 whitespace-nowrap">
                        {ride.durationMin != null ? `~${Math.round(ride.durationMin)} min` : ''}
                    </p>
                </div>

                <Panel>
                    <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-fg-3">Destination</p>
                            <p className="text-[12.5px] font-medium text-fg">{ride.destination.address || '—'}</p>
                        </div>
                        {navTo(ride.destination) && (
                            <a href={navTo(ride.destination)} target="_blank" rel="noreferrer" className="btn btn-default btn-sm shrink-0">
                                <Navigation className="w-3.5 h-3.5" /> Navigate
                            </a>
                        )}
                    </div>
                </Panel>
            </div>

            {/* Facts, timeline, actions */}
            <div className="grid gap-3 lg:grid-cols-3">
                <Panel title="Ride Information" icon={FileText}>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                        <Fact icon={Car} label="Ride Type" value={ride.rideType} />
                        <Fact icon={CreditCard} label="Estimated Fare" value={formatCurrency(ride.fare)} />
                        <Fact icon={Calendar} label="Booking Time" value={formatCompact(ride.requestTime)} />
                        <Fact icon={CreditCard} label="Payment Method" value={ride.paymentMode} />
                        <Fact icon={RouteIcon} label="Distance (Est.)" value={ride.distanceKm != null ? `${ride.distanceKm.toFixed(1)} km` : null} />
                        <Fact
                            icon={Clock} label="Payment Status" value={ride.paymentStatus || 'Pending'}
                            tone={ride.paymentStatus === 'failed' ? 'danger' : ride.paymentStatus === 'paid' ? 'ok' : 'warn'}
                        />
                    </div>
                </Panel>

                <Panel title="Ride Status Timeline" icon={Clock}>
                    <ol className="flex flex-col gap-2.5">
                        {timeline.map((step) => {
                            const at = toDate(step.at);
                            const done = !!at;
                            return (
                                <li key={step.key} className="flex items-center gap-2">
                                    <span className={`grid w-4 h-4 rounded-full shrink-0 place-items-center ${
                                        step.tone === 'danger' ? 'bg-danger' : done ? 'bg-ok' : 'bg-line-strong'
                                    }`}>
                                        {done && step.tone !== 'danger' && <Check className="w-2.5 h-2.5 text-surface" />}
                                        {step.tone === 'danger' && <AlertCircle className="w-2.5 h-2.5 text-surface" />}
                                    </span>
                                    <p className={`flex-1 text-[12px] truncate ${done ? 'text-fg' : 'text-fg-3'}`}>{step.label}</p>
                                    <span className="font-mono text-[10px] text-fg-3 shrink-0">
                                        {at ? at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </Panel>

                <Panel title="Admin Actions">
                    <div className="flex flex-col gap-1.5">
                        {ride.customerPhone && (
                            <a href={`tel:${ride.customerPhone}`} className="btn btn-default btn-sm w-full justify-start">
                                <Phone className="w-3.5 h-3.5 text-info" /> Contact Customer
                            </a>
                        )}
                        {ride.driverPhone && (
                            <a href={`tel:${ride.driverPhone}`} className="btn btn-default btn-sm w-full justify-start">
                                <Phone className="w-3.5 h-3.5 text-info" /> Contact Driver
                            </a>
                        )}
                        <Link to={`/rides?ride=${ride.id}`} className="btn btn-default btn-sm w-full justify-start">
                            <FileText className="w-3.5 h-3.5 text-fg-3" /> View Full Details
                        </Link>
                        {canCancel && !['cancelled', 'completed'].includes(ride.status) && (
                            <button type="button" onClick={() => setCancelling(true)} className="btn btn-danger btn-sm w-full justify-start">
                                <Ban className="w-3.5 h-3.5" /> Cancel Ride
                            </button>
                        )}
                    </div>
                </Panel>
            </div>

            {cancelling && (
                <CancelDialog ride={ride} actor={actor} onClose={() => setCancelling(false)} onCancelled={onClose} />
            )}
        </div>
    );
}

function CancelDialog({ ride, actor, onClose, onCancelled }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const valid = reason.trim().length >= 4;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        try {
            await cancelRideAsAdmin(ride.id, reason.trim());
            await recordAudit({
                actor, action: AUDIT_ACTIONS.RIDE_CANCELLED, targetType: 'ride',
                targetId: ride.id, targetLabel: ride.shortId,
                metadata: { reason: reason.trim(), previousStatus: ride.status },
            });
            toast.success(`${ride.shortId} cancelled`);
            onClose();
            onCancelled?.();
        } catch (error) {
            console.error('Cancel failed:', error);
            toast.error(error?.message || 'Could not cancel the ride.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid p-4 place-items-center bg-fg/40 backdrop-blur-sm">
            <form onSubmit={submit} className="w-full max-w-sm p-5 border rounded-xl bg-surface border-line lift">
                <h3 className="text-[15px] font-semibold text-fg">Cancel {ride.shortId}?</h3>
                <p className="mt-1 mb-4 text-[12px] leading-relaxed text-fg-2">
                    The rider and driver apps both see this immediately. If a driver is already carrying this passenger,
                    call them first — cancelling does not tell them why.
                </p>
                <label className="field-label" htmlFor="cancel-reason">Reason</label>
                <textarea
                    id="cancel-reason" className="field" rows={3} value={reason} autoFocus
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Recorded on the ride and in the audit log"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep ride</button>
                    <button type="submit" className="btn btn-danger" disabled={!valid || busy}>
                        {busy ? 'Cancelling…' : 'Cancel ride'}
                    </button>
                </div>
            </form>
        </div>
    );
}
