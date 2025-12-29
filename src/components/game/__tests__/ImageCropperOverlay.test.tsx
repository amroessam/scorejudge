import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageCropperOverlay } from '../ImageCropperOverlay';

// Mock react-easy-crop
jest.mock('react-easy-crop', () => {
    return function MockCropper({ onCropComplete }: { onCropComplete: (croppedArea: any, croppedAreaPixels: any) => void }) {
        // Simulate crop complete on mount
        React.useEffect(() => {
            onCropComplete({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 200, height: 200 });
        }, [onCropComplete]);
        return <div data-testid="mock-cropper">Mock Cropper</div>;
    };
});

// Mock canvas-related APIs
beforeEach(() => {
    // Mock Image constructor
    global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        crossOrigin: string = '';
        src: string = '';
        width: number = 200;
        height: number = 200;

        constructor() {
            setTimeout(() => {
                if (this.onload) this.onload();
            }, 0);
        }

        addEventListener(event: string, handler: () => void) {
            if (event === 'load') this.onload = handler;
            if (event === 'error') this.onerror = handler;
        }

        removeEventListener() {}
    } as any;

    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
        drawImage: jest.fn(),
    });
    HTMLCanvasElement.prototype.toDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,croppedimage');
});

describe('ImageCropperOverlay', () => {
    const mockOnClose = jest.fn();
    const mockOnCropComplete = jest.fn();
    const testImageSrc = 'data:image/png;base64,testimage';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when isOpen is false', () => {
        render(
            <ImageCropperOverlay
                isOpen={false}
                imageSrc={testImageSrc}
                onClose={mockOnClose}
                onCropComplete={mockOnCropComplete}
            />
        );

        expect(screen.queryByText('Crop Photo')).not.toBeInTheDocument();
    });

    it('should render cropper when isOpen is true', () => {
        render(
            <ImageCropperOverlay
                isOpen={true}
                imageSrc={testImageSrc}
                onClose={mockOnClose}
                onCropComplete={mockOnCropComplete}
            />
        );

        expect(screen.getByText('Crop Photo')).toBeInTheDocument();
        expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
    });

    it('should call onClose when X button is clicked', () => {
        render(
            <ImageCropperOverlay
                isOpen={true}
                imageSrc={testImageSrc}
                onClose={mockOnClose}
                onCropComplete={mockOnCropComplete}
            />
        );

        // Find the X button (first button in header)
        const closeButton = screen.getAllByRole('button')[0];
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have zoom controls', () => {
        render(
            <ImageCropperOverlay
                isOpen={true}
                imageSrc={testImageSrc}
                onClose={mockOnClose}
                onCropComplete={mockOnCropComplete}
            />
        );

        const zoomSlider = screen.getByRole('slider');
        expect(zoomSlider).toBeInTheDocument();
        expect(zoomSlider).toHaveAttribute('min', '1');
        expect(zoomSlider).toHaveAttribute('max', '3');
    });

    it('should have rotate button', () => {
        render(
            <ImageCropperOverlay
                isOpen={true}
                imageSrc={testImageSrc}
                onClose={mockOnClose}
                onCropComplete={mockOnCropComplete}
            />
        );

        expect(screen.getByText('Rotate')).toBeInTheDocument();
    });

    it('should call onCropComplete and onClose when confirm button is clicked', async () => {
        render(
            <ImageCropperOverlay
                isOpen={true}
                imageSrc={testImageSrc}
                onClose={mockOnClose}
                onCropComplete={mockOnCropComplete}
            />
        );

        // Find the check button (second button in header)
        const confirmButton = screen.getAllByRole('button')[1];
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockOnCropComplete).toHaveBeenCalledWith('data:image/jpeg;base64,croppedimage');
            expect(mockOnClose).toHaveBeenCalled();
        });
    });
});

