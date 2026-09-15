import React from 'react';
import {
    X, MapPin, Flag, IndianRupee, Car, User, CreditCard,
    Clock, ExternalLink, AlertTriangle, Hash,
} from 'lucide-react';
import {
    statusStyle, statusLabel, formatDateTime, formatAge,
    formatCurrency, isStaleActive, STALE_ACTIVE_HOURS,
} from '../lib/rideStatus';

const Row = (props) => {
    const RowIcon = props.icon;
    const { label, value, mono = false } = props;
    return (
    <div className="flex items-start gap-3 py-2.5">
        <RowIcon className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-400">{label}</div>
            <div className={`text-sm text-slate-800 break-words ${mono ? 'font-mono text-xs mt-0.5' : ''}`}>
                {value ?? '—'}
            </div>
        </div>
    </div>
    );
};

const Section = ({ title, children }) => (
    <div className="p-4 bg-white border rounded-xl border-slate-200">
        <h4 className="mb-1 text-xs font-semibold tracking-wider uppercase text-slate-400">{title}</h4>
        <div className="divide-y divide-slate-100">{children}</div>
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
            {address && <span className="block text-xs text-slate-500">{address}</span>}
            {link && (
                <a
                    href={link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                    Open in Maps <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </>
    );

    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

            <aside
                role="dialog" aria-modal="true" aria-label="Ride details"
                className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-lg bg-slate-50 shadow-2xl"
            >
                <header className="flex items-start justify-between gap-4 p-5 bg-white border-b border-slate-200">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${statusStyle(ride.status)}`}>
                                {statusLabel(ride.status)}
                            </span>
                            {ride.dispatchStatus && (
                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                                    dispatch: {ride.dispatchStatus}
                                </span>
                            )}
                        </div>
                        <h3 className="mt-2 text-lg font-bold truncate text-slate-800">
                            {formatCurrency(ride.fare)} &middot; {ride.vehicleDisplayName || ride.vehicleCategory || ride.type || 'Ride'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {formatDateTime(ride.requestTime)} &middot; {formatAge(ride.requestTime)}
                        </p>
                    </div>
                    <button
                        onClick={onClose} aria-label="Close ride details"
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {stale && (
                        <div className="flex items-start gap-2 p-3 text-sm border rounded-xl bg-amber-50 border-amber-200 text-amber-800">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                                This ride has been in <strong>{statusLabel(ride.status)}</strong> for more than {STALE_ACTIVE_HOURS} hours.
                                Neither app closes a ride out on its own, so it is likely abandoned rather than running.
                            </span>
                        </div>
                    )}

                    <Section title="Route">
                        <Row icon={MapPin} label="Pickup" value={place(ride.pickupName, ride.pickupAddress, pickupMap)} />
                        <Row icon={Flag} label="Destination" value={place(ride.destName, ride.destAddress, destMap)} />
                    </Section>

                    <Section title="Fare & Payment">
                        <Row icon={IndianRupee} label="Fare" value={formatCurrency(ride.fare)} />
                        <Row icon={CreditCard} label="Payment mode" value={ride.paymentMode} />
                        <Row icon={CreditCard} label="Payment status" value={ride.paymentStatus || (ride.paymentCollected ? 'collected' : null)} />
                    </Section>

                    <Section title="Driver">
                        <Row icon={User} label="Name" value={ride.driverName} />
                        <Row icon={Car} label="Vehicle" value={[ride.vehicleDisplayName, ride.vehicleNumber].filter(Boolean).join(' · ') || null} />
                        <Row icon={Hash} label="Driver ID" value={ride.assignedDriverId} mono />
                    </Section>

                    <Section title="Customer">
                        <Row icon={User} label="Customer ID" value={ride.userId} mono />
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
