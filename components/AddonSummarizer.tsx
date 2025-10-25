import React, { useState } from 'react';
import { summarizeAddon } from '../services/geminiService';
import { UploadedFile } from '../types';
import MultiFileInput from './MultiFileInput';
import { useNotification } from '../contexts/NotificationContext';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AddonSummarizer: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  const handleSummarize = async () => {
    if (uploadedFiles.length === 0) {
      addNotification('error', 'Please upload at least one file to summarize.');
      return;
    }

    setIsLoading(true);
    setSummary(null);

    try {
      const result = await summarizeAddon(uploadedFiles);
      setSummary(result);
      addNotification('success', 'Analysis complete!');
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
       <h2 className="text-xl font-bold text-[var(--text-primary)]">Addon Summarizer & Inspector</h2>
        <p className="text-sm text-[var(--text-secondary)] -mt-4">
            Upload an addon, pack, or script files (.zip, .mcaddon, .js, .json) to get a detailed analysis.
        </p>
      
      <MultiFileInput 
        label="Addon / Files to Analyze" 
        accept=".mcaddon,.mcpack,.zip,.json,.js"
        onFilesChange={handleFilesChange}
      />
      
      <button onClick={handleSummarize} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
        {isLoading ? <Spinner /> : 'Analyze Files'}
      </button>

      {summary && !isLoading && (
        <div className="p-4 bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg mt-4">
            <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
                 <Markdown remarkPlugins={[remarkGfm]}>{summary}</Markdown>
            </div>
        </div>
      )}
    </div>
  );
};


const Spinner = () => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Analyzing...
  </>
);

export default AddonSummarizer;