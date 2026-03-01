import React, { useState, useEffect } from 'react';
import { Search, MapPin, Wallet, Mail, Phone, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCustomers, updateCustomerDetails } from '../services/customerService';
import CustomerDetailDrawer from '../components/CustomerDetailDrawer';

export default function CustomerManagement() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isSavingDetails, setIsSavingDetails] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const data = await fetchCustomers();
            setCustomers(data);
        } catch (error) {
            toast.error('Failed to load customers');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = (customer) => {
        setSelectedCustomer(customer);
        setIsDrawerOpen(true);
    };

    const handleSaveCustomerDetails = async (updatedCustomer) => {
        setIsSavingDetails(true);
        try {
            await updateCustomerDetails(updatedCustomer.id, updatedCustomer);
            setCustomers(customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
            toast.success('Customer details updated successfully');
            setIsDrawerOpen(false);
        } catch (error) {
            toast.error('Failed to update customer details');
            console.error(error);
        } finally {
            setIsSavingDetails(false);
        }
    };

    const filteredCustomers = customers.filter(customer => {
        const cName = customer.name || "";
        const cPhone = customer.phone || "";
        const cEmail = customer.email || "";

        const searchLower = search.toLowerCase();
        return cName.toLowerCase().includes(searchLower) ||
            String(cPhone).includes(searchLower) ||
            cEmail.toLowerCase().includes(searchLower);
    });

    const formatTimestamp = (timestamp) => {
        if (!timestamp || timestamp === "NA") return 'N/A';
        try {
            // Check if it's a Firestore Timestamp object
            const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch {
            return 'Invalid Date';
        }
    };

    const getInitials = (name) => {
        if (!name || name === "NA") return '?';
        return name.charAt(0).toUpperCase();
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Customer Management</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        View and search through registered customer profiles.
                    </p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                    Export Data
                </button>
            </div>

            <div className="flex flex-col flex-1 p-6 bg-white border rounded-xl border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="relative w-full max-w-sm">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search className="w-5 h-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:ring-primary-500 focus:border-primary-500 text-slate-900 placeholder-slate-400"
                            placeholder="Search by name, phone, or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-slate-500">
                        Total Customers: <span className="font-semibold text-slate-900">{filteredCustomers.length}</span>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto border rounded-xl border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Customer Info
                                </th>
                                <th scope="col" className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Contact Details
                                </th>
                                <th scope="col" className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Wallet Balance
                                </th>
                                <th scope="col" className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Location
                                </th>
                                <th scope="col" className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-slate-500 uppercase">
                                    Joined Date
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-16 text-center text-sm text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-8 h-8 mb-4 border-4 border-primary-200 rounded-full border-t-primary-600 animate-spin"></div>
                                            <p className="font-medium">Loading customers...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-16 text-center text-sm text-slate-500">
                                        <div className="flex flex-col items-center justify-center bg-slate-50 mx-auto w-16 h-16 rounded-full mb-3">
                                            <Search className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <p className="font-medium text-slate-900">No customers found</p>
                                        <p className="mt-1">Try adjusting your search query.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        onClick={() => handleRowClick(customer)}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 w-10 h-10 bg-primary-100/50 rounded-full flex items-center justify-center text-primary-700 font-bold border border-primary-200 shadow-sm relative overflow-hidden">
                                                    {(customer.photoUrl && customer.photoUrl !== "NA") ? (
                                                        <img src={customer.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        getInitials(customer.name)
                                                    )}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-semibold text-slate-900 capitalize">
                                                        {customer.name !== "NA" ? customer.name : 'Unknown'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center mt-0.5" title="UID">
                                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{customer.uid?.substring(0, 8)}...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col space-y-1">
                                                <div className="flex items-center text-sm text-slate-700">
                                                    <Phone className="w-3.5 h-3.5 mr-2 text-slate-400 flex-shrink-0" />
                                                    {customer.phone !== "NA" ? customer.phone : 'No Phone'}
                                                </div>
                                                <div className="flex items-center text-sm text-slate-500">
                                                    <Mail className="w-3.5 h-3.5 mr-2 text-slate-400 flex-shrink-0" />
                                                    {customer.email !== "NA" && customer.email ? customer.email : 'No Email'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
                                                <Wallet className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                                ₹{customer.wallet !== "NA" ? Number(customer.wallet).toFixed(2) : '0.00'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <div className="flex items-start text-sm text-slate-700 max-w-[200px] truncate">
                                                    <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate" title={customer.address !== "NA" ? customer.address : 'Location Unspecified'}>
                                                        {customer.address !== "NA" ? customer.address : 'Unspecified'}
                                                    </span>
                                                </div>
                                                {(customer.state !== "NA" || customer.pincode !== "NA") && (
                                                    <div className="text-xs text-slate-500 ml-5 mt-0.5">
                                                        {[customer.state !== "NA" ? customer.state : null, customer.pincode !== "NA" ? customer.pincode : null].filter(Boolean).join(' - ')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex items-center h-full pt-6">
                                            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                                            {formatTimestamp(customer.createdAt)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CustomerDetailDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                customer={selectedCustomer}
                onSave={handleSaveCustomerDetails}
                isSaving={isSavingDetails}
            />
        </div>
    );
}
