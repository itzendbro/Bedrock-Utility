
import React, { useState } from 'react';
import { initiateAddonGeneration, generateAddonFromPlan, detectExperimentalFeatures } from '../services/geminiService';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';
import SyntaxHighlighter from './SyntaxHighlighter';
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

const AddonCreator: React.FC<GenerationProps> = ({ onGenerationComplete }) => {
    const [prompt, setPrompt] = useState('');
    const [addonName, setAddonName] = useState('MyAwesomeAddon');
    const [description, setDescription] = useState('An awesome addon created with Bedrock Utility.');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [plan, setPlan] = useState<object | null>(null);

    const [stage, setStage] = useState<'input' | 'reviewPlan' | 'reviewToggles'>('input');
    const [isLoading, setIsLoading] = useState(false);

    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
    const [experimentalToggles, setExperimentalToggles] = useState<{ toggles: string[], reasoning: string } | null>(null);
    
    const { addNotification } = useNotification();
  
    const templates = [
        { name: 'Simple Item', prompt: `A sword that gives the player speed when held.` },
        { name: 'Custom Block', prompt: `A glowing magical ore block that emits a soft blue light and drops diamonds when mined.` },
        { name: 'Scripted UI', prompt: `When a player uses an item with the id 'custom:shop_item', open a shop menu with 'Buy' and 'Sell' buttons.` },
        { name: 'Complex Idea', prompt: `I want a magic addon with a phoenix that can be tamed, drops fire feathers, and a wizard staff that shoots fireballs...`},
    ];

    const handlePostGeneration = async (files: GeneratedFile[], assetMappings: AssetMapping[]) => {
        setGenerationResult({ generatedFiles: files, uploadedFiles, assetMappings, addonName });
        setStage('reviewToggles'); // Switch to review stage, which will show a spinner while experimentalToggles is null
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
            addNotification('error', `Please describe the addon you want to create.`);
            return;
        }
        if (!addonName.trim().match(/^[a-zA-Z0-9_ ]+$/)) {
            addNotification('error', 'Addon name can only contain letters, numbers, spaces, and underscores.');
            return;
        }
    
        setIsLoading(true);
      
        try {
            const result = await initiateAddonGeneration(prompt, addonName, description, uploadedFiles);
            if (result.plan) {
                setPlan(result.plan);
                setStage('reviewPlan');
                addNotification('success', 'Architectural plan generated for your complex idea. Please review it below.');
            } else if (result.files) {
                await handlePostGeneration(result.files, result.assetMappings || []);
            } else {
                 throw new Error("The AI returned an empty response. Please try rephrasing your prompt.");
            }
        } catch (err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
  
    const handleGenerateFromPlan = async () => {
        if (!plan) return;
        setIsLoading(true);
        try {
          const { files, assetMappings } = await generateAddonFromPlan(plan, prompt, addonName, description, uploadedFiles);
          await handlePostGeneration(files, assetMappings);
        } catch (err) {
          addNotification('error', (err as Error).message);
        } finally {
          setIsLoading(false);
        }
    };

    const handleDiscardPlan = () => {
        setPlan(null);
        setStage('input');
        addNotification('info', 'Plan discarded. You can now edit your prompt.');
    }

    const handleFinalizeAndProceed = () => {
        if (!generationResult) return;
        onGenerationComplete(
            generationResult.generatedFiles,
            generationResult.uploadedFiles,
            generationResult.assetMappings,
            generationResult.addonName
        );
        // Reset state
        setStage('input');
        setPlan(null);
        setGenerationResult(null);
        setExperimentalToggles(null);
        setPrompt('');
        setDescription('An awesome addon created with Bedrock Utility.');
        setUploadedFiles([]);
        addNotification('success', 'Addon generated successfully!');
    };
    
    const handleFilesChange = (files: File[]) => {
      setUploadedFiles(files.map(f => ({ file: f, type: 'asset' })));
    }

    if (stage === 'reviewToggles') {
        if (!experimentalToggles) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center max-w-4xl mx-auto">
                    <Spinner text="Analyzing for Experimental Features..." />
                    <p className="text-sm text-[var(--text-secondary)]">The AI is checking if your addon needs any special world settings.</p>
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                <h3 className="text-lg font-bold">Post-Generation Report</h3>
                <div className="p-4 bg-[var(--bg-app)] rounded-lg border border-[var(--border-primary)] flex flex-col gap-3">
                    <h4 className="font-semibold text-sm text-[var(--text-primary)]">Required Experimental Toggles</h4>
                    {experimentalToggles.toggles.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-2">
                            {experimentalToggles.toggles.map(toggle => 
                                <li key={toggle} className="font-mono bg-[var(--bg-input)] px-2 py-1 rounded w-fit">{toggle}</li>
                            )}
                        </ul>
                    ) : (
                        <p className="text-sm text-green-400 font-semibold">✅ No experimental features needed to turn on!</p>
                    )}
                     <div className="prose prose-sm max-w-none border-t border-[var(--border-primary)] pt-3 mt-2 text-[var(--text-primary)]">
                        <Markdown remarkPlugins={[remarkGfm]}>{experimentalToggles.reasoning}</Markdown>
                     </div>
                </div>
                <button onClick={handleFinalizeAndProceed} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)]">
                    Finish & View in Editor
                </button>
            </div>
        )
    }

    if (stage === 'reviewPlan' && plan) {
        return (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Generated Addon Plan</label>
                    <div className="relative max-h-96 overflow-y-auto p-4 bg-[var(--editor-bg)] rounded-lg border border-[var(--border-primary)]">
                        <pre className="text-xs font-mono">
                            <SyntaxHighlighter code={JSON.stringify(plan, null, 2)} language="json" />
                        </pre>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={handleDiscardPlan} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-[var(--text-primary)] bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]">
                        Discard & Edit
                    </button>
                    <button onClick={handleGenerateFromPlan} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)]">
                        {isLoading ? <Spinner text="Building..." /> : 'Build Addon from Plan'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Addon Creator</h2>
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
            <InputField 
                as="textarea" 
                label="Describe your Addon Idea" 
                value={prompt} 
                onChange={setPrompt} 
                placeholder="A simple item, a complex magic system, or a scripted UI. The AI will adapt its strategy to your idea." 
                rows={6} 
            />
            <InputField label="Addon Name" value={addonName} onChange={setAddonName} placeholder="MyAwesomeAddon" />
            <InputField as="textarea" label="Addon Description" value={description} onChange={setDescription} placeholder="This will be used in the manifest.json files." rows={3} />
            <MultiFileInput 
                label="Assets (textures, sounds, etc.)"
                accept="image/*,audio/*,.json,.js"
                onFilesChange={handleFilesChange}
                isOptional={true}
                extraInfo="e.g. .png, .ogg, existing scripts"
            />
            <button onClick={handleGenerate} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                {isLoading ? <Spinner text="Thinking..." /> : 'Generate Addon'}
            </button>
            <div className="p-3 bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg text-xs text-center text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)] mb-1">Powered by the Overpowered AI Core:</p>
                <ul className="list-disc list-inside space-y-0.5 text-left">
                    <li>For complex ideas, the AI will generate a plan for you to review first.</li>
                    <li>Auto-fixes syntax & validates against 1.21+ schemas.</li>
                    <li>Automatically balances gameplay stats.</li>
                    <li>Generates `.lang` files for custom items, blocks, & entities.</li>
                    <li>Optimizes files for performance.</li>
                </ul>
            </div>
        </div>
    );
};

export default AddonCreator;