import React, { useState } from 'react';
import { combineAddons } from '../services/geminiService';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AddonCombinerProps {
  onGenerationComplete: (
    generatedFiles: GeneratedFile[],
    uploadedFiles: UploadedFile[],
    assetMappings: AssetMapping[],
    addonName: string
  ) => void;
}

type ResultState = {
    files: GeneratedFile[];
    assetMappings: AssetMapping[];
    summaryReport: string;
}

const AddonCombiner: React.FC<AddonCombinerProps> = ({ onGenerationComplete }) => {
  const [newAddonName, setNewAddonName] = useState('CombinedAddon');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const { addNotification } = useNotification();

  const handleCombine = async () => {
    if (uploadedFiles.length === 0) {
      addNotification('error', 'Please upload at least one addon or file to combine.');
      return;
    }
    if (!newAddonName.trim().match(/^[a-zA-Z0-9_ -]+$/)) {
      addNotification('error', 'Addon name can only contain letters, numbers, spaces, underscores, and hyphens.');
      return;
    }

    setIsLoading(true);

    try {
      const { files, assetMappings, summaryReport } = await combineAddons(newAddonName, uploadedFiles);
      addNotification('success', 'Addons combined successfully! Please review the report.');
      setResult({ files, assetMappings, summaryReport });
    } catch (err) {
      addNotification('error', (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files.map(f => ({ file: f, type: 'addon_file' })))
  }

  const handleFinalize = () => {
    if (!result) return;
    onGenerationComplete(result.files, uploadedFiles, result.assetMappings, newAddonName);
  }

  const handleDiscard = () => {
    setResult(null);
    setUploadedFiles([]);
  }

  if (result) {
    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold">Merge Summary Report</h3>
            <div className="max-h-[50vh] overflow-y-auto p-4 bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg">
                <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
                    <Markdown remarkPlugins={[remarkGfm]}>{result.summaryReport}</Markdown>
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={handleDiscard} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]">
                    Discard
                </button>
                <button onClick={handleFinalize} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)]">
                    Finalize & View in Editor
                </button>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <InputField label="New Addon Name" value={newAddonName} onChange={setNewAddonName} placeholder="MyMergedAddon" />
      
      <MultiFileInput 
        label="Addons / Files to Combine" 
        accept=".mcaddon,.mcpack,.zip,.json,.js"
        onFilesChange={handleFilesChange}
      />
      
      <button onClick={handleCombine} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
        {isLoading ? <Spinner /> : 'Combine & Review'}
      </button>
    </div>
  );
};

const InputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = 
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
    Combining...
  </>
);

export default AddonCombiner;