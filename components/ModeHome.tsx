

import React from 'react';

const ToolCard: React.FC<{
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}> = ({ onClick, icon, title, description }) => (
  <button
    onClick={onClick}
    className={`group bg-[var(--bg-panel)] p-6 rounded-2xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all duration-200 text-left flex flex-col h-full transform hover:-translate-y-1 hover:shadow-[0_0_35px_5px_var(--accent-primary-alpha)]`}
  >
    <div className={'text-4xl mb-4'}>{icon}</div>
    <h3 className={'text-xl font-bold text-[var(--text-primary)] transition-colors duration-200 group-hover:text-[var(--accent-primary)]'}>{title}</h3>
    <p className={'text-sm text-[var(--text-secondary)] mt-2 flex-grow'}>{description}</p>
  </button>
);

interface Tool {
    id: string;
    name: string;
    icon: string;
    description: string;
}

interface ModeHomeProps {
    title: string;
    tools: Tool[];
    onToolSelect: (toolId: string) => void;
    onGoBack: () => void;
}

const ModeHome: React.FC<ModeHomeProps> = ({ title, tools, onToolSelect, onGoBack }) => {
    return (
        <div className="overflow-y-auto p-8 flex flex-col h-full">
            <div className="flex justify-end items-center mb-8">
                 <button onClick={onGoBack} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--bg-panel-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]">
                    &lt;- Back to home
                </button>
            </div>

            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold animated-gradient-text">{title}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {tools.map(tool => (
                    <ToolCard
                        key={tool.id}
                        onClick={() => onToolSelect(tool.id)}
                        icon={tool.icon}
                        title={tool.name}
                        description={tool.description}
                    />
                ))}
            </div>
        </div>
    );
};

export default ModeHome;