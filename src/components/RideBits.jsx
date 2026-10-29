import React from 'react';
import { Car, Bike, Truck, Package, User } from 'lucide-react';
import { toneBgSoft, toneText, toneDot } from '../lib/tones';

/** Shared pieces of the Active Rides screen, shaped to the dispatch mockups. */

/**
 * The pill from the mockups: a soft-tinted capsule with a leading dot.
 *
 * Deliberately not the panel's `.pill`, which is uppercase mono and reads as a
 * data tag. Here the chip is the headline of the row — "Location Not Updating"
 * has to be legible at a glance from across a desk, so it stays sentence case
 * at a readable size.
 */
export const StatusChip = ({ label, tone = 'neutral', size = 'md' }) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap
            ${toneBgSoft(tone)} ${toneText(tone)}
            ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'}`}
    >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneDot(tone)}`} />
        {label}
    </span>
);

const initials = (name) => {
    if (!name) return null;
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join('') || null;
};

/**
 * A person.
 *
 * The mockups show photographs. Rides carry `driverPhotoUrl`, so a driver's
 * picture is shown when one exists; customers have no photo field anywhere, so
 * they fall back to initials. Initials are derived from the name that is
 * already on screen — not a stand-in for data we do not have.
 */
export const Avatar = ({ name, src, size = 40 }) => {
    const text = initials(name);
    return src ? (
        <img
            src={src} alt="" width={size} height={size}
            className="object-cover rounded-full shrink-0 bg-raised"
            style={{ width: size, height: size }}
        />
    ) : (
        <span
            className="grid font-semibold rounded-full shrink-0 place-items-center bg-raised text-fg-2"
            style={{ width: size, height: size, fontSize: size * 0.34 }}
        >
            {text ?? <User className="w-1/2 h-1/2 text-fg-3" />}
        </span>
    );
};

// Kept as a key lookup rather than a function returning a component. Both
// render the same glyph, but a function whose return value goes straight into
// JSX reads as a component factory — React would treat each call as a new
// component type and remount the icon on every render.
const VEHICLE_ICON = { bike: Bike, auto: Truck, parcel: Package, car: Car };

const VEHICLE_PATTERNS = [
    [/bike|2w|moto|scooter/i, 'bike'],
    [/auto|3w|rick/i, 'auto'],
    [/parcel|courier|delivery/i, 'parcel'],
];

const vehicleKey = (vehicleType) =>
    VEHICLE_PATTERNS.find(([re]) => re.test(vehicleType ?? ''))?.[1] ?? 'car';

/** Vehicle glyph in a soft disc, as drawn beside the plate in the mockups. */
export const VehicleBadge = ({ vehicleType, size = 36 }) => {
    const Icon = VEHICLE_ICON[vehicleKey(vehicleType)];
    return (
        <span
            className="grid rounded-full shrink-0 place-items-center bg-raised text-fg-2"
            style={{ width: size, height: size }}
        >
            <Icon className="w-1/2 h-1/2" />
        </span>
    );
};
