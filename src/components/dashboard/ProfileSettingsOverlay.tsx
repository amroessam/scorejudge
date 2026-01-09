"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, Check, User } from "lucide-react";
import { ImageCropperOverlay } from "../game/ImageCropperOverlay";
import { getAvatarUrl } from "@/lib/utils";

interface ProfileSettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (userData: any) => void;
}

export function ProfileSettingsOverlay({
    isOpen,
    onClose,
    onUpdate
}: ProfileSettingsOverlayProps) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [cropperImage, setCropperImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchProfile();
            setPendingImage(null);
        }
    }, [isOpen]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/user/profile");
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setName(data.display_name || data.name || "");
            }
        } catch (error) {
            console.error("Failed to fetch profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        setSaving(true);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    display_name: name.trim(),
                    image: pendingImage || undefined
                })
            });

            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                onClose();
            } else {
                alert("Failed to update profile");
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Error saving profile");
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setCropperImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedImageBase64: string) => {
        setPendingImage(croppedImageBase64);
        setCropperImage(null);
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" key="profile-settings-modal">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            key="profile-backdrop"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden"
                            key="profile-content"
                        >
                            <div className="p-6 space-y-8">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold font-[family-name:var(--font-russo)] tracking-tight">Profile Settings</h2>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="animate-spin text-[var(--primary)]" size={32} />
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Avatar Section */}
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="relative group">
                                                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[var(--primary)] shadow-lg transition-transform group-hover:scale-105">
                                                    <img
                                                        src={pendingImage || getAvatarUrl(profile?.image)}
                                                        alt="Profile"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="absolute bottom-0 right-0 p-2 bg-[var(--primary)] text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform"
                                                >
                                                    <Camera size={16} />
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-widest">{profile?.email}</p>
                                            </div>
                                        </div>

                                        {/* Form Section */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center ml-1">
                                                    <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                                                        Display Name
                                                    </label>
                                                    <span className={`text-[10px] font-bold tracking-widest uppercase ${name.length >= 12 ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]/50'}`}>
                                                        {name.length}/12
                                                    </span>
                                                </div>
                                                <input
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value.slice(0, 12))}
                                                    placeholder="Gamer Hero"
                                                    maxLength={12}
                                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-2xl px-5 py-3 text-lg outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all font-medium"
                                                />
                                            </div>


                                            <button
                                                onClick={handleSave}
                                                disabled={saving || !name.trim() || (name === profile?.display_name && !pendingImage)}
                                                className="w-full bg-[var(--primary)] text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                            >
                                                {saving ? <Loader2 className="animate-spin" /> : (
                                                    <>
                                                        Save Changes <Check size={20} />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ImageCropperOverlay
                isOpen={!!cropperImage}
                imageSrc={cropperImage || ""}
                onClose={() => setCropperImage(null)}
                onCropComplete={handleCropComplete}
            />
        </>
    );
}
