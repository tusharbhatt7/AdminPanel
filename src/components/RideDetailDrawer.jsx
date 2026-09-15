import React from 'react';
import {
    X, MapPin, Flag, IndianRupee, Car, User, CreditCard,
    Clock, ExternalLink, AlertTriangle, Hash,
} from 'lucide-react';
import {
    statusStyle, statusLabel, statusStripe, formatDateTime, formatAge,
    formatCurrency, isStaleActive, STALE_ACTIVE_HOURS,
} from '../lib/rideStatus';
import { plainOrNull } from '../lib/pii';

const Row = (props) => {
    const RowIcon = props.icon;
    const { label, value, mono = false } = props;
    return (
        <div className="flex items-start gap-2.5 py-2">
            <RowIcon className="w-3.5 h-3.5 mt-1 shrink-0 text-fg-3" />
            <div className="flex-1 min-w-0">
                <div className="eyebrow">{label}</div>
                <div className={`text-[13px] text-fg break-words ${mono ? 'font-mono text-[11px] mt-0.5' : ''}`}>
                    {value ?? <span className="text-fg-3">—</span>}
                </div>
            </div>
        </div>
    );
};

const Section = ({ title, children }) => (
    <div className="p-3 panel">
        <h4 className="mb-1 eyebrow">{title}</h4>
        <div className="divide-y divide-line/60">{children}</div>
    </div>
);

const mapsLink = (lat, lng) =>
    typeof lat === 'number' && typeof lng === 'number'
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : null;

export default function RideDetailDrawer({ ride, isOpen, onClose }) {
    if (!isOpen || !ride) return null;

    const pickupMap = mapsLink(ride.pickupLat, ride.pickupLng);
    const destMap = mapsLink(ride.destLat, ride.destLng);
    const stale = isStaleActive(ride) && !['completed', 'cancelled'].includes(ride.status);

    const place = (name, address, link) => (
        <>
            <span className="font-medium">{name || 'Unnamed'}</span>
            {address && <span className="block text-xs text-fg-3">{address}</span>}
            {link && (
                <a
                    href={link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-brand hover:underline"
                >
                    Maps <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </>
    );

    return (
        <>
            <div className="fixed inset-0 z-40 bg-canvas/80 backdrop-blur-sm" onClick={onClose} />

            <aside
                role="dialog" aria-modal="true" aria-label="Ride details"
                style={{ '--stripe-color': statusStripe(ride.status) }}
                className="stripe fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-md border-l bg-canvas border-line shadow-2xl"
            >
                <header className="flex items-start justify-between gap-3 p-4 border-b bg-surface border-line">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className={statusStyle(ride.status)}>{statusLabel(ride.status)}</span>
                            {ride.dispatchStatus && (
                                <span className="pill pill-neutral">{ride.dispatchStatus}</span>
                            )}
                        </div>
                        <h3 className="mt-2 font-mono text-lg font-semibold truncate text-fg">
                            {formatCurrency(ride.fare)}
                        </h3>
                        <p className="font-mono text-[10px] text-fg-3">
                            {ride.vehicleDisplayName || ride.vehicleCategory || ride.type || 'ride'} &middot; {formatAge(ride.requestTime)}
                        </p>
                    </div>
                    <button
                        onClick={onClose} aria-label="Close ride details"
                        className="p-1.5 rounded-md text-fg-3 hover:bg-raised hover:text-fg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex flex-col gap-3 p-3 overflow-y-auto">
                    {stale && (
                        <div className="flex items-start gap-2 px-3 py-2.5 text-[13px] border rounded-lg bg-warn-soft border-warn/30 text-fg-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warn" />
                            <span>
                                In <strong className="text-fg">{statusLabel(ride.status)}</strong> for over {STALE_ACTIVE_HOURS} hours.
                                Neither app closes a ride out on its own, so this is likely abandoned rather than running.
                            </span>
                        </div>
                    )}

                    <Section title="Route">
                        <Row icon={MapPin} label="Pickup" value={place(ride.pickupName, ride.pickupAddress, pickupMap)} />
                        <Row icon={Flag} label="Destination" value={place(ride.destName, ride.destAddress, destMap)} />
                    </Section>

                    <Section title="Fare & payment">
                        <Row icon={IndianRupee} label="Fare" value={formatCurrency(ride.fare)} />
                        <Row icon={CreditCard} label="Payment mode" value={ride.paymentMode} />
                        <Row icon={CreditCard} label="Payment status" value={ride.paymentStatus || (ride.paymentCollected ? 'collected' : null)} />
                    </Section>

                    <Section title="Driver">
                        <Row icon={User} label="Name" value={ride.driverName} />
                        <Row
                            icon={Car} label="Vehicle"
                            value={[ride.vehicleDisplayName, plainOrNull(ride.vehicleNumber)].filter(Boolean).join(' · ') || null}
                        />
                        <Row icon={Hash} label="Driver ID" value={ride.assignedDriverId} mono />
                    </Section>

                    <Section title="Customer">
                        <Row icon={Hash} label="Customer ID" value={ride.userId} mono />
                        <Row icon={User} label="Email" value={ride.userEmail} />
                    </Section>

                    <Section title="Timeline">
                        <Row icon={Clock} label="Requested" value={formatDateTime(ride.requestTime)} />
                        <Row icon={Clock} label="Accepted" value={ride.acceptedAt ? formatDateTime(ride.acceptedAt) : null} />
                        <Row icon={Clock} label="Cancelled" value={ride.cancelledAt ? `${formatDateTime(ride.cancelledAt)}${ride.cancelledBy ? ` (by ${ride.cancelledBy})` : ''}` : null} />
                        <Row icon={Hash} label="Ride ID" value={ride.id} mono />
                    </Section>
                </div>
            </aside>
        </>
    );
}
