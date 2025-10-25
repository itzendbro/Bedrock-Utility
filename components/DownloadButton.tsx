import React, { useState } from 'react';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import { downloadAddon } from '../utils/fileConverter';
import { useNotification } from '../contexts/NotificationContext';


interface DownloadButtonProps {
  files: GeneratedFile[];
  uploadedFiles: UploadedFile[];
  assetMappings: AssetMapping[];
  addonName: string;
  disabled: boolean;
}

const Spinner: React.FC<{text: string}> = ({text}) => (
  <div className="flex items-center">
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text}
  </div>
);


const DownloadButton: React.FC<DownloadButtonProps> = ({ files, uploadedFiles, assetMappings, addonName, disabled }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      await downloadAddon(addonName, files, uploadedFiles, assetMappings);
    } catch (error) {
        console.error("Download failed:", error);
        addNotification('error', 'Failed to package the addon. Check the console for details.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || files.length === 0 || isLoading}
      className="w-full flex justify-center items-center px-6 py-3 font-bold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-green)] disabled:bg-[var(--bg-active)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed transition-colors duration-200"
    >
        {isLoading ? (
            <Spinner text="Packaging..." />
        ) : (
            <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download .mcaddon
            </>
        )}
    </button>
  );
};

export default DownloadButton;