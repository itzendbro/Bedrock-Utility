import React, { useState } from 'react';
import { generateBuildingImage } from '../services/geminiService';
import { useNotification } from '../contexts/NotificationContext';

const BuildingHelper: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  const handleGenerate = async () => {
    if (!prompt.trim()){
      addNotification('info', 'Please describe what you want to build.');
      return;
    }
    setIsLoading(true);
    setImageUrl('');
    try {
      const base64Image = await generateBuildingImage(prompt);
      setImageUrl(`data:image/jpeg;base64,${base64Image}`);
    } catch (err) {
      addNotification('error', (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <InputField as="textarea" label="What do you want to build?" value={prompt} onChange={setPrompt} placeholder="A cozy cottage with a fireplace and a small garden" rows={4} />
      
      <button onClick={handleGenerate} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
        {isLoading ? <Spinner text="Generating..." /> : 'Generate Image'}
      </button>

      {isLoading && (
         <div className="w-full aspect-video bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg flex items-center justify-center">
            <div className="text-center text-[var(--text-secondary)]">
                <Spinner text="Generating Image... (this may take a moment)" />
            </div>
         </div>
      )}

      {imageUrl && !isLoading && (
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Generated Image</label>
            <img src={imageUrl} alt="Generated Minecraft build" className="w-full rounded-lg border border-[var(--border-primary)]" />
        </div>
      )}
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
  <div className="flex items-center">
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text}
  </div>
);

export default BuildingHelper;