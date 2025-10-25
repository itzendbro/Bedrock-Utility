import React from 'react';

const BottomPanel: React.FC = () => {
  return (
    <div className="h-48 bg-[var(--bg-panel-secondary)] border-t border-[var(--border-primary)] p-4 flex-shrink-0">
      <h3 className="text-sm font-bold text-white">Output</h3>
      {/* Content for the bottom panel can go here */}
      <div className="text-sm text-[var(--text-secondary)] mt-2">
        Logs and tool output will appear here.
      </div>
    </div>
  );
};

export default BottomPanel;
