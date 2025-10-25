import React, { useState } from 'react';
import { generateFunction } from '../services/geminiService';
import { GeneratedFile } from '../types';
import { useNotification } from '../contexts/NotificationContext';

const CodeBlock: React.FC<{ file: GeneratedFile }> = ({ file }) => {
  const [copied, setCopied] = useState(false);
  const { addNotification } = useNotification();

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    addNotification('info', 'Content copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const fileName = file.path.split('/').pop() || 'function.mcfunction';
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('success', `${fileName} downloaded.`);
  };

  return (
    <div className="mt-4">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Generated Function</label>
        <div className="relative bg-[var(--bg-app)] p-4 rounded-lg border border-[var(--border-primary)]">
          <div className="absolute top-2 right-2 flex gap-2">
             <button
              onClick={handleDownload}
              title="Download file"
              className="p-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
            <button
              onClick={handleCopy}
              title="Copy content"
              className="p-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-green)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto text-xs text-gray-300 font-mono">
            <code>{file.content}</code>
          </pre>
        </div>
    </div>
  );
};


const FunctionWriter: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [functionName, setFunctionName] = useState('my_function');
    const [generatedFile, setGeneratedFile] = useState<GeneratedFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { addNotification } = useNotification();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
          addNotification('error', 'Please describe the function you want to create.');
          return;
        }
        if (!functionName.trim().match(/^[a-z0-9_]+$/)) {
          addNotification('error', 'Function name can only contain lowercase letters, numbers, and underscores.');
          return;
        }
    
        setIsLoading(true);
        setGeneratedFile(null);
        
        try {
          const files = await generateFunction(prompt, functionName);
          setGeneratedFile(files[0]);
          addNotification('success', 'Function generated successfully!');
        } catch (err) {
          addNotification('error', (err as Error).message);
        } finally {
          setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <InputField as="textarea" label="Describe your Function" value={prompt} onChange={setPrompt} placeholder="First, summon a zombie. Then, give it a full set of diamond armor and a diamond sword. Finally, make it ride a chicken." rows={5} />
            <InputField label="Function Name" value={functionName} onChange={setFunctionName} placeholder="my_function" infoText=".mcfunction" />
            
            <button onClick={handleGenerate} disabled={isLoading} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed transition-colors duration-200">
                {isLoading ? <Spinner /> : 'Generate Function'}
            </button>

            {generatedFile && <CodeBlock file={generatedFile} />}
        </div>
    );
};

const InputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; as?: 'input' | 'textarea'; rows?: number, infoText?: string }> = 
({ label, value, onChange, placeholder, as = 'input', rows, infoText }) => {
    const commonProps = {
        value,
        onChange: (e: any) => onChange(e.target.value),
        className: "w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition duration-200 text-sm outline-none",
        placeholder,
    };
    const inputElement = as === 'textarea' ? <textarea {...commonProps} rows={rows} /> : <input type="text" {...commonProps} />;
    
    return (
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">{label}</label>
            {infoText ? (
                 <div className="flex items-center">
                    <div className="relative flex-grow">
                        {inputElement}
                    </div>
                    <span className="pl-3 text-sm text-[var(--text-secondary)]">{infoText}</span>
                </div>
            ) : inputElement}
        </div>
    );
};

const Spinner = () => (
  <>
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Generating...
  </>
);

export default FunctionWriter;