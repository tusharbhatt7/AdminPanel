import React, { useState, useEffect } from 'react';
import { X, Save, User, Phone, Mail, Hash, Wallet, MapPin, Calendar, Activity, CheckCircle2 } from 'lucide-react';

export default function CustomerDetailDrawer({ isOpen, onClose, customer, onSave, isSaving }) {
    const [formData, setFormData] = useState({});
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            const timer = setTimeout(() => setIsVisible(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (customer && isOpen) {
            setFormData({
                name: customer.name || '',
                phone: customer.phone || '',
                email: customer.email || '',
                dob: customer.dob || '',
                gender: customer.gender || '',
                wallet: customer.wallet || '0',
                address: customer.address || '',
                state: customer.state || '',
                pincode: customer.pincode || '',
                guardianName: customer.guardianName || '',
                guardianPhone: customer.guardianPhone || '',
            });
        }
    }, [customer, isOpen]);

    if (!shouldRender || !customer) return null;

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? value : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...customer,
            ...formData,
        });
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp || timestamp === "NA") return 'N/A';
        try {
            const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch {
            return 'Invalid Date';
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <div className={`absolute inset-0 bg-canvas/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />

            {/* Drawer Container */}
            <div className={`relative w-full sm:max-w-xl md:max-w-2xl bg-raised shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Premium Header */}
                <div className="relative bg-surface border-b border-line px-4 sm:px-6 py-6 sm:py-8 pb-12 sm:pb-16 shrink-0 shadow-inner">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-fg-3 hover:text-fg hover:bg-raised transition-all duration-200 hover:scale-110 active:scale-95 z-10">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5 relative z-10 text-center sm:text-left">
                        <div className="relative group cursor-pointer shrink-0">
                            {(customer.photoUrl && customer.photoUrl !== "NA") ? (
                                <img src={customer.photoUrl} alt="Avatar" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 shadow-lg border-line bg-surface transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-soft border-4 shadow-lg flex items-center justify-center text-brand text-2xl sm:text-3xl font-bold uppercase transition-transform duration-300 group-hover:scale-105 border-line">
                                    {formData.name && formData.name !== "NA" ? formData.name.charAt(0) : '?'}
                                </div>
                            )}
                        </div>
                        <div className="text-fg">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight capitalize">{formData.name !== "NA" ? formData.name : 'Unknown Customer'}</h2>
                            <p className="text-fg-3 font-medium text-xs sm:text-sm mt-0.5 font-mono">ID: {customer.uid}</p>
                            <div className="mt-2 flex items-center justify-center sm:justify-start space-x-2">
                                <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold backdrop-blur-sm transition-all duration-300 bg-ok-soft text-ok border border-ok/30`}>
                                    <Wallet className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> ₹{formData.wallet !== "NA" ? Number(formData.wallet).toFixed(2) : '0.00'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-0 flex flex-col -mt-4 sm:-mt-8 mx-4 sm:mx-6 bg-surface rounded-t-2xl border border-line overflow-hidden z-10 pb-20">

                    <div className="flex border-b border-line bg-surface/80 backdrop-blur-md sticky top-0 z-20 px-1 sm:px-2 pt-1 sm:pt-2">
                        <div className="flex-1 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-center border-b-2 transition-all duration-300 border-primary-600 text-primary-700 bg-primary-50/50 cursor-default">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5 sm:mr-2 mb-0.5 text-primary-600" />
                            Customer Information
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 border-b border-line">
                        <form id="customer-edit-form" onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">

                            {/* Personal Details */}
                            <div className="group/section">
                                <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-3 sm:mb-4 flex items-center"><User className="w-4 h-4 mr-2 text-primary-500 transition-transform group-hover/section:scale-110 duration-300" /> Personal Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    <div className="col-span-1 md:col-span-2 group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 transition-colors group-focus-within/input:text-primary-600">Full Name</label>
                                        <input type="text" name="name" value={formData.name !== "NA" ? formData.name : ''} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none" required placeholder="Full Name" />
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Phone className="w-3 h-3 mr-1" /> Phone Number</label>
                                        <input type="tel" name="phone" value={formData.phone !== "NA" ? formData.phone : ''} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none" placeholder="Phone Number" />
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Mail className="w-3 h-3 mr-1" /> Email Address</label>
                                        <input type="email" name="email" value={formData.email !== "NA" ? formData.email : ''} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none" placeholder="Email Address" />
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Hash className="w-3 h-3 mr-1" /> Date of Birth</label>
                                        <input type="text" value={formData.dob !== "NA" ? formData.dob : ''} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised border border-line text-fg-3 rounded-lg cursor-not-allowed outline-none" disabled placeholder="Not Configured" title="Date of Birth cannot be edited" />
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><User className="w-3 h-3 mr-1" /> Gender</label>
                                        <input type="text" value={formData.gender !== "NA" ? formData.gender : ''} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised border border-line text-fg-3 rounded-lg cursor-not-allowed outline-none" disabled placeholder="Not Configured" title="Gender cannot be edited" />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-line/60" />

                            {/* Address details */}
                            <div className="group/section">
                                <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-3 sm:mb-4 flex items-center"><MapPin className="w-4 h-4 mr-2 text-primary-500 transition-transform group-hover/section:scale-110 duration-300" /> Location Profile</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    <div className="col-span-1 md:col-span-2 group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 transition-colors group-focus-within/input:text-primary-600">Full Address</label>
                                        <textarea name="address" value={formData.address !== "NA" ? formData.address : ''} onChange={handleChange} rows="2" className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none resize-none" placeholder="Primary Address"></textarea>
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 transition-colors group-focus-within/input:text-primary-600">State / Region</label>
                                        <input type="text" name="state" value={formData.state !== "NA" ? formData.state : ''} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none" placeholder="State" />
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-fg-3 mb-1.5 transition-colors group-focus-within/input:text-primary-600">Pincode</label>
                                        <input type="text" name="pincode" value={formData.pincode !== "NA" ? formData.pincode : ''} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none" placeholder="Pin code" />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-line/60" />

                            {/* Guardian Settings */}
                            <div className="group/section">
                                <h3 className="text-sm font-bold text-warn uppercase tracking-wider mb-3 sm:mb-4 flex items-center"><Phone className="w-4 h-4 mr-2" /> Guardian / Emergency Contact</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 bg-warn-soft p-4 sm:p-5 rounded-lg border border-warn/30">
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-warn/80 mb-1 transition-colors group-focus-within/input:text-warn">Guardian Name</label>
                                        <input type="text" name="guardianName" value={formData.guardianName} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-surface border border-warn/30 rounded-lg focus:ring-2 focus:ring-warn/25 focus:border-warn transition-all duration-200 outline-none" placeholder="Emergency Contact Name" />
                                    </div>
                                    <div className="group/input">
                                        <label className="block text-xs font-semibold text-warn/80 mb-1 transition-colors group-focus-within/input:text-warn">Guardian Phone</label>
                                        <input type="tel" name="guardianPhone" value={formData.guardianPhone} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-surface border border-warn/30 rounded-lg focus:ring-2 focus:ring-warn/25 focus:border-warn transition-all duration-200 outline-none" placeholder="Emergency Phone Number" />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-line/60" />

                            {/* Dates Reference */}
                            <div className="bg-raised p-4 sm:p-5 rounded-lg border border-line">
                                <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-3 sm:mb-4 flex items-center"><Calendar className="w-4 h-4 mr-2 text-primary-500" /> Application Data</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative">
                                    <div className="group/card">
                                        <label className="block text-xs font-semibold text-fg-3 uppercase tracking-wider mb-1.5 sm:mb-2">Registered Date</label>
                                        <div className="relative text-sm text-fg-2 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                            {formatTimestamp(customer.createdAt)}
                                        </div>
                                    </div>
                                    <div className="group/card">
                                        <label className="block text-xs font-semibold text-fg-3 uppercase tracking-wider mb-1.5 sm:mb-2">Last Updated</label>
                                        <div className="relative text-sm text-fg-2 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                            {formatTimestamp(customer.updatedAt)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Component */}
                            <div className="bg-raised rounded-lg p-4 sm:p-5 border border-line">
                                <h3 className="text-sm font-bold text-fg uppercase tracking-wider mb-3 sm:mb-4 flex items-center"><Wallet className="w-4 h-4 mr-2 text-primary-500" /> Financial Settings</h3>
                                <div className="bg-surface p-4 rounded-lg shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-line/60 transition-all duration-300 group/card">
                                    <label className="block text-xs font-semibold text-fg-3 uppercase tracking-wider mb-2 transition-colors group-focus-within/card:text-primary-500">Wallet Balance</label>
                                    <div className="relative md:w-1/2">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-fg-3 font-semibold group-focus-within/card:text-primary-600 transition-colors">₹</span>
                                        </div>
                                        <input type="number" step="0.01" name="wallet" value={formData.wallet !== "NA" ? formData.wallet : ''} onChange={handleChange} className="w-full pl-8 pr-3 py-2 sm:pr-4 sm:py-2.5 text-base sm:text-lg font-bold text-fg bg-raised/50 border border-line rounded-lg focus:bg-raised focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-line-strong outline-none" placeholder="0.00" />
                                    </div>
                                </div>
                            </div>

                        </form>
                    </div>

                </div>

                {/* Footer Fixed Actions */}
                <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 py-3 sm:py-4 bg-surface border-t border-line flex justify-between items-center shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20">
                    <p className="text-xs text-fg-3 hidden sm:flex items-center transition-opacity hover:opacity-100 opacity-70"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> All changes are synced live</p>
                    <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
                        <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-fg-2 bg-surface border border-line rounded-lg hover:bg-raised hover:text-fg hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand/25 disabled:opacity-50 transition-all duration-200 active:scale-95">
                            Discard
                        </button>
                        <button type="submit" form="customer-edit-form" disabled={isSaving} className="group btn btn-primary">
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 mr-2 border-2 rounded-full border-line border-t-white animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                                    Save Profile
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
