import React, { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';

const SplashCreator: React.FC = () => {
    const [splashes, setSplashes] = useState<string[]>([]);
    const [currentSplash, setCurrentSplash] = useState('');
    const [canMerge, setCanMerge] = useState(false);
    const { addNotification } = useNotification();

    const handleAddSplash = () => {
        if (currentSplash.trim() === '') {
            addNotification('info', 'Splash text cannot be empty.');
            return;
        }
        if (splashes.includes(currentSplash.trim())) {
            addNotification('info', 'This splash text already exists.');
            return;
        }
        setSplashes([...splashes, currentSplash.trim()]);
        setCurrentSplash('');
    };

    const handleRemoveSplash = (index: number) => {
        setSplashes(splashes.filter((_, i) => i !== index));
    };

    const handleDownload = () => {
        if (splashes.length === 0) {
            addNotification('error', 'Please add at least one splash text before downloading.');
            return;
        }

        const jsonContent = {
            canMerge: canMerge,
            splashes: splashes
        };

        const content = JSON.stringify(jsonContent, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'splashes.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification('success', 'splashes.json downloaded!');
    };
    
    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-center">Splash Creator</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Left Column for controls */}
                <div className="flex flex-col gap-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={currentSplash}
                            onChange={(e) => setCurrentSplash(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSplash()}
                            placeholder="Write splash text here..."
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                        />
                        <button onClick={handleAddSplash} className="px-6 py-2.5 bg-[var(--accent-primary)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)]">
                            Add
                        </button>
                    </div>

                    <div className="flex items-center justify-between bg-[var(--bg-panel)] p-3 rounded-lg border border-[var(--border-primary)]">
                        <div>
                            <label htmlFor="vanilla-splashes-toggle" className="text-sm font-medium text-[var(--text-primary)] cursor-pointer">
                                Include Vanilla Splashes
                            </label>
                            <p className="text-xs text-[var(--text-tertiary)]">If on, your splashes will be added to the default list. If off, only your splashes will appear.</p>
                        </div>
                        <button id="vanilla-splashes-toggle" onClick={() => setCanMerge(!canMerge)} className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${canMerge ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-app)]'}`}>
                            <span className={`block w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${canMerge ? 'translate-x-5' : 'translate-x-1'}`}></span>
                        </button>
                    </div>

                    <button 
                        onClick={handleDownload} 
                        className="w-full flex justify-center items-center px-6 py-3 font-bold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed" 
                        disabled={splashes.length === 0}
                    >
                        Download splashes.json
                    </button>
                </div>

                {/* Right Column for list */}
                <div className="bg-[var(--bg-panel)] p-4 rounded-lg border border-[var(--border-primary)] min-h-[200px] flex flex-col">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 flex-shrink-0">Current Splashes ({splashes.length}):</h3>
                    {splashes.length === 0 ? (
                        <p className="text-sm text-center text-[var(--text-tertiary)] py-8 flex-grow flex items-center justify-center">No splashes added yet.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2 overflow-y-auto">
                            {splashes.map((splash, index) => (
                                <div key={index} className="flex items-center gap-2 bg-[var(--bg-input)] rounded-full px-3 py-1.5 text-sm text-[var(--text-primary)]">
                                    <span>{splash}</span>
                                    <button 
                                        onClick={() => handleRemoveSplash(index)} 
                                        className="p-1 rounded-full hover:bg-red-500/20 text-red-400"
                                        aria-label={`Remove "${splash}"`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SplashCreator;
