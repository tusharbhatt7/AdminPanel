import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Plus, Trash2, Video, Image as ImageIcon, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Advertisements() {
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedAd, setSelectedAd] = useState(null);

    // Form State
    const [file, setFile] = useState(null);
    const [adPrice, setAdPrice] = useState('');

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'user_ads'));
            const querySnapshot = await getDocs(q);
            const adsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAds(adsData);
        } catch (error) {
            console.error("Error fetching ads:", error);
            toast.error("Failed to load advertisements");
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !adPrice) {
            toast.error("Please provide both file and price");
            return;
        }

        setUploading(true);
        const fileType = file.type.startsWith('video/') ? 'video' : 'image';
        const storageRef = ref(storage, `ads/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload error:", error);
                toast.error("Failed to upload file");
                setUploading(false);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const newAdId = `ad_${Date.now()}`;

                    await addDoc(collection(db, 'user_ads'), {
                        adId: newAdId,
                        adPrice: Number(adPrice),
                        adType: fileType,
                        adUrl: downloadURL,
                        impressions: 0
                    });

                    toast.success("Advertisement uploaded successfully");
                    setShowUploadModal(false);
                    setFile(null);
                    setAdPrice('');
                    setUploadProgress(0);
                    fetchAds();
                } catch (error) {
                    console.error("Error saving ad details:", error);
                    toast.error("Failed to save advertisement details");
                } finally {
                    setUploading(false);
                }
            }
        );
    };

    const handleDelete = async (ad) => {
        if (!window.confirm("Are you sure you want to delete this ad?")) return;

        try {
            // Delete document from Firestore
            await deleteDoc(doc(db, 'user_ads', ad.id));

            // Attempt to delete file from Storage
            try {
                const fileRef = ref(storage, ad.adUrl);
                await deleteObject(fileRef);
            } catch (storageError) {
                console.warn("Could not delete file from storage. It might have been already deleted or the URL is invalid.", storageError);
            }

            toast.success("Advertisement deleted successfully");
            fetchAds();
        } catch (error) {
            console.error("Error deleting ad:", error);
            toast.error("Failed to delete advertisement");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Advertisements</h1>
                        <p className="mt-1 text-slate-500">Manage promotional banners and videos.</p>
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center px-4 py-2 text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Upload New Ad
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                    </div>
                ) : ads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white border rounded-xl border-slate-200">
                        <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-slate-50">
                            <Video className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-900">No advertisements found</p>
                        <p className="text-slate-500">Upload your first ad to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {ads.map((ad) => (
                            <div key={ad.id} className="overflow-hidden bg-white border rounded-xl border-slate-200 shadow-sm flex flex-col group">
                                <div
                                    className="relative aspect-video bg-slate-100 flex items-center justify-center cursor-pointer group-hover:opacity-90 transition-opacity"
                                    onClick={() => setSelectedAd(ad)}
                                >
                                    {ad.adType === 'video' ? (
                                        <video src={ad.adUrl} className="object-cover w-full h-full" playsInline />
                                    ) : (
                                        <img src={ad.adUrl} alt="Ad" className="object-cover w-full h-full" />
                                    )}
                                    <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(ad); }}
                                            className="p-1.5 bg-red-500/90 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm backdrop-blur-sm z-10"
                                            title="Delete Ad"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-white text-xs font-medium flex items-center">
                                        {ad.adType === 'video' ? <Video className="w-3 h-3 mr-1" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                                        <span className="capitalize">{ad.adType}</span>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 truncate" title={ad.adId}>{ad.adId}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Price: ₹{ad.adPrice}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-primary-600">{ad.impressions || 0}</p>
                                            <p className="text-xs text-slate-500">Impressions</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-6 animate-in slide-in-from-bottom-4 duration-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Upload Advertisement</h2>

                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Media (Image/Video)</label>
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 border border-slate-200 rounded-lg cursor-pointer"
                                    disabled={uploading}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Price per View/Click (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={adPrice}
                                        onChange={(e) => setAdPrice(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-shadow"
                                        placeholder="10"
                                        disabled={uploading}
                                        required
                                    />
                                </div>
                            </div>

                            {uploading && (
                                <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
                                    <div
                                        className="bg-primary-600 h-2.5 rounded-full transition-all duration-300 relative"
                                        style={{ width: `${uploadProgress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!uploading) {
                                            setShowUploadModal(false);
                                            setFile(null);
                                            setAdPrice('');
                                        }
                                    }}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm"
                                    disabled={uploading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || !file || !adPrice}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm hover:shadow"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Uploading {Math.round(uploadProgress)}%
                                        </>
                                    ) : 'Upload Ad'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* View Ad Modal */}
            {selectedAd && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm"
                    onClick={() => setSelectedAd(null)}
                >
                    <div
                        className="relative w-full max-w-4xl max-h-screen flex items-center justify-center animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedAd(null)}
                            className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        {selectedAd.adType === 'video' ? (
                            <video src={selectedAd.adUrl} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" controls autoPlay playsInline />
                        ) : (
                            <img src={selectedAd.adUrl} alt="Ad Full View" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
