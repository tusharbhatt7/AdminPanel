import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
    Plus, Trash2, Video, Image as ImageIcon, Loader2, X, Play,
    MonitorPlay, Eye, IndianRupee, CircleCheck, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/useAuth';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// The audit found a second, typo'd counter on some ad documents: "impressions "
// with a trailing space. Read both so the UI never under-reports, and say so.
const STRAY_KEY = 'impressions ';
const impressionsOf = (ad) => Number(ad.impressions || 0) + Number(ad[STRAY_KEY] || 0);
const hasStrayField = (ad) => Object.prototype.hasOwnProperty.call(ad, STRAY_KEY);

export default function Advertisements() {
    const { actor } = useAuth();
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

                    await recordAudit({
                        actor, action: AUDIT_ACTIONS.AD_CREATED, targetType: 'advertisement',
                        targetId: newAdId, targetLabel: newAdId,
                        metadata: { adType: fileType, adPrice: Number(adPrice), fileName: file.name },
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

            await recordAudit({
                actor, action: AUDIT_ACTIONS.AD_DELETED, targetType: 'advertisement',
                targetId: ad.id, targetLabel: ad.adId || ad.id,
                metadata: { adType: ad.adType, adPrice: ad.adPrice },
            });
            toast.success("Advertisement deleted successfully");
            fetchAds();
        } catch (error) {
            console.error("Error deleting ad:", error);
            toast.error("Failed to delete advertisement");
        }
    };

    const stats = useMemo(() => {
        const impressions = ads.reduce((a, ad) => a + impressionsOf(ad), 0);
        const prices = ads.map((a) => Number(a.adPrice || 0)).filter((n) => n > 0);
        return {
            total: ads.length,
            active: ads.filter((a) => a.isActive !== false).length,
            impressions,
            avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
            stray: ads.filter(hasStrayField).length,
        };
    }, [ads]);

    const kpis = [
        { label: 'Total Ads', value: stats.total, icon: MonitorPlay, tone: 'bg-info-soft text-info' },
        { label: 'Active', value: stats.active, icon: CircleCheck, tone: 'bg-ok-soft text-ok' },
        { label: 'Total Impressions', value: stats.impressions, icon: Eye, tone: 'bg-violet-soft text-violet' },
        { label: 'Average Price', value: stats.avgPrice, prefix: '₹', icon: IndianRupee, tone: 'bg-brand-soft text-brand-ink' },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[20px] font-bold tracking-tight text-fg">Advertisements</h1>
                    <p className="mt-0.5 text-[13px] text-fg-2">
                        In-app promotional banners and videos served to riders.
                    </p>
                </div>
                <button onClick={() => setShowUploadModal(true)} className="btn btn-primary">
                    <Plus className="w-4 h-4" /> Upload Ad
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="flex flex-col p-4 border rounded-xl bg-surface border-line lift">
                            <div className="flex items-center gap-2.5 mb-3">
                                <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${s.tone}`}>
                                    <Icon className="w-[18px] h-[18px]" />
                                </span>
                                <span className="text-[12px] font-medium leading-tight text-fg-2">{s.label}</span>
                            </div>
                            {loading ? (
                                <div className="w-16 h-7 skeleton" />
                            ) : (
                                <p className="text-[24px] font-bold leading-none tracking-tight text-fg tabular">
                                    {s.prefix || ''}{s.value.toLocaleString('en-IN')}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {stats.stray > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 text-[13px] border rounded-lg bg-warn-soft border-warn/30 text-fg-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warn" />
                    <span>
                        <strong className="text-fg">{stats.stray}</strong> of these documents carry a second impression
                        counter named <code className="font-mono text-[11px]">&quot;impressions&nbsp;&quot;</code> with a
                        trailing space. Both are counted above, but whichever writer produced it should be fixed.
                    </span>
                </div>
            )}

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 skeleton rounded-xl" />)}
                </div>
            ) : ads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-surface border-line lift">
                    <MonitorPlay className="w-8 h-8 mb-3 text-fg-3 opacity-50" />
                    <p className="text-[14px] font-medium text-fg">No advertisements yet</p>
                    <p className="mt-1 mb-4 text-[13px] text-fg-3">Upload a banner or video to start serving ads.</p>
                    <button onClick={() => setShowUploadModal(true)} className="btn btn-primary">
                        <Plus className="w-4 h-4" /> Upload Ad
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {ads.map((ad) => {
                        const seen = impressionsOf(ad);
                        const cap = Number(ad.maxImpressions || 0);
                        const pct = cap ? Math.min((seen / cap) * 100, 100) : null;
                        const isVideo = ad.adType === 'video';
                        return (
                            <div key={ad.id} className="flex flex-col overflow-hidden border rounded-xl bg-surface border-line lift group">
                                {/* Preview */}
                                <button
                                    onClick={() => setSelectedAd(ad)}
                                    className="relative block w-full overflow-hidden aspect-video bg-raised"
                                    aria-label="Preview advertisement"
                                >
                                    {isVideo ? (
                                        <>
                                            <video src={ad.adUrl} className="object-cover w-full h-full" muted playsInline preload="metadata" />
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <span className="flex items-center justify-center rounded-full w-9 h-9 bg-canvas/70 backdrop-blur-sm">
                                                    <Play className="w-4 h-4 text-fg" />
                                                </span>
                                            </span>
                                        </>
                                    ) : (
                                        <img src={ad.adUrl} alt="" className="object-cover w-full h-full" loading="lazy" />
                                    )}

                                    <span className="absolute flex items-center gap-1 px-2 py-1 rounded-md top-2 left-2 bg-canvas/80 backdrop-blur-sm">
                                        {isVideo ? <Video className="w-3 h-3 text-fg" /> : <ImageIcon className="w-3 h-3 text-fg" />}
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-fg">{ad.adType || 'image'}</span>
                                    </span>

                                    {ad.isActive === false && (
                                        <span className="absolute top-2 right-2 pill pill-neutral">paused</span>
                                    )}
                                </button>

                                {/* Meta */}
                                <div className="flex flex-col gap-2.5 p-3">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="font-mono text-[15px] font-semibold text-fg">{money(ad.adPrice)}</span>
                                        <span className="font-mono text-[11px] text-fg-3 truncate" title={ad.adId}>{ad.adId}</span>
                                    </div>

                                    <div>
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className="text-[11px] text-fg-3">Impressions</span>
                                            <span className="font-mono text-[11px] text-fg tabular">
                                                {seen.toLocaleString('en-IN')}{cap ? ` / ${cap.toLocaleString('en-IN')}` : ''}
                                            </span>
                                        </div>
                                        {pct !== null ? (
                                            <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                                                <div
                                                    className="h-full rounded-full bg-info"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-fg-3">no cap set</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(ad)}
                                        className="w-full btn btn-danger btn-sm"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fg/40 backdrop-blur-sm">
                    <div className="w-full max-w-md p-5 border rounded-xl bg-surface border-line shadow-2xl">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-[16px] font-semibold text-fg">Upload advertisement</h2>
                                <p className="mt-0.5 text-[12px] text-fg-3">Image or video, served in the rider app.</p>
                            </div>
                            <button
                                onClick={() => !uploading && setShowUploadModal(false)}
                                aria-label="Close"
                                className="p-1.5 rounded-md text-fg-3 hover:bg-raised hover:text-fg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="flex flex-col gap-4">
                            <div>
                                <label htmlFor="ad-file" className="field-label">Media file</label>
                                <input
                                    id="ad-file" type="file" accept="image/*,video/*" onChange={handleFileChange}
                                    className="w-full text-[13px] text-fg-3 file:mr-3 file:py-2 file:px-3 file:rounded-md
                                               file:border-0 file:text-[13px] file:font-medium file:bg-brand file:text-brand-fg
                                               hover:file:bg-brand-strong border border-line rounded-md cursor-pointer bg-raised p-1"
                                />
                                {file && (
                                    <p className="mt-1.5 text-[11px] text-fg-3 truncate">
                                        {file.name} &middot; {(file.size / 1024 / 1024).toFixed(1)} MB
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="ad-price" className="field-label">Price (₹)</label>
                                <input
                                    id="ad-price" type="number" min="0" value={adPrice}
                                    onChange={(e) => setAdPrice(e.target.value)}
                                    placeholder="e.g. 500" className="field"
                                />
                            </div>

                            {uploading && (
                                <div>
                                    <div className="flex justify-between mb-1 text-[11px] text-fg-3">
                                        <span>Uploading</span>
                                        <span className="font-mono tabular">{Math.round(uploadProgress)}%</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                                        <div className="h-full transition-all rounded-full bg-brand" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button" disabled={uploading}
                                    onClick={() => setShowUploadModal(false)}
                                    className="btn btn-default"
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={uploading} className="btn btn-primary">
                                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {uploading ? 'Uploading' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview modal */}
            {selectedAd && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fg/60 backdrop-blur-sm"
                    onClick={() => setSelectedAd(null)}
                >
                    <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedAd(null)}
                            aria-label="Close preview"
                            className="absolute right-0 p-2 transition-colors -top-10 text-white/70 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        {selectedAd.adType === 'video' ? (
                            <video src={selectedAd.adUrl} controls autoPlay className="w-full rounded-xl" />
                        ) : (
                            <img src={selectedAd.adUrl} alt="" className="w-full rounded-xl" />
                        )}
                        <div className="flex items-center justify-between px-4 py-3 mt-2 border rounded-xl bg-surface border-line">
                            <span className="font-mono text-[13px] font-semibold text-fg">{money(selectedAd.adPrice)}</span>
                            <span className="font-mono text-[12px] text-fg-3">
                                {impressionsOf(selectedAd).toLocaleString('en-IN')} impressions
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
