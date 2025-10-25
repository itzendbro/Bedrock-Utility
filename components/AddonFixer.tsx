import React, { useState } from 'react';
import { fixAddon } from '../services/geminiService';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';

interface AddonFixerProps {
  onGenerationComplete: (
    generatedFiles: GeneratedFile[],
    uploadedFiles: UploadedFile[],
    assetMappings: AssetMapping[],
    addonName: string
  ) => void;
}

const AddonFixer: React.FC<AddonFixerProps> = ({ onGenerationComplete }) => {
  const [problem, setProblem] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  const handleFix = async () => {
    if (uploadedFiles.length === 0) {
      addNotification('error', 'Please upload the addon files you want to fix.');
      return;
    }

    setIsLoading(true);

    try {
      // Find a manifest to get the addon name for the download
      let addonName = 'FixedAddon';
      for (const uf of uploadedFiles) {
          if (uf.file.name === 'manifest.json') {
              try {
                  const manifestContent = await uf.file.text();
                  const manifestJson = JSON.parse(manifestContent);
                  addonName = manifestJson?.header?.name?.replace(/\s+/g, '_') || addonName;
                  break;
              } catch (e) {
                  console.error("Could not parse manifest to get name", e);
              }
          }
      }

      const { files, assetMappings } = await fixAddon(problem, uploadedFiles);
      addNotification('success', 'Addon fixed successfully!');
      onGenerationComplete(files, uploadedFiles, assetMappings, addonName);
    } catch (err) {
      addNotification('error', (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files.map(f => ({ file: f, type: 'addon_file' })))
  }

  return (
    <div className="flex flex-col gap-6">
      <MultiFileInput 
        label="Broken Addon Files" 
        accept=".mcaddon,.mcpack,.zip,.json,.js,image/*"
        onFilesChange={handleFilesChange}
      />
      
      <InputField as="textarea" label="Describe the Problem (Optional)" value={problem} onChange={setProblem} placeholder="My entity is invisible. You can also upload a screenshot of the bug. If blank, the AI will scan for any errors." rows={5} />
      
      <button onClick={handleFix} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
        {isLoading ? <Spinner /> : 'Fix Addon'}
      </button>
    </div>
  );
};

const InputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; as?: 'input' | 'textarea'; rows?: number }> = 
({ label, value, onChange, placeholder, as = 'input', rows }) => {
    const commonProps = {
        value,
        onChange: (e: any) => onChange(e.target.value),
        className: "w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition duration-200 text-sm outline-none",
        placeholder,
    };
    return (
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">{label}</label>
            {as === 'textarea' ? <textarea {...commonProps} rows={rows} /> : <input type="text" {...commonProps} />}
        </div>
    );
};

const Spinner = () => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Fixing...
  </>
);

export default AddonFixer;