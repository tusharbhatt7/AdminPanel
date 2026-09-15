import React from 'react';
import EmptyModule from '../../components/EmptyModule';

// Each of these is a real screen in the design whose Firestore collection has
// never been created. They state what is missing rather than rendering zeroes.

export const Complaints = () => (
    <EmptyModule
        title="Complaints"
        collection="complaints"
        description="Rider and driver complaints would be triaged here — assigned, chased and resolved."
        needs={[
            'A complaints collection written by the rider and driver apps',
            'Fields: raisedBy, againstId, rideId, type, issue, status, createdAt',
            'Security rules allowing an admin to read all and update status',
        ]}
    />
);

export const Promotions = () => (
    <EmptyModule
        title="Promotions"
        collection="promotions / coupons"
        description="Promo codes, discounts and referral campaigns would be created and tracked here."
        needs={[
            'A promotions or coupons collection',
            'Fields: code, type, value, validFrom, validTo, usageLimit, isActive',
            'The rider app reading and redeeming against it at checkout',
        ]}
    />
);

export const Fleet = () => (
    <EmptyModule
        title="Fleet Management"
        collection="fleet"
        description="Vehicles, ownership, servicing and document expiry would be managed here."
        needs={[
            'A fleet collection, or vehicle fields promoted off the driver document',
            'Today vehicleMake, vehicleModel and vehicleColor exist on drivers but are null on every record',
            'Document expiry dates, which no collection currently stores',
        ]}
    />
);

export const Zones = () => (
    <EmptyModule
        title="Cities & Zones"
        collection="cities / zones"
        description="Service areas, geofences and per-zone pricing would be configured here."
        needs={[
            'A cities or zones collection with geofence polygons',
            'Per-zone fare multipliers and surge rules',
            'Rides tagged with the zone they started in',
        ]}
    />
);

export const Notifications = () => (
    <EmptyModule
        title="Notifications"
        collection="notifications"
        description="Push campaigns and their delivery history would live here."
        needs={[
            'A notifications collection recording each send',
            'FCM tokens are already stored on users and drivers, so delivery is feasible',
            'A Cloud Function to fan out sends and record results',
        ]}
    />
);
