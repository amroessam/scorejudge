"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface ImageCropperOverlayProps {
    isOpen: boolean;
    imageSrc: string;
    onClose: () => void;
    onCropComplete: (croppedImageBase64: string) => void;
}

// Helper function to create cropped image
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area
): Promise<string> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("No 2d context");
    }

    // Set canvas size to the crop area (square for circle crop)
    const size = Math.min(pixelCrop.width, pixelCrop.height);
    canvas.width = size;
    canvas.height = size;

    // Draw the cropped image
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        size,
        size
    );

    // Return as base64 with reduced quality for smaller file size
    return canvas.toDataURL("image/jpeg", 0.85);
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.crossOrigin = "anonymous";
        image.src = url;
    });
}

export function ImageCropperOverlay({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete,
}: ImageCropperOverlayProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = useCallback((location: { x: number; y: number }) => {
        setCrop(location);
    }, []);

    const onZoomChange = useCallback((newZoom: number) => {
        setZoom(newZoom);
    }, []);

    const onCropCompleteCallback = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;

        setIsProcessing(true);
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedImage);
            onClose();
        } catch (e) {
            console.error("Error cropping image:", e);
            alert("Failed to crop image. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black z-[60]"
                    />

                    {/* Cropper Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[61] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 bg-black/80">
                            <button
                                onClick={onClose}
                                className="p-2 text-white/70 hover:text-white transition-colors touch-manipulation"
                            >
                                <X size={24} />
                            </button>
                            <h3 className="text-white font-semibold">Crop Photo</h3>
                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing}
                                className="p-2 text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors touch-manipulation disabled:opacity-50"
                            >
                                <Check size={24} />
                            </button>
                        </div>

                        {/* Cropper Area */}
                        <div className="flex-1 relative">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={onCropChange}
                                onZoomChange={onZoomChange}
                                onCropComplete={onCropCompleteCallback}
                            />
                        </div>

                        {/* Controls */}
                        <div className="bg-black/80 p-4 space-y-4">
                            {/* Zoom Control */}
                            <div className="flex items-center gap-4 px-4">
                                <ZoomOut size={20} className="text-white/60" />
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-5
                                        [&::-webkit-slider-thumb]:h-5
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-white
                                        [&::-webkit-slider-thumb]:shadow-lg
                                    "
                                />
                                <ZoomIn size={20} className="text-white/60" />
                            </div>

                            {/* Rotate Button */}
                            <div className="flex justify-center">
                                <button
                                    onClick={handleRotate}
                                    className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors touch-manipulation"
                                >
                                    <RotateCw size={20} />
                                    <span className="text-sm">Rotate</span>
                                </button>
                            </div>
                        </div>

                        {/* Safe area padding */}
                        <div className="bg-black/80 safe-pb" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

