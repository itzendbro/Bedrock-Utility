import React, { useState, useCallback } from 'react';

interface MultiFileInputProps {
  label: string;
  accept: string;
  onFilesChange: (files: File[]) => void;
  isOptional?: boolean;
  extraInfo?: string;
}

const getIconForFile = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'json': return '📄';
      case 'js': return '📜';
      case 'mcfunction': return '⚙️';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp': return '🖼️';
      case 'ogg':
      case 'mp3':
      case 'wav':
      case 'fsb': return '🎵';
      case 'zip':
      case 'mcpack':
      case 'mcaddon': return '📦';
      default: return '❔';
    }
};

const MultiFileInput: React.FC<MultiFileInputProps> = ({ label, accept, onFilesChange, isOptional, extraInfo }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const id = `file-input-${label.replace(/\s+/g, '-').toLowerCase()}`;

    const handleFiles = useCallback((newFiles: FileList | null) => {
        if (newFiles) {
            const fileArray = Array.from(newFiles);
            // Prevent duplicates
            const updatedFiles = [...files];
            fileArray.forEach(f => {
                if (!files.find(existing => existing.name === f.name && existing.size === f.size)) {
                    updatedFiles.push(f);
                }
            })
            setFiles(updatedFiles);
            onFilesChange(updatedFiles);
        }
    }, [files, onFilesChange]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    };
    
    const removeFile = (fileName: string) => {
        const updatedFiles = files.filter(f => f.name !== fileName);
        setFiles(updatedFiles);
        onFilesChange(updatedFiles);
    }

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="block text-sm font-medium text-[var(--text-secondary)]">
                {label} {isOptional && <span className="text-gray-500">(Optional)</span>}
            </label>
            <div 
                onDragEnter={handleDrag} 
                onDragLeave={handleDrag} 
                onDragOver={handleDrag} 
                onDrop={handleDrop}
                className={`flex justify-center p-6 border-2 border-[var(--border-primary)] border-dashed rounded-lg bg-[var(--bg-app)] transition-all duration-200 ${isDragging ? 'border-[var(--accent-primary)] bg-sky-500/10' : ''}`}
            >
                <div className="space-y-1 text-center">
                    <svg className="mx-auto h-10 w-10 text-[var(--text-secondary)]" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <div className="flex text-sm text-[var(--text-secondary)]">
                        <label htmlFor={id} className="relative cursor-pointer rounded-md font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] focus-within:outline-none">
                            <span>Upload files</span>
                            <input id={id} name={id} type="file" className="sr-only" accept={accept} onChange={handleChange} multiple />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">{extraInfo || accept}</p>
                </div>
            </div>
            {files.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                    {files.map(file => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between bg-[var(--bg-app)] p-2 pl-3 rounded-lg text-sm border border-[var(--border-primary)]">
                            <div className="flex items-center gap-2 truncate flex-grow">
                                <span className="flex-shrink-0">{getIconForFile(file.name)}</span>
                                <span className="text-[var(--text-secondary)] truncate" title={file.name}>{file.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-green)]" viewBox="0 0 20 20" fill="currentColor">
                                    <title>Ready</title>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <button onClick={() => removeFile(file.name)} className="p-1 rounded-full hover:bg-red-500/20 text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default MultiFileInput;