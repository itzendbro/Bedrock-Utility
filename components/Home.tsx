import React from 'react';

interface HomeProps {
    onToolSelect: (tool: string) => void;
}

const ToolCard: React.FC<{
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
  className?: string;
  large?: boolean;
}> = ({ onClick, icon, title, description, className = '', large = false }) => (
  <button
    onClick={onClick}
    className={`group bg-[var(--bg-panel)] p-6 rounded-2xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all duration-200 text-left flex flex-col h-full transform hover:-translate-y-1 hover:shadow-[0_0_35px_5px_var(--accent-primary-alpha)] ${className}`}
  >
    <div className={`${large ? 'text-5xl' : 'text-4xl'} mb-4`}>{icon}</div>
    <h3 className={`${large ? 'text-2xl' : 'text-xl'} font-bold text-[var(--text-primary)] transition-colors duration-200 group-hover:text-[var(--accent-primary)]`}>{title}</h3>
    <p className={`${large ? 'text-base' : 'text-sm'} text-[var(--text-secondary)] mt-2 flex-grow`}>{description}</p>
  </button>
);

const Home: React.FC<HomeProps> = ({ onToolSelect }) => {
    return (
        <div className="overflow-y-auto p-8 flex flex-col h-full">
            <div className="flex-grow flex flex-col justify-center">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold pb-2 flex items-center justify-center gap-3">
                        <span className="animated-gradient-text">Welcome to Bedrock Utility</span>
                        <span>🧰</span>
                    </h2>
                    <p className="text-lg mt-2 font-bold animated-gradient-text">THE HEAVEN OF ADDON CREATION</p>
                </div>
                
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <ToolCard
                            onClick={() => onToolSelect('automatic_mode')}
                            icon="🚀"
                            title="Automatic AI Mode"
                            description="Just describe your idea in plain English, and the AI will build the entire add-on for you. Best for easy & fast work."
                            large
                        />
                        <ToolCard
                            onClick={() => onToolSelect('manual_mode')}
                            icon="✍️"
                            title="Manual Mode"
                            description="Use guided forms and editors to build add-on components piece-by-piece. Best for pro users."
                            large
                        />
                        <ToolCard
                            onClick={() => window.location.href = 'mailto:shadid234e@gmail.com?subject=Bedrock%20Utility%20Bug%20Report'}
                            icon="🐞"
                            title="Report a Bug"
                            description="Found an issue? Let us know so we can fix it. Your feedback helps improve Bedrock Utility for everyone."
                            large
                        />
                    </div>
                </div>
            </div>

            <footer className="mt-16 text-center text-xs text-[var(--text-secondary)]">
                <div className="flex justify-center items-center gap-4 flex-wrap mb-4">
                    <span>App By Shadid234 and AKMPRO</span>
                    <span className="text-[var(--text-tertiary)]">|</span>
                    <a href="https://discord.gg/invite/fkksjsnc" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-primary)]">Discord</a>
                    <span className="text-[var(--text-tertiary)]">|</span>
                    <a href="mailto:shadid234e@gmail.com" className="hover:text-[var(--accent-primary)]">Mail Me</a>
                    <span className="text-[var(--text-tertiary)]">|</span>
                    <a href="https://www.buymeacoffee.com/shadid234" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-primary)]">❤️ Donate</a>
                </div>
            </footer>
        </div>
    );
};

export default Home;