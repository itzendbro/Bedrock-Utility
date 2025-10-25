import React, { useState, useCallback, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { smartRemoveImageBackground, enhanceImage } from '../services/geminiService';
import JSZip from 'jszip';

type ProcessMode = 'pixel' | 'smooth';
type ImageJob = {
    id: string;
    file: File;
    originalUrl: string;
    resultUrl: string | null;
    status: 'pending' | 'processing' | 'done' | 'error';
};

const Spinner: React.FC<{text: string}> = ({text}) => (
    <div className="flex items-center text-[var(--text-primary)]">
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text}
    </div>
);

const ImageMasker: React.FC = () => {
    const [jobs, setJobs] = useState<ImageJob[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [mode, setMode] = useState<ProcessMode>('pixel');
    const [autoEnhance, setAutoEnhance] = useState(false);
    const [previewBg, setPreviewBg] = useState('#1e1e1e');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addNotification } = useNotification();

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newJobs: ImageJob[] = Array.from(files)
            .filter(file => file.type.startsWith('image/'))
            .map(file => ({
                id: `${file.name}-${file.lastModified}`,
                file,
                originalUrl: URL.createObjectURL(file),
                resultUrl: null,
                status: 'pending',
            }));

        setJobs(prev => {
            const existingIds = new Set(prev.map(j => j.id));
            const uniqueNewJobs = newJobs.filter(j => !existingIds.has(j.id));
            return [...prev, ...uniqueNewJobs];
        });
    }, []);

    const processJob = async (job: ImageJob) => {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' } : j));
        try {
            const reader = new FileReader();
            const fileReadPromise = new Promise<string>((resolve, reject) => {
                reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(job.file);
            });
            const base64 = await fileReadPromise;
            let resultBase64 = await smartRemoveImageBackground(base64, mode);

            if (autoEnhance) {
                resultBase64 = await enhanceImage(resultBase64);
            }

            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', resultUrl: `data:image/png;base64,${resultBase64}` } : j));
        } catch (err) {
            console.error(`Failed to process ${job.file.name}:`, err);
            addNotification('error', `Failed to process ${job.file.name}.`);
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error' } : j));
        }
    };

    const handleProcessAll = async () => {
        const pendingJobs = jobs.filter(j => j.status === 'pending');
        if (pendingJobs.length === 0) {
            addNotification('info', 'No new images to process.');
            return;
        }
        setIsProcessing(true);
        await Promise.all(pendingJobs.map(processJob));
        setIsProcessing(false);
        addNotification('success', 'All images processed!');
    };
    
    const handleDownloadAll = async () => {
        const processedJobs = jobs.filter(j => j.status === 'done' && j.resultUrl);
        if (processedJobs.length === 0) {
            addNotification('error', 'No processed images to download.');
            return;
        }
        const zip = new JSZip();
        for (const job of processedJobs) {
            const base64 = job.resultUrl!.split(',')[1];
            zip.file(`${job.file.name.split('.').slice(0, -1).join('.')}_masked.png`, base64, { base64: true });
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'Processed_Images.zip';
        link.click();
    }
    
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDraggingOver(true);
        else if (e.type === "dragleave") setIsDraggingOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    }, [handleFiles]);
    
    const clearAll = () => {
        jobs.forEach(job => URL.revokeObjectURL(job.originalUrl));
        setJobs([]);
    };

    if (jobs.length === 0) {
         return (
            <div className="p-6 h-full flex items-center justify-center">
                <div 
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center text-center p-8 gap-6 max-w-2xl w-full h-[600px] bg-[var(--bg-panel-secondary)] rounded-lg border-2 border-dashed  transition-colors ${isDraggingOver ? 'border-[var(--accent-primary)]' : 'border-[var(--border-primary)]'}`}
                >
                    <input type="file" ref={fileInputRef} onChange={e => handleFiles(e.target.files)} accept="image/*" className="hidden" multiple />
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-[var(--text-tertiary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    <h2 className="text-2xl font-bold">Smart Background Remover</h2>
                    <p className="text-[var(--text-secondary)]">Drag & drop your images here or click the button below. Supports batch processing.</p>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-8 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors">
                        Upload Image(s)
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="flex-shrink-0 p-4 border-b border-[var(--border-primary)] bg-[var(--bg-panel-secondary)] flex items-center justify-between">
                <h2 className="text-xl font-bold">Smart Background Remover ({jobs.length})</h2>
                <div className="flex items-center gap-4">
                     <button onClick={clearAll} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--bg-hover)] hover:opacity-80 border border-[var(--border-primary)]">Clear All</button>
                     <button onClick={handleDownloadAll} disabled={!jobs.some(j=>j.status === 'done')} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed">Download All (.zip)</button>
                     <button onClick={handleProcessAll} disabled={isProcessing} className="px-6 py-2 flex justify-center items-center font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                        {isProcessing ? <Spinner text="Processing..." /> : 'Process All Pending'}
                    </button>
                </div>
            </header>
            <div className="flex flex-grow overflow-hidden">
                <aside className="w-72 flex-shrink-0 bg-[var(--bg-panel)] p-4 border-r border-[var(--border-primary)] flex flex-col gap-6">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Processing Mode</label>
                        <div className="flex bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-primary)]">
                            <button onClick={() => setMode('pixel')} className={`w-full py-1.5 text-sm font-semibold rounded-md transition-colors capitalize ${mode === 'pixel' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>Pixel Art</button>
                            <button onClick={() => setMode('smooth')} className={`w-full py-1.5 text-sm font-semibold rounded-md transition-colors capitalize ${mode === 'smooth' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>Smooth</button>
                        </div>
                    </div>
                     <div className="flex items-center justify-between bg-[var(--bg-input)] p-2 rounded-lg border border-[var(--border-primary)]">
                        <label htmlFor="auto-enhance" className="text-sm font-medium text-[var(--text-secondary)] cursor-pointer">Auto-Enhance Colors</label>
                        <button onClick={()=>setAutoEnhance(!autoEnhance)} className={`w-10 h-5 rounded-full transition-colors ${autoEnhance ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-app)]'}`}><span className={`block w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${autoEnhance ? 'translate-x-5' : 'translate-x-1'}`}></span></button>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Preview Background</label>
                        <input type="color" value={previewBg} onChange={e => setPreviewBg(e.target.value)} className="w-full h-10 p-1 bg-[var(--bg-input)] rounded-lg border border-[var(--border-primary)] cursor-pointer" />
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-auto w-full px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]">Add More Images</button>
                    <input type="file" ref={fileInputRef} onChange={e => handleFiles(e.target.files)} accept="image/*" className="hidden" multiple />
                </aside>
                <main onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className="flex-grow p-6 overflow-y-auto bg-grid-pattern">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {jobs.map(job => (
                            <div key={job.id} className="bg-[var(--bg-panel)] p-3 rounded-lg border border-[var(--border-primary)] flex flex-col gap-2 shadow-lg">
                                <div className="aspect-square rounded-md flex items-center justify-center relative" style={{backgroundColor: previewBg}}>
                                    {job.status === 'done' && job.resultUrl ? (
                                         <img src={job.resultUrl} className="max-w-full max-h-full object-contain" />
                                    ) : (
                                         <img src={job.originalUrl} className="max-w-full max-h-full object-contain opacity-50" />
                                    )}
                                    {job.status === 'processing' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md"><Spinner text="Processing..." /></div>}
                                    {job.status === 'error' && <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center rounded-md text-red-300 font-bold">Error</div>}
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] truncate" title={job.file.name}>{job.file.name}</p>
                                <div className="flex gap-2">
                                     <button onClick={() => processJob(job)} disabled={job.status === 'processing' || job.status === 'done'} className="w-full text-xs py-1.5 rounded bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-active)] disabled:opacity-50 disabled:cursor-not-allowed">
                                        {job.status === 'pending' ? 'Process' : job.status === 'done' ? 'Done' : 'Retry'}
                                     </button>
                                     <button onClick={() => { const a = document.createElement('a'); a.href=job.resultUrl!; a.download=`${job.file.name.split('.').slice(0, -1).join('.')}_masked.png`; a.click(); }} disabled={!job.resultUrl} className="p-2 rounded bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-active)] disabled:opacity-50 disabled:cursor-not-allowed">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                     </button>
                                </div>
                            </div>
                        ))}
                     </div>
                </main>
            </div>
        </div>
    );
};

export default ImageMasker;