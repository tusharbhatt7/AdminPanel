import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchDrivers, updateDriverApproval, updateDriverDetails } from '../services/driverService';
import { Search, Filter, ShieldCheck, ShieldAlert, AlertCircle, RefreshCw } from 'lucide-react';
import DriverDetailDrawer from '../components/DriverDetailDrawer';

export default function DriverManagement() {
    const location = useLocation();
    const navigate = useNavigate();

    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterVehicleType, setFilterVehicleType] = useState('All');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedDriverForDetails, setSelectedDriverForDetails] = useState(null);
    const [isSavingDetails, setIsSavingDetails] = useState(false);

    useEffect(() => {
        loadDrivers();
    }, []);

    useEffect(() => {
        if (drivers.length > 0 && location.state?.selectedDriverId) {
            const targetDriver = drivers.find(d => d.id === location.state.selectedDriverId);
            if (targetDriver) {
                // Auto-open drawer
                setSelectedDriverForDetails(targetDriver);
                setIsDrawerOpen(true);

                // Clear state so it doesn't reopen if the user navigates back
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [drivers, location.state, navigate, location.pathname]);

    const loadDrivers = async () => {
        try {
            setLoading(true);
            const data = await fetchDrivers();
            setDrivers(data);
        } catch (error) {
            toast.error('Failed to load drivers from Firebase');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleClick = (e, driver) => {
        e.stopPropagation();
        setSelectedDriver(driver);
        setIsModalOpen(true);
    };

    const handleRowClick = (driver) => {
        setSelectedDriverForDetails(driver);
        setIsDrawerOpen(true);
    };

    const handleSaveDriverDetails = async (updatedDriver) => {
        setIsSavingDetails(true);
        try {
            await updateDriverDetails(updatedDriver.id, updatedDriver);
            setDrivers(drivers.map(d => d.id === updatedDriver.id ? updatedDriver : d));
            toast.success('Driver details updated successfully');
            setIsDrawerOpen(false);
        } catch (error) {
            toast.error('Failed to update driver details');
            console.error(error);
        } finally {
            setIsSavingDetails(false);
        }
    };

    const confirmToggleStatus = async () => {
        if (!selectedDriver) return;

        setActionLoading(true);
        const newStatus = !selectedDriver.isApproved;

        // Save original driver state in case we need to revert
        const originalDriverState = { ...selectedDriver };

        try {
            // If approving, also mark all docs as verified. If de-approving, mark them as rejected.
            let updatedData = { isApproved: newStatus };
            if (newStatus === true) {
                updatedData = {
                    ...updatedData,
                    status: 'approved',
                    idFrontStatus: 'verified',
                    idBackStatus: 'verified',
                    licenseFrontStatus: 'verified',
                    licenseBackStatus: 'verified',
                    rcBookStatus: 'verified',
                    selfieStatus: 'verified'
                };
            } else {
                updatedData = {
                    ...updatedData,
                    status: 'Blocked',
                    idFrontStatus: 'rejected',
                    idBackStatus: 'rejected',
                    licenseFrontStatus: 'rejected',
                    licenseBackStatus: 'rejected',
                    rcBookStatus: 'rejected',
                    selfieStatus: 'rejected'
                };
            }

            // **Optimistic UI Update**
            setDrivers(drivers.map(d => d.id === selectedDriver.id ? { ...d, ...updatedData } : d));

            // Call Firebase (We'll use updateDriverDetails instead of updateDriverApproval since we are updating multiple fields now)
            await updateDriverDetails(selectedDriver.id, updatedData);
            toast.success(`Driver successfully ${newStatus ? 'approved' : 'de-approved'}`);

        } catch (error) {
            console.error("Failed to toggle driver status:", error);
            // Revert on error using the complete original state
            setDrivers(drivers.map(d => d.id === originalDriverState.id ? originalDriverState : d));
            toast.error('Failed to update status. Please check your permissions.');
        } finally {
            setActionLoading(false);
            setIsModalOpen(false);
            setSelectedDriver(null);
        }
    };

    const filteredDrivers = drivers.filter(driver => {
        const dName = driver.name || "";
        const dPhone = driver.phone || "";

        const matchesSearch = dName.toLowerCase().includes(search.toLowerCase()) || String(dPhone).includes(search);

        const matchesStatus = filterStatus === 'All'
            ? true
            : filterStatus === 'Approved' ? driver.isApproved : !driver.isApproved;

        const matchesVehicleType = filterVehicleType === 'All'
            ? true
            : (driver.vehicleType || 'Unassigned').toLowerCase() === filterVehicleType.toLowerCase();

        return matchesSearch && matchesStatus && matchesVehicleType;
    }).sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
    });

    return (
        <div className="flex flex-col h-full space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Driver Management</h1>
                    <p className="mt-1 text-xs sm:text-sm text-slate-500">
                        View, search, and approve driver registrations across the platform.
                    </p>
                </div>
                <button className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                    <span className="hidden sm:inline">Export Data</span>
                    <span className="sm:hidden">Export</span>
                </button>
            </div>

            <div className="flex flex-col flex-1 p-4 sm:p-6 bg-white border rounded-xl border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                    <div className="relative w-full md:max-w-sm">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:ring-primary-500 focus:border-primary-500 text-slate-900 placeholder-slate-400"
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-row items-center space-x-2 sm:space-x-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <div className="flex items-center space-x-2 flex-shrink-0">
                            <span className="hidden text-sm font-medium sm:inline text-slate-500">Vehicle:</span>
                            <select
                                value={filterVehicleType}
                                onChange={(e) => setFilterVehicleType(e.target.value)}
                                className="block w-28 sm:w-32 py-2 pl-3 pr-8 sm:pr-10 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
                            >
                                <option value="All">All Vehicles</option>
                                <option value="Mini">Mini</option>
                                <option value="Sedan">Sedan</option>
                                <option value="SUV">SUV</option>
                                <option value="Bike">Bike</option>
                                <option value="Auto">Auto</option>
                                <option value="Parcel">Parcel</option>
                            </select>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                            <span className="hidden text-sm font-medium sm:inline text-slate-500">Status:</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="block w-28 sm:w-32 py-2 pl-3 pr-8 sm:pr-10 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
                            >
                                <option value="All">All Status</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-x-auto sm:border sm:rounded-lg sm:border-slate-200">

                    {/* Desktop Table View */}
                    <table className="min-w-full divide-y divide-slate-200 hidden md:table">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Driver Info
                                </th>
                                <th scope="col" className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Contact
                                </th>
                                <th scope="col" className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Vehicle
                                </th>
                                <th scope="col" className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Joined
                                </th>
                                <th scope="col" className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-xs font-semibold tracking-wider text-center text-slate-500 uppercase">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-8 h-8 mb-4 border-4 border-primary-200 rounded-full border-t-primary-600 animate-spin"></div>
                                            <p>Loading driver data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredDrivers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-slate-500">
                                        No drivers found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredDrivers.map((driver) => (
                                    <tr
                                        key={driver.id}
                                        onClick={() => handleRowClick(driver)}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="relative">
                                                    <div className={`flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold uppercase ${driver.hasSubscription ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                                                        {driver.name && typeof driver.name === 'string' ? driver.name.charAt(0) : '?'}
                                                    </div>
                                                    {driver.hasSubscription && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full" title="Active Subscription"></div>
                                                    )}
                                                </div>
                                                <div className="ml-4 flex items-center">
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-900 focus:outline-none flex items-center">
                                                            {driver.name || 'Unknown'}
                                                            {!driver.isApproved && driver.createdAt && (
                                                                (() => {
                                                                    const createdAtDate = driver.createdAt?.toDate ? driver.createdAt.toDate() : new Date(driver.createdAt);
                                                                    const now = new Date();
                                                                    const hoursDifference = Math.abs(now - createdAtDate) / 36e5;
                                                                    return hoursDifference <= 24;
                                                                })()
                                                            ) && (
                                                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                                                        New
                                                                    </span>
                                                                )}
                                                        </div>
                                                        <div className="text-sm text-slate-500">ID: {driver.id}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-slate-900">{driver.phone || 'N/A'}</div>
                                            <div className="text-sm text-slate-500">{driver.email || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-slate-100 text-slate-800">
                                                {driver.vehicleType || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {(() => {
                                                if (!driver.createdAt) return 'N/A';
                                                try {
                                                    // Handle Firebase Timestamp or standard date string
                                                    const dateVar = driver.createdAt?.toDate ? driver.createdAt.toDate() : new Date(driver.createdAt);
                                                    return dateVar.toLocaleString('en-IN', {
                                                        day: '2-digit', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit', hour12: true
                                                    });
                                                } catch (e) {
                                                    return 'Invalid Date';
                                                }
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${driver.isApproved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {driver.isApproved ? 'Approved' : 'Not Approved'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            {driver.status === 'Blocked' && !driver.isApproved ? (
                                                <button
                                                    onClick={(e) => handleToggleClick(e, driver)}
                                                    className="inline-flex items-center px-3 py-1.5 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 border-transparent text-white bg-slate-600 hover:bg-slate-700 focus:ring-slate-500"
                                                >
                                                    Unblock
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => handleToggleClick(e, driver)}
                                                    className={`inline-flex items-center px-3 py-1.5 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${driver.isApproved
                                                        ? 'border-red-300 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500'
                                                        : 'border-transparent text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
                                                        }`}
                                                >
                                                    {driver.isApproved ? 'De-approve' : 'Approve'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col space-y-4">
                        {loading ? (
                            <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                <div className="flex flex-col items-center justify-center">
                                    <div className="w-8 h-8 mb-4 border-4 border-primary-200 rounded-full border-t-primary-600 animate-spin"></div>
                                    <p>Loading driver data...</p>
                                </div>
                            </div>
                        ) : filteredDrivers.length === 0 ? (
                            <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                No drivers found matching your criteria.
                            </div>
                        ) : (
                            filteredDrivers.map((driver) => (
                                <div
                                    key={driver.id}
                                    onClick={() => handleRowClick(driver)}
                                    className="bg-white border text-left border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="relative">
                                                <div className={`w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg uppercase ${driver.hasSubscription ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                                                    {driver.name && typeof driver.name === 'string' ? driver.name.charAt(0) : '?'}
                                                </div>
                                                {driver.hasSubscription && (
                                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-white rounded-full"></div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 flex items-center">
                                                    {driver.name || 'Unknown'}
                                                    {!driver.isApproved && driver.createdAt && (
                                                        (() => {
                                                            const createdAtDate = driver.createdAt?.toDate ? driver.createdAt.toDate() : new Date(driver.createdAt);
                                                            const hoursDiff = Math.abs(new Date() - createdAtDate) / 36e5;
                                                            return hoursDiff <= 24;
                                                        })()
                                                    ) && (
                                                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">New</span>
                                                        )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 tracking-tight">ID: {driver.id?.substring(0, 10)}...</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Contact</div>
                                            <div className="text-slate-900 font-medium truncate">{driver.phone || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Vehicle</div>
                                            <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded bg-white border border-slate-200 text-slate-700">
                                                {driver.vehicleType || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Joined</div>
                                            <div className="text-slate-600 text-xs">
                                                {(() => {
                                                    if (!driver.createdAt) return 'N/A';
                                                    try {
                                                        const dateVar = driver.createdAt?.toDate ? driver.createdAt.toDate() : new Date(driver.createdAt);
                                                        return dateVar.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
                                                    } catch (e) { return 'Invalid'; }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${driver.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {driver.isApproved ? 'Approved' : 'Not Approved'}
                                        </span>
                                        {driver.status === 'Blocked' && !driver.isApproved ? (
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleClick(e, driver); }} className="px-4 py-1.5 bg-slate-600 text-white text-xs font-semibold rounded-lg shadow-sm">
                                                Unblock
                                            </button>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleClick(e, driver); }} className={`px-4 py-1.5 text-white text-xs font-semibold rounded-lg shadow-sm ${driver.isApproved ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-primary-600'}`}>
                                                {driver.isApproved ? 'De-approve' : 'Approve'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination Dummy UI */}
                <div className="flex items-center justify-between px-4 py-3 mt-4 border-t border-slate-200 sm:px-6">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-slate-700">
                                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredDrivers.length}</span> of <span className="font-medium">{filteredDrivers.length}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button className="relative inline-flex items-center px-2 py-2 text-sm font-medium border rounded-l-md border-slate-300 bg-slate-50 text-slate-300 cursor-not-allowed">
                                    Previous
                                </button>
                                <button className="relative inline-flex items-center px-4 py-2 text-sm font-medium border border-slate-300 bg-primary-50 text-primary-600">
                                    1
                                </button>
                                <button className="relative inline-flex items-center px-2 py-2 text-sm font-medium border rounded-r-md border-slate-300 bg-slate-50 text-slate-300 cursor-not-allowed">
                                    Next
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>

            </div>

            {/* Confirmation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 z-0 transition-opacity bg-slate-900/50 backdrop-blur-sm" onClick={() => !actionLoading && setIsModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="relative z-10 inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-2xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="sm:flex sm:items-start">
                                <div className={`flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto rounded-full sm:mx-0 sm:h-10 sm:w-10 ${selectedDriver?.isApproved ? 'bg-red-100' : selectedDriver?.status === 'Blocked' ? 'bg-slate-100' : 'bg-primary-100'}`}>
                                    {selectedDriver?.isApproved ? (
                                        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    ) : selectedDriver?.status === 'Blocked' ? (
                                        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                    <h3 className="text-lg font-medium leading-6 text-slate-900" id="modal-title">
                                        {selectedDriver?.isApproved ? 'De-approve Driver' : selectedDriver?.status === 'Blocked' ? 'Unblock & Approve Driver' : 'Approve Driver'}
                                    </h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-slate-500">
                                            Are you sure you want to {selectedDriver?.isApproved ? 'de-approve' : selectedDriver?.status === 'Blocked' ? 'unblock and approve' : 'approve'} <strong>{selectedDriver?.name}</strong>?
                                            {selectedDriver?.isApproved
                                                ? ' They will no longer be able to accept rides on the platform and their account will be blocked.'
                                                : selectedDriver?.status === 'Blocked'
                                                    ? ' Their account will be unblocked and they will immediately regain access to accept rides.'
                                                    : ' They will immediately gain access to the driver application and be able to receive ride requests.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    className={`inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors ${selectedDriver?.isApproved
                                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400'
                                        : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 disabled:bg-primary-400'
                                        }`}
                                    onClick={confirmToggleStatus}
                                >
                                    {actionLoading ? 'Processing...' : `Confirm ${selectedDriver?.isApproved ? 'De-approval' : selectedDriver?.status === 'Blocked' ? 'Unblock' : 'Approval'}`}
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium bg-white border rounded-md shadow-sm border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Driver Detail Drawer */}
            <DriverDetailDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                driver={selectedDriverForDetails}
                onSave={handleSaveDriverDetails}
                isSaving={isSavingDetails}
            />
        </div>
    );
}
