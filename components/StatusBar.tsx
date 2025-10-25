import React from 'react';

interface StatusBarProps {
  addonName: string;
  fileCount: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ addonName, fileCount }) => {
  return (
    <footer className="bg-[var(--bg-app)] border-t border-[var(--border-primary)] px-4 py-1 text-xs text-[var(--text-secondary)] flex justify-between items-center flex-shrink-0">
      <div className="flex items-center gap-4">
        <span>Ready</span>
        {addonName && (
          <>
            <div className="w-px h-3 bg-[var(--border-primary)]"></div>
            <span>{addonName}</span>
          </>
        )}
         {fileCount > 0 && (
          <>
            <div className="w-px h-3 bg-[var(--border-primary)]"></div>
            <span>{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
          </>
        )}
      </div>
      <div>Minecraft: BE 1.21.114+</div>
    </footer>
  );
};

export default StatusBar;