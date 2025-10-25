import React, { useState } from 'react';
import { initiateAddonGeneration } from '../services/geminiService';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';

interface ScriptingHelperProps {
  onGenerationComplete: (
    generatedFiles: GeneratedFile[],
    uploadedFiles: UploadedFile[],
    assetMappings: AssetMapping[],
    addonName: string
  ) => void;
}

const ScriptingHelper: React.FC<ScriptingHelperProps> = ({ onGenerationComplete }) => {
  const [prompt, setPrompt] = useState('');
  const [addonName, setAddonName] = useState('MyScriptedAddon');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  const templates = [
    { name: 'Shop UI', prompt: `When a player uses an item with the id 'custom:shop_item', open a shop menu. The menu should have a title 'Villager Shop'. It should have two buttons: 'Buy' and 'Sell'. The buy button opens another menu to trade 1 diamond for 64 dirt. The sell button opens a menu to trade 32 dirt for 1 emerald.` },
    { name: 'Random TP', prompt: `Create an item with id 'custom:teleporter'. When a player uses this item, they are teleported to a random location within a 1000 block radius around them on the X and Z axes. The Y coordinate should be a safe location on the surface.` },
    { name: 'Player Join', prompt: `When a new player joins the world for the first time, give them a welcome message in chat that says 'Welcome to the server!'. Also give them a stone sword and 10 cooked beef.` }
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addNotification('error', 'Please describe the script logic you want to create.');
      return;
    }
    if (!addonName.trim().match(/^[a-zA-Z0-9_]+$/)) {
      addNotification('error', 'Addon name can only contain letters, numbers, and underscores.');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await initiateAddonGeneration(prompt, addonName, `A scripted addon.`, uploadedFiles);

      if (result.plan) {
        // This component is for simple, direct generation. A plan is unexpected, so we notify the user.
        addNotification('error', "The AI generated a complex plan. This tool is for direct script generation. Please use the 'Addon Creator' for complex ideas.");
        return;
      }
      
      if (result.files) {
        addNotification('success', 'Scripted addon generated successfully!');
        onGenerationComplete(result.files, uploadedFiles, result.assetMappings || [], addonName);
      } else {
        throw new Error("The AI returned an empty response. This can happen with very complex or ambiguous requests. Please try simplifying your prompt.");
      }
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
      <div className="flex flex-col gap-3">
        <label className="block text-sm font-medium text-[var(--text-secondary)] text-left">Example Templates</label>
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
        label="Describe your Script Logic" 
        value={prompt} 
        onChange={setPrompt} 
        placeholder="When a player right-clicks an item called 'micks:apple', open a menu with two buttons: 'Shop' and 'RTP'. 'RTP' teleports the player randomly. 'Shop' opens a second menu to trade 1 diamond for 5 gold." 
        rows={6} 
      />

      <MultiFileInput 
        label="Upload Existing Scripts (Optional)" 
        accept=".js,.json"
        onFilesChange={handleFilesChange}
        isOptional={true}
        extraInfo="Upload .js or .json files to modify them."
      />
      
      <InputField label="Addon Name" value={addonName} onChange={setAddonName} placeholder="MyScriptedAddon" />
      
      <button onClick={handleGenerate} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
        {isLoading ? <Spinner /> : 'Generate Scripted Addon'}
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
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Generating...
  </>
);

export default ScriptingHelper;