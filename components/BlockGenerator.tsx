import React, { useState } from 'react';
// FIX: The 'generateBlockAddon' function does not exist; replaced with the general-purpose 'initiateAddonGeneration'.
import { initiateAddonGeneration, detectExperimentalFeatures } from '../services/geminiService';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type GenerationResult = {
    generatedFiles: GeneratedFile[];
    uploadedFiles: UploadedFile[];
    assetMappings: AssetMapping[];
    addonName: string;
};

type GenerationProps = {
    onGenerationComplete: (
        generatedFiles: GeneratedFile[],
        uploadedFiles: UploadedFile[],
        assetMappings: AssetMapping[],
        addonName: string
      ) => void;
}

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

const Spinner: React.FC<{text?: string}> = ({text = "Generating..."}) => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text}
  </>
);

const BlockGenerator: React.FC<GenerationProps> = ({ onGenerationComplete }) => {
    const [prompt, setPrompt] = useState('');
    const [addonName, setAddonName] = useState('MyBlockAddon');
    const [description, setDescription] = useState('A custom block created with Bedrock Utility.');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    const [stage, setStage] = useState<'input' | 'reviewToggles'>('input');
    const [isLoading, setIsLoading] = useState(false);

    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
    const [experimentalToggles, setExperimentalToggles] = useState<{ toggles: string[], reasoning: string } | null>(null);
    
    const { addNotification } = useNotification();
  
    const templates = [
      { name: 'Glowing Ore', prompt: `A glowing magical ore block that emits a soft blue light. It should be as hard as obsidian and drop diamonds when mined.` },
      { name: 'Slippery Ice', prompt: `A type of magical ice that is extremely slippery. Players should slide much further on it than normal ice.`},
      { name: 'Bouncy Slime', prompt: `A bright green slime block that has very high friction and makes players bounce.` },
    ];

    const handlePostGeneration = async (files: GeneratedFile[], assetMappings: AssetMapping[]) => {
        setGenerationResult({ generatedFiles: files, uploadedFiles, assetMappings, addonName });
        setStage('reviewToggles'); 
        try {
            const features = await detectExperimentalFeatures(files);
            setExperimentalToggles(features);
        } catch (err) {
            const errorMessage = `**Error:** Could not automatically detect experimental features. Please review your world settings manually. \n\n*Details: ${(err as Error).message}*`;
            addNotification('error', "Failed to analyze for experimental features.");
            setExperimentalToggles({ toggles: [], reasoning: errorMessage });
        }
    }

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            addNotification('error', 'Please describe the block you want to create.');
            return;
        }
        if (!addonName.trim().match(/^[a-zA-Z0-9_ ]+$/)) {
            addNotification('error', 'Addon name can only contain letters, numbers, spaces, and underscores.');
            return;
        }
    
        setIsLoading(true);
      
        try {
            // FIX: Replaced the non-existent 'generateBlockAddon' with 'initiateAddonGeneration' and handled its potential 'plan' or 'files' response.
            const result = await initiateAddonGeneration(prompt, addonName, description, uploadedFiles);
            
            if (result.plan) {
                addNotification('error', "The AI generated a complex plan. This tool is for direct block generation. Please use the 'Addon Creator' for complex ideas.");
                return;
            }

            if (result.files) {
                await handlePostGeneration(result.files, result.assetMappings || []);
            } else {
                throw new Error("The AI returned an empty response. This can happen with very complex or ambiguous requests. Please try simplifying your prompt.");
            }
        } catch (err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalizeAndProceed = () => {
        if (!generationResult) return;
        onGenerationComplete(
            generationResult.generatedFiles,
            generationResult.uploadedFiles,
            generationResult.assetMappings,
            generationResult.addonName
        );
        setStage('input');
        setGenerationResult(null);
        setExperimentalToggles(null);
        setPrompt('');
        setDescription('A custom block created with Bedrock Utility.');
        setUploadedFiles([]);
        addNotification('success', 'Block addon generated successfully!');
    };
    
    const handleFilesChange = (files: File[]) => {
      setUploadedFiles(files.map(f => ({ file: f, type: 'asset' })));
    }

    if (stage === 'reviewToggles') {
        if (!experimentalToggles) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <Spinner text="Analyzing for Experimental Features..." />
                    <p className="text-sm text-[var(--text-secondary)]">The AI is checking if your addon needs any special world settings.</p>
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-6">
                <h3 className="text-lg font-bold">Post-Generation Report</h3>
                <div className="p-4 bg-[var(--bg-app)] rounded-lg border border-[var(--border-primary)] flex flex-col gap-3">
                    <h4 className="font-semibold text-sm text-white">Required Experimental Toggles</h4>
                    {experimentalToggles.toggles.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-2">
                            {experimentalToggles.toggles.map(toggle => 
                                <li key={toggle} className="font-mono bg-[var(--bg-input)] px-2 py-1 rounded w-fit">{toggle}</li>
                            )}
                        </ul>
                    ) : (
                        <p className="text-sm text-green-400 font-semibold">✅ No experimental features needed to turn on!</p>
                    )}
                     <div className="prose prose-sm prose-invert text-white max-w-none border-t border-[var(--border-primary)] pt-3 mt-2">
                        <Markdown remarkPlugins={[remarkGfm]}>{experimentalToggles.reasoning}</Markdown>
                     </div>
                </div>
                <button onClick={handleFinalizeAndProceed} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)]">
                    Finish & View in Editor
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)] text-left">Example Ideas</label>
                <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                        <button key={t.name} onClick={() => setPrompt(t.prompt)} title={t.prompt} className="text-xs px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[var(--accent-primary)] hover:bg-sky-500/20 transition-colors">
                            {t.name}
                        </button>
                    ))}
                </div>
            </div>
            <InputField as="textarea" label="Describe your Block Idea" value={prompt} onChange={setPrompt} placeholder="e.g., A bouncy slime block that glows in the dark." rows={5} />
            <InputField label="Addon Name" value={addonName} onChange={setAddonName} placeholder="MyBlockAddon" />
            <InputField as="textarea" label="Addon Description" value={description} onChange={setDescription} placeholder="This will be used in the manifest.json files." rows={2} />
            <MultiFileInput 
                label="Block Texture (Optional)" 
                accept="image/png"
                onFilesChange={handleFilesChange}
                isOptional={true}
                extraInfo="Provide a single .png texture file."
            />
            <button onClick={handleGenerate} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                {isLoading ? <Spinner /> : 'Generate Block Addon'}
            </button>
        </div>
    );
};

export default BlockGenerator;
