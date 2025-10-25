import React, { useState, useCallback, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { smartRemoveImageBackground } from '../services/geminiService';

const Spinner: React.FC<{text: string}> = ({text}) => (
    <div className="flex items-center">
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text}
    </div>
);

const BackgroundRemover: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addNotification } = useNotification();

    const handleFile = useCallback((file: File | null) => {
        if (!file || !file.type.startsWith('image/')) {
            addNotification('error', 'Please upload a valid image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            setOriginalImage(e.target?.result as string);
            setResultImage(null);
        };
        reader.readAsDataURL(file);
    }, [addNotification]);
    
    const handleRemoveBackground = async () => {
        if (!originalImage) {
            addNotification('error', 'Please upload an image first.');
            return;
        }
        setIsLoading(true);
        try {
            const base64 = originalImage.split(',')[1];
            const resultBase64 = await smartRemoveImageBackground(base64, 'pixel');
            setResultImage(`data:image/png;base64,${resultBase64}`);
            addNotification('success', 'Background removed successfully!');
        } catch (err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (!resultImage) return;
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = 'bg_removed.png';
        link.click();
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDraggingOver(true);
        else if (e.type === "dragleave") setIsDraggingOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files?.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    if (!originalImage) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div 
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center text-center p-8 gap-6 max-w-lg w-full h-[500px] bg-[var(--bg-panel-secondary)] rounded-lg border-2 border-dashed  transition-colors ${isDraggingOver ? 'border-[var(--accent-primary)]' : 'border-[var(--border-primary)]'}`}
                >
                    <input type="file" ref={fileInputRef} onChange={e => handleFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" />
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-[var(--text-tertiary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    <h2 className="text-2xl font-bold">AI Background Remover</h2>
                    <p className="text-[var(--text-secondary)]">Drag & drop an image here or click the button below to remove its background.</p>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-8 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors">
                        Upload Image
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Background Remover</h2>
                <div className="flex gap-4">
                    <button onClick={() => { setOriginalImage(null); setResultImage(null); }} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]">
                        Clear
                    </button>
                    <button onClick={handleRemoveBackground} disabled={isLoading} className="px-6 py-2 flex justify-center items-center font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                        {isLoading ? <Spinner text="Processing..." /> : 'Remove Background'}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                <div>
                    <h3 className="font-bold mb-2 text-center text-lg">Original</h3>
                    <div className="aspect-square bg-grid-pattern rounded-lg border border-[var(--border-primary)] flex items-center justify-center p-2">
                        <img src={originalImage} alt="Original" className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
                <div>
                     <h3 className="font-bold mb-2 text-center text-lg">Result</h3>
                     <div className="aspect-square bg-grid-pattern rounded-lg border border-[var(--border-primary)] flex items-center justify-center p-2 relative">
                        {isLoading && <Spinner text="AI is working..." />}
                        {!isLoading && resultImage && (
                            <>
                                <img src={resultImage} alt="Result" className="max-w-full max-h-full object-contain" />
                                <button onClick={handleDownload} title="Download PNG" className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </>
                        )}
                        {!isLoading && !resultImage && (
                            <p className="text-[var(--text-secondary)]">The result will appear here.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackgroundRemover;