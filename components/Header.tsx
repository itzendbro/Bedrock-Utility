import React from 'react';

interface HeaderProps {
    theme: string;
    onThemeChange: () => void;
    onGoHome: () => void;
}

const ThemeIcon: React.FC<{ theme: string }> = ({ theme }) => {
    // The icon should represent the NEXT theme in the cycle
    // dark -> light (sun)
    // light -> high-contrast (contrast)
    // high-contrast -> solarized-dark (moon)
    // solarized-dark -> monokai (moon)
    // monokai -> nord (moon)
    // nord -> dark (moon)
    switch (theme) {
        case 'light': // next is high-conwww.w3.orgtrast
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 4a6 6 0 100 12 6 6 0 000-12zM10 5a5 5 0 000 10V5z" /></svg>;
        case 'high-contrast': // next is solarized-dark
        case 'solarized-dark': // next is monokai
        case 'monokai': // next is nord
        case 'nord': // next is dark
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
        case 'dark': // next is light
        default:
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    }
};

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange, onGoHome }) => {
    return (
        <header className="flex-shrink-0 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] flex items-center justify-between px-6 h-16">
            <button
                onClick={onGoHome}
                className="flex items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] focus-visible:ring-[var(--accent-primary)]"
                aria-label="Go to Home"
            >
                <span className="text-3xl">🧰</span>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">Bedrock Utility</h1>
            </button>
            <div className="flex items-center gap-4">
                <a 
                    href="https://discord.gg/invite/djdnjajd" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 text-sm font-semibold"
                    title="Join our Discord"
                >
                    Join Discord
                </a>
                <button
                    onClick={onThemeChange}
                    className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
                    title="Change theme"
                >
                    <ThemeIcon theme={theme} />
                </button>
            </div>
        </header>
    );
};

export default Header;