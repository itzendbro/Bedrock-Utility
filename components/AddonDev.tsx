import React, { useState } from 'react';
import { devAddon } from '../services/geminiService';
import { GeneratedFile, UploadedFile } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import MultiFileInput from './MultiFileInput';
import JSZip from 'jszip';

interface AddonDevProps {
    files: GeneratedFile[];
    onFilesUpdate: (files: GeneratedFile[]) => void;
    onLoadFiles: (generatedFiles: GeneratedFile[], uploadedFiles: UploadedFile[], addonName: string) => void;
}

const AddonDev: React.FC<AddonDevProps> = ({ files, onFilesUpdate, onLoadFiles }) => {
    const [instruction, setInstruction] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const { addNotification } = useNotification();

    const handleLoadAddon = async () => {
        if (filesToUpload.length === 0) {
            addNotification('error', 'Please select files to upload.');
            return;
        }
        setIsUploading(true);
        try {
            const finalGenerated: GeneratedFile[] = [];
            const finalUploaded: UploadedFile[] = [];
            let finalAddonName = 'Imported Addon';
            const TEXT_EXTENSIONS = ['.json', '.js', '.mcfunction', '.lang', '.md', '.txt'];

            for (const file of filesToUpload) {
                const fileName = file.name.toLowerCase();
                if (fileName.endsWith('.zip') || fileName.endsWith('.mcaddon') || fileName.endsWith('.mcpack')) {
                    const zip = await JSZip.loadAsync(file);
                    for (const path in zip.files) {
                        if (!zip.files[path].dir) {
                            const fileObject = zip.files[path];
                            const blob = await fileObject.async('blob');
                            const newFile = new File([blob], fileObject.name, { type: blob.type });

                            const isText = TEXT_EXTENSIONS.some(ext => fileObject.name.toLowerCase().endsWith(ext));
                            if (isText) {
                                const content = await newFile.text();
                                finalGenerated.push({ path: fileObject.name, content });
                                 if (fileObject.name.toLowerCase().endsWith('manifest.json')) {
                                    try {
                                        const manifest = JSON.parse(content);
                                        if (manifest?.header?.name) finalAddonName = manifest.header.name;
                                    } catch {}
                                 }
                            } else {
                                finalUploaded.push({ file: newFile, type: 'asset' });
                            }
                        }
                    }
                } else {
                    const isText = TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext));
                    if (isText) {
                        const content = await file.text();
                        finalGenerated.push({ path: file.name, content });
                         if (fileName.endsWith('manifest.json')) {
                            try {
                                const manifest = JSON.parse(content);
                                if (manifest?.header?.name) finalAddonName = manifest.header.name;
                            } catch {}
                         }
                    } else {
                        finalUploaded.push({ file, type: 'asset' });
                    }
                }
            }

            if (finalGenerated.length === 0) {
                addNotification('error', 'No valid text files (.json, .js, etc.) were found in the upload.');
            } else {
                onLoadFiles(finalGenerated, finalUploaded, finalAddonName);
                addNotification('success', 'Addon loaded successfully!');
            }
        } catch (err) {
            addNotification('error', `Failed to load addon: ${(err as Error).message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDevRequest = async () => {
        if (!instruction.trim()) {
            addNotification('info', 'Please enter an instruction to apply.');
            return;
        }
        if (files.length === 0) {
            addNotification('error', 'No files to develop. Please generate an addon first.');
            return;
        }

        setIsLoading(true);

        try {
            const { files: newFiles } = await devAddon(instruction, files);
            onFilesUpdate(newFiles);
            setInstruction('');
            addNotification('success', 'AI changes applied successfully!');
        } catch (err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    if (files.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div className="text-center p-4 text-[var(--text-secondary)] bg-[var(--bg-app)] rounded-lg border border-[var(--border-primary)]">
                    <p className="font-bold text-[var(--text-primary)]">Load an Existing Addon</p>
                    <p className="text-sm mt-2">Upload your addon files (.mcaddon, .zip, .json, etc.) to start developing with AI.</p>
                </div>
                <MultiFileInput 
                    label="Upload Addon Files"
                    accept=".mcaddon,.mcpack,.zip,.json,.js,image/*"
                    onFilesChange={setFilesToUpload}
                />
                <button onClick={handleLoadAddon} disabled={isUploading || filesToUpload.length === 0} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)] transition-colors duration-200">
                    {isUploading ? <Spinner text="Loading Addon..." /> : 'Load Addon'}
                </button>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-6">
             <div className="p-4 bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)] mb-2">How to Develop Your Addon:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li><strong className="text-[var(--text-primary)]">For minor changes:</strong> Directly edit your files in the code editor on the right.</li>
                    <li><strong className="text-[var(--text-primary)]">For major changes:</strong> Use this AI prompt to refactor or add new features to the entire addon at once.</li>
                </ul>
            </div>
            <InputField as="textarea" label="AI Refactor Instruction" value={instruction} onChange={setInstruction} placeholder="Change all item identifiers from 'custom:myaddon' to 'expert:propack'." rows={5} />
            <button onClick={handleDevRequest} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)]">
                {isLoading ? <Spinner text="Updating..." /> : 'Apply AI Changes'}
            </button>
        </div>
    );
};

const InputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; as?: 'input' | 'textarea'; rows?: number }> = 
({ label, value, onChange, placeholder, as = 'input', rows }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">{label}</label>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition duration-200 text-sm outline-none" placeholder={placeholder} rows={rows} />
    </div>
);

const Spinner: React.FC<{text: string}> = ({text}) => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text}
  </>
);

export default AddonDev;