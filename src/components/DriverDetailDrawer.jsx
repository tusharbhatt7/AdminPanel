import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, Car, CircleDot, Image as ImageIcon, FileText, ShieldCheck, Clock, CheckCircle2, AlertCircle, Calendar, CreditCard, Activity, Award } from 'lucide-react';

export default function DriverDetailDrawer({ isOpen, onClose, driver, onSave, isSaving }) {
    const [formData, setFormData] = useState({});
    const [activeTab, setActiveTab] = useState('profile');
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [lightboxImg, setLightboxImg] = useState(null);

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
        if (driver && isOpen) {
            setFormData({
                name: driver.name || '',
                email: driver.email || '',
                phone: driver.phone || '',
                gender: driver.gender || '',
                dob: driver.dateOfBirth || driver.dob || '',
                vehicleType: driver.vehicleType || '',
                status: driver.status || 'Offline',
                walletBalance: driver.walletBalance || 0,
                totalEarnings: driver.totalEarnings || 0,
                selfieUrl: driver.selfieUrl || driver.profileImageUrl || '',
                idFrontUrl: driver.idFrontUrl || driver.idFrontImageUrl || '',
                idBackUrl: driver.idBackUrl || driver.idBackImageUrl || '',
                licenseFrontUrl: driver.licenseFrontUrl || driver.licenseImageUrl || '',
                licenseBackUrl: driver.licenseBackUrl || '',
                rcBookUrl: driver.rcBookUrl || '',
                selfieStatus: driver.selfieStatus || 'pending',
                idFrontStatus: driver.idFrontStatus || 'pending',
                idBackStatus: driver.idBackStatus || 'pending',
                licenseFrontStatus: driver.licenseFrontStatus || 'pending',
                licenseBackStatus: driver.licenseBackStatus || 'pending',
                rcBookStatus: driver.rcBookStatus || 'pending',
                selfieReason: driver.selfieReason || '',
                idFrontReason: driver.idFrontReason || '',
                idBackReason: driver.idBackReason || '',
                licenseFrontReason: driver.licenseFrontReason || '',
                licenseBackReason: driver.licenseBackReason || '',
                rcBookReason: driver.rcBookReason || '',
            });
            setActiveTab('profile'); // Reset to first tab on open
        }
    }, [driver, isOpen]);

    // To ensure the slide-in animation plays, we conditionally render based on shouldRender state
    if (!shouldRender) return null;

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Auto-approve logic: if all documents are verified, auto set isApproved to true
        const allDocsVerified =
            formData.idFrontStatus === 'verified' &&
            formData.idBackStatus === 'verified' &&
            formData.licenseFrontStatus === 'verified' &&
            formData.licenseBackStatus === 'verified' &&
            formData.rcBookStatus === 'verified' &&
            formData.selfieStatus === 'verified';

        const willBeApproved = allDocsVerified ? true : driver.isApproved;
        let newStatus = formData.status;
        if (!driver.isApproved && willBeApproved) {
            newStatus = 'approved';
        } else if (driver.isApproved && !willBeApproved) {
            newStatus = 'Blocked';
        }

        onSave({
            ...driver,
            ...formData,
            isApproved: willBeApproved,
            status: newStatus
        });
    };

    const DocumentCard = ({ title, url, statusName, statusValue, reasonName, reasonValue }) => (
        <div className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg hover:border-primary-200 hover:-translate-y-1">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center transition-colors group-hover:bg-primary-50/50">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-2 text-primary-500 transition-transform group-hover:scale-110 duration-300" />
                    {title}
                </h4>
                <select
                    name={statusName}
                    value={statusValue}
                    onChange={handleChange}
                    className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 shadow-sm focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all duration-200 ${statusValue === 'verified' ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' :
                        statusValue === 'rejected' ? 'text-rose-700 bg-rose-100 hover:bg-rose-200' : 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                        }`}
                >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
            <div className="p-4 bg-slate-50 flex-1 flex flex-col justify-center items-center overflow-hidden">
                {url ? (
                    <button type="button" onClick={() => setLightboxImg(url)} className="block w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <img src={url} alt={title} className="w-full h-48 object-cover rounded-lg border border-slate-200 shadow-sm transition-transform duration-500 group-hover:scale-105" />
                    </button>
                ) : (
                    <div className="w-full h-48 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white transition-colors duration-300 group-hover:border-primary-300 group-hover:bg-primary-50/30">
                        <ImageIcon className="w-8 h-8 mb-3 text-slate-300 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary-400" />
                        <span className="text-sm font-medium transition-colors duration-300 group-hover:text-primary-500">No Image Uploaded</span>
                    </div>
                )}
            </div>
            {statusValue === 'rejected' && (
                <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100 pt-3">
                    <label className="block text-xs font-semibold text-rose-600 mb-1.5 flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Rejection Reason</label>
                    <input
                        type="text"
                        name={reasonName}
                        value={reasonValue || ''}
                        onChange={handleChange}
                        placeholder="Why is it rejected?"
                        className="w-full px-3 py-2 text-sm bg-white border border-rose-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm outline-none"
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />

            {/* Drawer Container */}
            <div className={`relative w-full sm:max-w-xl md:max-w-2xl bg-slate-50 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Premium Header */}
                <div className="relative bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-800 px-4 sm:px-6 py-6 sm:py-8 pb-12 sm:pb-16 shrink-0 shadow-inner">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 active:scale-95 z-10">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5 relative z-10 text-center sm:text-left">
                        <div className="relative group cursor-pointer shrink-0">
                            {formData.selfieUrl ? (
                                <img src={formData.selfieUrl} alt="Profile" className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 shadow-lg bg-white transition-transform duration-300 group-hover:scale-105 ${driver?.hasSubscription ? 'border-amber-400 ring-2 ring-amber-400 ring-offset-2 ring-offset-primary-700' : 'border-white'}`} />
                            ) : (
                                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-100 border-4 shadow-lg flex items-center justify-center text-primary-700 text-2xl sm:text-3xl font-bold uppercase transition-transform duration-300 group-hover:scale-105 ${driver?.hasSubscription ? 'border-amber-400 ring-2 ring-amber-400 ring-offset-2 ring-offset-primary-700' : 'border-white'}`}>
                                    {formData.name ? formData.name.charAt(0) : '?'}
                                </div>
                            )}
                            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-sm z-10 transition-transform duration-300 group-hover:scale-110 ${formData.status === 'Online' ? 'bg-emerald-500' : formData.status === 'Blocked' ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                            {driver?.hasSubscription && (
                                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-amber-400 text-white rounded-full p-1 sm:p-1.5 border-2 border-white shadow-sm z-20 animate-bounce" style={{ animationDuration: '2s' }} title="Active Subscription">
                                    <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </div>
                            )}
                        </div>
                        <div className="text-white">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{formData.name || 'Unknown Driver'}</h2>
                            <p className="text-primary-100/90 font-medium text-xs sm:text-sm mt-0.5">ID: {driver?.id}</p>
                            <div className="mt-2 flex items-center justify-center sm:justify-start space-x-2">
                                <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md ${driver?.isApproved ? 'bg-emerald-400/20 text-emerald-50 border border-emerald-400/30' : 'bg-rose-400/20 text-rose-50 border border-rose-400/30'}`}>
                                    {driver?.isApproved ? (
                                        <><ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> Verified Partner</>
                                    ) : (
                                        <><AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> Pending Approval</>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-0 flex flex-col -mt-4 sm:-mt-8 mx-4 sm:mx-6 bg-white rounded-t-2xl shadow-sm border border-slate-200 overflow-hidden z-10">

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 px-1 sm:px-2 pt-1 sm:pt-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('profile')}
                            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-center border-b-2 transition-all duration-300 outline-none ${activeTab === 'profile' ? 'border-primary-600 text-primary-700 bg-primary-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                        >
                            <User className={`w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5 sm:mr-2 mb-0.5 transition-colors duration-300 ${activeTab === 'profile' ? 'text-primary-600' : 'text-slate-400'}`} />
                            Profile & Vehicle
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('documents')}
                            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-center border-b-2 transition-all duration-300 outline-none ${activeTab === 'documents' ? 'border-primary-600 text-primary-700 bg-primary-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                        >
                            <FileText className={`w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5 sm:mr-2 mb-0.5 transition-colors duration-300 ${activeTab === 'documents' ? 'text-primary-600' : 'text-slate-400'}`} />
                            Verification Docs
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-28">
                        <form id="driver-edit-form" onSubmit={handleSubmit}>
                            {/* TAB: PROFILE */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6 sm:space-y-8 transition-all duration-500 ease-in-out origin-top">

                                    {/* Personal Info Section */}
                                    <div className="group/section">
                                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 sm:mb-4 flex items-center"><User className="w-4 h-4 mr-2 text-primary-500 transition-transform group-hover/section:scale-110 duration-300" /> Personal Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                            <div className="col-span-1 md:col-span-2 group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 transition-colors group-focus-within/input:text-primary-600">Full Name</label>
                                                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm outline-none" required />
                                            </div>
                                            <div className="group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Phone className="w-3 h-3 mr-1" /> Phone Number</label>
                                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm outline-none" />
                                            </div>
                                            <div className="group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Mail className="w-3 h-3 mr-1" /> Email Address</label>
                                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm outline-none" />
                                            </div>
                                            <div className="group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><User className="w-3 h-3 mr-1" /> Gender</label>
                                                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm cursor-pointer outline-none">
                                                    <option value="">Select...</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Calendar className="w-3 h-3 mr-1" /> Date of Birth</label>
                                                <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm cursor-pointer outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="border-slate-100" />

                                    {/* Operational Details */}
                                    <div className="group/section">
                                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center"><Activity className="w-4 h-4 mr-2 text-primary-500 transition-transform group-hover/section:scale-110 duration-300" /> Operational Attributes</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><Car className="w-3 h-3 mr-1" /> Vehicle Category</label>
                                                <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm cursor-pointer outline-none">
                                                    <option value="">Select...</option>
                                                    <option value="Mini">Mini</option>
                                                    <option value="Sedan">Sedan</option>
                                                    <option value="SUV">SUV</option>
                                                    <option value="Bike">Bike</option>
                                                    <option value="Auto">Auto</option>
                                                    <option value="Parcel">Parcel</option>
                                                </select>
                                            </div>
                                            <div className="group/input">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center transition-colors group-focus-within/input:text-primary-600"><CircleDot className="w-3 h-3 mr-1" /> Operational Status</label>
                                                <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm cursor-pointer outline-none">
                                                    <option value="Online">Online</option>
                                                    <option value="Offline">Offline</option>
                                                    <option value="Blocked">Blocked</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="border-slate-100" />

                                    {/* Subscription Info */}
                                    {driver?.hasSubscription && (
                                        <>
                                            <div>
                                                <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center"><Award className="w-4 h-4 mr-2" /> Subscription Details</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-xl border border-amber-200">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-amber-700/70 mb-1">Plan Name</label>
                                                        <div className="text-sm font-bold text-amber-900">{driver.subscriptionDetails?.planName || driver.subscriptionDetails?.name || 'Premium Plan'}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-amber-700/70 mb-1">Status</label>
                                                        <div className="text-sm font-bold text-emerald-600 flex items-center">
                                                            <CheckCircle2 className="w-4 h-4 mr-1" />
                                                            {driver.subscriptionDetails?.status || 'Active'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-amber-700/70 mb-1">Start Date</label>
                                                        <div className="text-sm font-semibold text-amber-900">
                                                            {driver.subscriptionDetails?.startDate ? new Date(driver.subscriptionDetails.startDate).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-amber-700/70 mb-1">End Date</label>
                                                        <div className="text-sm font-semibold text-amber-900">
                                                            {driver.subscriptionDetails?.endDate ? new Date(driver.subscriptionDetails.endDate).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                    </div>
                                                    {driver.subscriptionDetails?.amount && (
                                                        <div>
                                                            <label className="block text-xs font-semibold text-amber-700/70 mb-1">Amount Paid</label>
                                                            <div className="text-sm font-bold text-amber-900">₹{driver.subscriptionDetails.amount}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <hr className="border-slate-100" />
                                        </>
                                    )}

                                    {/* Financials */}
                                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center"><CreditCard className="w-4 h-4 mr-2 text-primary-500" /> Financial Overview</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group/card">
                                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 transition-colors group-hover/card:text-primary-500">Wallet Balance</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-slate-500 font-semibold group-focus-within/card:text-primary-600 transition-colors">₹</span>
                                                    </div>
                                                    <input type="number" name="walletBalance" value={formData.walletBalance} onChange={handleChange} className="w-full pl-8 pr-4 py-2.5 text-lg font-bold text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-300 shadow-sm focus:shadow-md outline-none" />
                                                </div>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group/card">
                                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 transition-colors group-hover/card:text-emerald-500">Total Earnings</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-slate-500 font-semibold group-focus-within/card:text-emerald-600 transition-colors">₹</span>
                                                    </div>
                                                    <input type="number" name="totalEarnings" value={formData.totalEarnings} onChange={handleChange} className="w-full pl-8 pr-4 py-2.5 text-lg font-bold text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 hover:border-slate-300 shadow-sm focus:shadow-md outline-none" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: DOCUMENTS */}
                            {activeTab === 'documents' && (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 flex items-start space-x-3 mt-2">
                                        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-blue-800">Verification Center</h4>
                                            <p className="text-xs text-blue-600 mt-1">Review uploaded documents and update their verification status. Changes will be saved to the driver's profile.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                                        <DocumentCard title="Selfie Verification" url={formData.selfieUrl} statusName="selfieStatus" statusValue={formData.selfieStatus} reasonName="selfieReason" reasonValue={formData.selfieReason} />
                                        <DocumentCard title="ID Verification (Front)" url={formData.idFrontUrl} statusName="idFrontStatus" statusValue={formData.idFrontStatus} reasonName="idFrontReason" reasonValue={formData.idFrontReason} />
                                        <DocumentCard title="ID Verification (Back)" url={formData.idBackUrl} statusName="idBackStatus" statusValue={formData.idBackStatus} reasonName="idBackReason" reasonValue={formData.idBackReason} />
                                        <DocumentCard title="Driving License (Front)" url={formData.licenseFrontUrl} statusName="licenseFrontStatus" statusValue={formData.licenseFrontStatus} reasonName="licenseFrontReason" reasonValue={formData.licenseFrontReason} />
                                        <DocumentCard title="Driving License (Back)" url={formData.licenseBackUrl} statusName="licenseBackStatus" statusValue={formData.licenseBackStatus} reasonName="licenseBackReason" reasonValue={formData.licenseBackReason} />
                                        <DocumentCard title="Vehicle RC Book" url={formData.rcBookUrl} statusName="rcBookStatus" statusValue={formData.rcBookStatus} reasonName="rcBookReason" reasonValue={formData.rcBookReason} />
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Footer Fixed Actions */}
                <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20">
                    <p className="text-xs text-slate-400 hidden sm:flex items-center transition-opacity hover:opacity-100 opacity-70"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> All changes are synced live</p>
                    <div className="flex space-x-3 w-full sm:w-auto justify-end">
                        <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all duration-200 active:scale-95">
                            Discard
                        </button>
                        <button type="submit" form="driver-edit-form" disabled={isSaving} className="group inline-flex items-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-indigo-600 border border-transparent rounded-xl shadow-sm hover:from-primary-700 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:from-primary-400 disabled:to-indigo-400 disabled:shadow-none transition-all duration-200 active:scale-95">
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 mr-2 border-2 rounded-full border-white/30 border-t-white animate-spin"></div>
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

            {/* Lightbox Modal */}
            {lightboxImg && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setLightboxImg(null)}>
                    <button
                        className="absolute top-6 right-6 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all duration-200 hover:scale-110"
                        onClick={() => setLightboxImg(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={lightboxImg}
                        alt="Document Preview"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
