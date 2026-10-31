import React, { useMemo, useState } from 'react';
import { Search, ArrowDownUp, ChevronRight, AlertCircle, MapPinOff, User } from 'lucide-react';
import { statusLabel, statusTone, formatCurrency, toDate } from '../lib/rideStatus';
import { AWAITING_STATUSES, IN_PROGRESS_STATUSES, worstTone } from '../lib/activeRides';
import { StatusChip, Avatar, VehicleBadge } from './RideBits';
import { toneText, toneBgSoft, toneBorder } from '../lib/tones';

const SORTS = {
    latest: { label: 'Latest', compare: (a, b) => b.requestedMs - a.requestedMs },
    oldest: { label: 'Longest waiting', compare: (a, b) => a.requestedMs - b.requestedMs },
    fare: { label: 'Highest fare', compare: (a, b) => (b.ride.fare ?? 0) - (a.ride.fare ?? 0) },
};

const matchesTab = (entry, tab) => {
    if (tab === 'issues') return entry.issues.length > 0;
    if (tab === 'awaiting') return AWAITING_STATUSES.includes(entry.ride.status);
    if (tab === 'progress') return IN_PROGRESS_STATUSES.includes(entry.ride.status);
    return true;
};

const clockTime = (value) => {
    const d = toDate(value);
    return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
};

export default function ActiveRideList({ entries, loading, selectedId, onSelect }) {
    const [tab, setTab] = useState('all');
    const [sort, setSort] = useState('latest');
    const [search, setSearch] = useState('');
    const [vehicle, setVehicle] = useState('all');

    const vehicleTypes = useMemo(
        () => [...new Set(entries.map((e) => e.ride.vehicleType).filter(Boolean))].sort(),
        [entries],
    );

    const counts = useMemo(() => ({
        all: entries.length,
        awaiting: entries.filter((e) => matchesTab(e, 'awaiting')).length,
        progress: entries.filter((e) => matchesTab(e, 'progress')).length,
        issues: entries.filter((e) => matchesTab(e, 'issues')).length,
    }), [entries]);

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return entries
            .filter((e) => matchesTab(e, tab))
            .filter((e) => vehicle === 'all' || e.ride.vehicleType === vehicle)
            .filter((e) => !q || [
                e.ride.id, e.ride.shortId, e.ride.customerName, e.ride.customerEmail, e.ride.customerPhone,
                e.ride.driverName, e.ride.vehicleNumber, e.ride.pickup.address, e.ride.destination.address,
            ].some((f) => f && String(f).toLowerCase().includes(q)))
            .sort(SORTS[sort].compare);
    }, [entries, tab, sort, search, vehicle]);

    const TABS = [
        { key: 'all', label: 'All', count: counts.all },
        { key: 'awaiting', label: 'Awaiting', count: counts.awaiting },
        { key: 'progress', label: 'In Progress', count: counts.progress },
        { key: 'issues', label: 'Issues', count: counts.issues, tone: counts.issues > 0 ? 'danger' : null },
    ];

    return (
        <div className="flex flex-col border rounded-xl bg-surface border-line lift min-w-0">
            {/* Search + filters */}
            <div className="flex flex-col gap-2 p-3 border-b border-line">
                <div className="relative">
                    <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-fg-3 pointer-events-none" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by ride ID, customer, driver…"
                        className="field pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={vehicle} onChange={(e) => setVehicle(e.target.value)}
                        aria-label="Filter by vehicle type"
                        className="field w-auto py-1.5 text-[12px]"
                    >
                        <option value="all">Vehicle type</option>
                        {vehicleTypes.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <label className="flex items-center gap-1 ml-auto text-fg-3">
                        <ArrowDownUp className="w-3.5 h-3.5" />
                        <select
                            value={sort} onChange={(e) => setSort(e.target.value)}
                            aria-label="Sort rides" className="field w-auto py-1.5 text-[12px]"
                        >
                            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            {/* Tabs — underline on the active one, as drawn */}
            <div className="flex gap-4 px-3 overflow-x-auto border-b border-line">
                {TABS.map((t) => (
                    <button
                        key={t.key} type="button" onClick={() => setTab(t.key)}
                        className={`py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                            tab === t.key
                                ? 'border-info text-info'
                                : 'border-transparent text-fg-3 hover:text-fg'
                        }`}
                    >
                        {t.label}
                        <span className={`ml-1 tabular ${t.tone ? toneText(t.tone) : ''}`}>({t.count})</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-col p-2 gap-1.5 lg:max-h-[calc(100vh-24rem)] lg:overflow-y-auto">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[4.75rem] skeleton rounded-xl" />)
                ) : rows.length === 0 ? (
                    <div className="py-12 text-center">
                        <MapPinOff className="w-6 h-6 mx-auto mb-2 text-fg-3 opacity-50" />
                        <p className="text-[13px] text-fg-3">
                            {entries.length === 0 ? 'No rides in flight right now.' : 'No rides match these filters.'}
                        </p>
                    </div>
                ) : rows.map((entry) => (
                    <RideRow
                        key={entry.ride.id}
                        entry={entry}
                        selected={entry.ride.id === selectedId}
                        onSelect={() => onSelect(entry.ride.id)}
                    />
                ))}
            </div>
        </div>
    );
}

