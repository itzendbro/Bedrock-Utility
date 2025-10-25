import React, { useState } from 'react';
import { downloadMcaddonFromZips } from '../utils/fileConverter';
import { useNotification } from '../contexts/NotificationContext';
import MultiFileInput from './MultiFileInput';

const McaddonConverter: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [addonName, setAddonName] = useState('MyAddon');
    const [isLoading, setIsLoading] = useState(false);
    const { addNotification } = useNotification();
    
    const handleConvert = async () => {
        if (uploadedFiles.length === 0) {
            addNotification('error', 'Please provide at least one pack file (.zip).');
            return;
        }
        if (!addonName.trim().match(/^[a-zA-Z0-9_ -]+$/)) {
            addNotification('error', 'Addon name can only contain letters, numbers, spaces, underscores, and hyphens.');
            return;
        }

        setIsLoading(true);

        let rpFile: File | null = null;
        let bpFile: File | null = null;

        for (const file of uploadedFiles) {
            const name = file.name.toLowerCase();
            if ((name.includes('rp') || name.includes('resource')) && !rpFile) {
                rpFile = file;
            } else if ((name.includes('bp') || name.includes('behavior')) && !bpFile) {
                bpFile = file;
            }
        }
        
        // Handle cases where files are not explicitly named
        if (!rpFile && !bpFile && uploadedFiles.length > 0) {
            if (uploadedFiles.length === 1) {
                // If only one, it's ambiguous, but we can proceed
                 addNotification('info', 'Only one file uploaded. Could not determine pack type, but will proceed.');
                 rpFile = uploadedFiles[0]; // Default to RP
            } else {
                 addNotification('error', 'Could not determine pack types. Please ensure filenames contain "rp", "resource", "bp", or "behavior".');
                 setIsLoading(false);
                 return;
            }
        } else if (uploadedFiles.length > 2) {
             addNotification('info', 'More than two ZIP files uploaded. Using the first detected RP and BP.');
        }


        try {
            await downloadMcaddonFromZips(addonName, rpFile, bpFile);
            addNotification('success', `${addonName}.mcaddon has been downloaded.`);
        } catch (err) {
            addNotification('error', 'An unexpected error occurred during conversion.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Pack to .mcaddon Converter</h2>
            <p className="text-sm text-[var(--text-secondary)] -mt-4">
                Upload your resource pack (.zip) and/or behavior pack (.zip) to combine them into a single, installable .mcaddon file.
            </p>

            <InputField label="Addon File Name" value={addonName} onChange={setAddonName} placeholder="My Awesome Addon" />
            
            <MultiFileInput 
              label="Resource & Behavior Packs" 
              accept=".zip"
              onFilesChange={setUploadedFiles}
              extraInfo="Upload one or two .zip files."
            />
            
            <button onClick={handleConvert} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-green)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
                {isLoading ? <Spinner /> : 'Convert & Download'}
            </button>
        </div>
    );
};

const InputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; }> = 
({ label, value, onChange, placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">{label}</label>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition duration-200 text-sm outline-none"
            placeholder={placeholder}
        />
    </div>
);

const Spinner = () => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Converting...
  </>
);

export default McaddonConverter;