import React, { useState } from 'react';
import { initiateAddonGeneration, generateAddonFromPlan } from '../services/geminiService';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';
import SyntaxHighlighter from './SyntaxHighlighter';

interface DreamStudioProps {
  onGenerationComplete: (
    generatedFiles: GeneratedFile[],
    uploadedFiles: UploadedFile[],
    assetMappings: AssetMapping[],
    addonName: string
  ) => void;
}

const DreamStudio: React.FC<DreamStudioProps> = ({ onGenerationComplete }) => {
  const [prompt, setPrompt] = useState('');
  const [addonName, setAddonName] = useState('MyDreamAddon');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  const [plan, setPlan] = useState<object | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isLoadingGeneration, setIsLoadingGeneration] = useState(false);

  const { addNotification } = useNotification();

  const handleGeneratePlan = async () => {
    if (!prompt.trim()) {
      addNotification('error', 'Please describe your dream addon.');
      return;
    }
    setIsLoadingPlan(true);
    setPlan(null);
    try {
      const result = await initiateAddonGeneration(prompt, addonName, `An addon based on the idea: "${prompt.substring(0, 100)}..."`, uploadedFiles);
      if (result.plan) {
        setPlan(result.plan);
        addNotification('success', 'Architectural plan generated successfully. Please review it below.');
      } else if (result.files) {
        addNotification('info', 'The AI generated your addon directly because the idea was simple enough!');
        onGenerationComplete(result.files, uploadedFiles, result.assetMappings || [], addonName);
      } else {
        throw new Error('The AI returned an unexpected response. Please try again.');
      }
    } catch (err) {
      addNotification('error', (err as Error).message);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleGenerateFromPlan = async () => {
    if (!plan) return;
    setIsLoadingGeneration(true);
    try {
      const { files, assetMappings } = await generateAddonFromPlan(plan, prompt, addonName, `An addon based on the idea: "${prompt.substring(0, 100)}..."`, uploadedFiles);
      addNotification('success', 'Dream addon generated successfully!');
      onGenerationComplete(files, uploadedFiles, assetMappings, addonName);
    } catch (err) {
      addNotification('error', (err as Error).message);
    } finally {
      setIsLoadingGeneration(false);
    }
  };
  
  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files.map(f => ({ file: f, type: 'asset' })))
  }

  const handleDiscardPlan = () => {
      setPlan(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {!plan ? (
        <>
            <InputField as="textarea" label="Describe your Dream Addon" value={prompt} onChange={setPrompt} placeholder="I want a magic addon with a phoenix that can be tamed with golden apples, drops fire feathers, and a wizard staff that shoots fireballs..." rows={6} />
            <InputField label="Addon Name" value={addonName} onChange={setAddonName} placeholder="MyDreamAddon" />
            <MultiFileInput 
                label="Reference Assets (Optional)" 
                accept="image/*,audio/*"
                onFilesChange={handleFilesChange}
                isOptional={true}
                extraInfo="e.g., concept art, sound effects."
            />
            <button onClick={handleGeneratePlan} disabled={isLoadingPlan} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                {isLoadingPlan ? <Spinner text="Dreaming..." /> : 'Generate Plan'}
            </button>
        </>
      ) : (
        <>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Generated Addon Plan</label>
                <div className="relative max-h-96 overflow-y-auto p-4 bg-[var(--editor-bg)] rounded-lg border border-[var(--border-primary)]">
                    <pre className="text-xs font-mono">
                        <SyntaxHighlighter code={JSON.stringify(plan, null, 2)} language="json" />
                    </pre>
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={handleDiscardPlan} disabled={isLoadingGeneration} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]">
                    Discard & Edit
                </button>
                <button onClick={handleGenerateFromPlan} disabled={isLoadingGeneration} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)]">
                    {isLoadingGeneration ? <Spinner text="Building..." /> : 'Build Addon from Plan'}
                </button>
            </div>
        </>
      )}
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

const Spinner: React.FC<{text: string}> = ({text}) => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text}
  </>
);

export default DreamStudio;