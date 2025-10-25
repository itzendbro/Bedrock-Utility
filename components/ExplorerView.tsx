import React, { useState, useEffect } from 'react';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import DownloadButton from './DownloadButton';

interface ExplorerViewProps {
  files: GeneratedFile[];
  uploadedFiles: UploadedFile[];
  assetMappings: AssetMapping[];
  addonName: string;
  onFilesUpdate: (files: GeneratedFile[]) => void;
}

const ExplorerView: React.FC<ExplorerViewProps> = ({
  files,
  uploadedFiles,
  assetMappings,
  addonName,
  onFilesUpdate,
}) => {
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [isMobile, setIsMobile] = useState(window.matchMedia('(max-width: 768px)').matches);
  const [isExplorerVisible, setIsExplorerVisible] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsExplorerVisible(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (files.length > 0 && (!selectedFile || !files.find(f => f.path === selectedFile.path))) {
      const firstFile = files[0];
      setSelectedFile(firstFile);
      if (isMobile) {
        setIsExplorerVisible(false);
      }
    } else if (files.length === 0) {
      setSelectedFile(null);
    }
  }, [files, isMobile]);

  const handleSelectFile = (file: GeneratedFile) => {
    setSelectedFile(file);
    if (isMobile) {
      setIsExplorerVisible(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    if (!selectedFile) return;
    const updatedFiles = files.map((f) =>
      f.path === selectedFile.path ? { ...f, content: newContent } : f
    );
    onFilesUpdate(updatedFiles);
  };
  
  if (files.length === 0) {
    return (
        <div className="flex-grow flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-secondary)]">
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">No Addon Loaded</h2>
                <p className="mt-2">Use a tool like Create, Combine, or Fix to generate files.</p>
                <p className="mt-1 text-sm">Your addon's file structure will appear here.</p>
            </div>
        </div>
    )
  }

  // --- Mobile View ---
  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {isExplorerVisible ? (
          <div className="w-full bg-[var(--bg-panel-secondary)] flex flex-col flex-grow">
            <div className="flex-grow overflow-y-auto">
              <FileExplorer
                  files={files}
                  selectedFile={selectedFile}
                  onSelectFile={handleSelectFile}
              />
            </div>
            <div className="p-4 border-t border-[var(--border-primary)] flex-shrink-0">
              <DownloadButton
                  files={files}
                  uploadedFiles={uploadedFiles}
                  assetMappings={assetMappings}
                  addonName={addonName || "MyAddon"}
                  disabled={files.length === 0}
              />
            </div>
          </div>
        ) : selectedFile ? (
          <>
            <div className="flex-shrink-0 p-2 border-b border-[var(--border-primary)] text-sm text-[var(--text-secondary)] flex items-center gap-2">
              <button onClick={() => setIsExplorerVisible(true)} className="p-1 rounded hover:bg-[var(--bg-hover)]">
                &lt; Back
              </button>
              <span>{selectedFile.path}</span>
            </div>
            <div className="flex-grow relative">
              <CodeEditor
                  key={selectedFile.path}
                  file={selectedFile}
                  onContentChange={handleContentChange}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // --- Desktop View ---
  return (
    <div className="flex flex-grow h-full overflow-hidden">
      <div className="w-64 flex-shrink-0 bg-[var(--bg-panel-secondary)] border-r border-[var(--border-primary)] flex flex-col">
        <div className="flex-grow overflow-y-auto">
            <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
            />
        </div>
        <div className="p-4 border-t border-[var(--border-primary)] flex-shrink-0">
             <DownloadButton
                files={files}
                uploadedFiles={uploadedFiles}
                assetMappings={assetMappings}
                addonName={addonName || "MyAddon"}
                disabled={files.length === 0}
            />
        </div>
      </div>
      <div className="flex-grow flex flex-col bg-[var(--editor-bg)]">
        {selectedFile ? (
            <>
                <div className="flex-shrink-0 p-2 border-b border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
                    {selectedFile.path}
                </div>
                <div className="flex-grow relative">
                    <CodeEditor
                        key={selectedFile.path}
                        file={selectedFile}
                        onContentChange={handleContentChange}
                    />
                </div>
            </>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            Select a file to view its content
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorerView;