function RideRow({ entry, selected, onSelect }) {
    const { ride, issues } = entry;
    const issueTone = worstTone(issues);

    // The chip carries the problem when there is one and the status otherwise —
    // a dispatcher scanning the queue needs to see "Location Not Updating", not
    // "In Progress", on the ride that needs them.
    const chipTone = issueTone ?? statusTone(ride.status);
    const chipLabel = issues[0]?.label ?? statusLabel(ride.status);

    // A troubled ride is tinted and outlined; a healthy one is a plain row.
    // Selection always wins, so the row you are reading is never ambiguous.
    const shell = selected
        ? 'bg-info-soft border-info'
        : issueTone
            ? `${toneBgSoft(issueTone)} ${toneBorder(issueTone)}`
            : 'bg-surface border-transparent hover:bg-raised';

    return (
        <button
            type="button" onClick={onSelect}
            className={`w-full p-3 text-left border rounded-xl transition-colors ${shell}`}
        >
            <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-fg">{ride.shortId}</span>
                <StatusChip label={chipLabel} tone={chipTone} size="sm" />
                <span className="ml-auto text-[11px] text-fg-3 shrink-0">{clockTime(ride.requestTime)}</span>
            </div>

            <div className="flex items-center gap-2.5 mt-2">
                {/* A ride carries userEmail but no name, so the email is
                    the fallback label rather than the word "Customer" on
                    every row. */}
                <Avatar name={ride.customerName || ride.customerEmail} size={36} />
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate text-fg">
                        {ride.customerName || ride.customerEmail || 'Customer'}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] truncate text-fg-3">
                        <User className="w-3 h-3 shrink-0" />
                        {ride.driverName || 'Unassigned'}
                    </p>
                </div>

                <div className="items-center hidden gap-2 sm:flex shrink-0">
                    <VehicleBadge vehicleType={ride.vehicleType} size={32} />
                    <div className="min-w-0">
                        <p className="text-[12px] truncate text-fg">{ride.vehicleDisplayName || ride.vehicleType || '—'}</p>
                        <p className="font-mono text-[10px] truncate text-fg-3">{ride.vehicleNumber || '—'}</p>
                    </div>
                </div>

                {/* A fixed width here is what keeps the vehicle column
                    aligned down the queue. Sized to content, this block is
                    wider on a row carrying "No location (5 min)" than on one
                    showing only a fare, and every row above and below it
                    shifted to match — the list looked ragged. */}
                <div className="text-right shrink-0 w-[8.5rem]">
                    <p className="text-[14px] font-bold text-fg">{formatCurrency(ride.fare)}</p>
                    {issues.length > 0 ? (
                        <p className={`flex items-center justify-end gap-1 text-[11px] font-medium ${toneText(issueTone)}`}>
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {issues[0].short ?? issues[0].label}
                        </p>
                    ) : ride.pickupEtaMinutes != null && AWAITING_STATUSES.includes(ride.status) ? (
                        <p className="flex items-center justify-end gap-1 text-[11px] text-info">
                            <span className="w-1.5 h-1.5 rounded-full bg-info" /> ETA {ride.pickupEtaMinutes} min
                        </p>
                    ) : null}
                </div>

                <ChevronRight className={`w-4 h-4 shrink-0 ${issueTone ? toneText(issueTone) : 'text-fg-3'}`} />
            </div>
        </button>
    );
}
