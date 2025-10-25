import React, { useState, useRef, useEffect, useCallback } from 'react';

const MusicPlayer: React.FC = () => {
    const [playlist, setPlaylist] = useState<File[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const volumeControlRef = useRef<HTMLDivElement>(null);

    // --- Core Audio Logic ---

    const handleNext = useCallback(() => {
        if (playlist.length === 0) return;
        setCurrentTrackIndex(prev => {
            if (prev === null) return 0;
            return (prev + 1) % playlist.length;
        });
    }, [playlist.length]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => { setDuration(audio.duration); setCurrentTime(audio.currentTime); };
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const handleEnded = () => { if (!isLooping) handleNext(); };

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);
        audio.volume = volume;
        audio.loop = isLooping;

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [isLooping, volume, handleNext]);

    useEffect(() => {
        if (currentTrackIndex !== null && audioRef.current && playlist[currentTrackIndex]) {
            const trackUrl = URL.createObjectURL(playlist[currentTrackIndex]);
            const prevUrl = audioRef.current.src;
            audioRef.current.src = trackUrl;
            audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
            if (prevUrl.startsWith('blob:')) {
                URL.revokeObjectURL(prevUrl);
            }
        } else if (currentTrackIndex === null && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            setIsPlaying(false);
        }
    }, [currentTrackIndex, playlist]);

    // --- UI Interaction Handlers ---

    const handleFileChange = (files: FileList | null) => {
        if (files) {
            const newFiles = Array.from(files);
            const wasEmpty = playlist.length === 0;
            setPlaylist(prev => {
                const existingNames = new Set(prev.map(f => f.name));
                const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
                return [...prev, ...uniqueNewFiles];
            });
            if (wasEmpty && newFiles.length > 0) {
                setCurrentTrackIndex(0);
            }
        }
    };

    const togglePlayPause = () => {
        if (!audioRef.current || currentTrackIndex === null) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handlePrevious = () => {
        if (playlist.length === 0) return;
        setCurrentTrackIndex(prev => {
            if (prev === null) return playlist.length - 1;
            return (prev - 1 + playlist.length) % playlist.length;
        });
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime);
        if (audioRef.current) audioRef.current.currentTime = newTime;
    };

    const removeTrack = (index: number) => {
        const isRemovingCurrent = currentTrackIndex === index;
        const newPlaylist = playlist.filter((_, i) => i !== index);
        setPlaylist(newPlaylist);

        if (isRemovingCurrent) {
            if (newPlaylist.length === 0) {
                setCurrentTrackIndex(null);
            } else {
                setCurrentTrackIndex(index % newPlaylist.length);
            }
        } else if (currentTrackIndex !== null && index < currentTrackIndex) {
            setCurrentTrackIndex(prev => prev! - 1);
        }
    };
    
    // --- Drag and Drop ---
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDraggingOver(true);
        else if (e.type === "dragleave") setIsDraggingOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files?.length) {
            handleFileChange(e.dataTransfer.files);
        }
    }, []);

    // --- Helper Functions & Effects ---

    const formatTime = (time: number) => {
        if (isNaN(time) || time === Infinity) return '00:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (volumeControlRef.current && !volumeControlRef.current.contains(event.target as Node)) {
                setIsVolumeSliderVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentTrack = currentTrackIndex !== null ? playlist[currentTrackIndex] : null;

    if (playlist.length === 0) {
        return (
            <div 
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={`flex flex-col items-center justify-center text-center p-8 gap-6 max-w-2xl mx-auto h-[600px] bg-[var(--bg-panel-secondary)] rounded-lg border-2 border-dashed  transition-colors ${isDraggingOver ? 'border-[var(--accent-primary)]' : 'border-[var(--border-primary)]'}`}
            >
                <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e.target.files)} accept="audio/*" multiple className="hidden" />
                <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-[var(--text-tertiary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V4a1 1 0 00-1-1z" /></svg>
                <h2 className="text-2xl font-bold">Your Music Library is Empty</h2>
                <p className="text-[var(--text-secondary)]">Drag & drop your audio files here or click the button below to start listening.</p>
                <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-8 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors">
                    Add Music
                </button>
            </div>
        )
    }

    return (
        <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className={`flex flex-col gap-6 max-w-2xl mx-auto p-4 rounded-lg border-2 border-dashed transition-colors ${isDraggingOver ? 'border-[var(--accent-primary)]' : 'border-transparent'}`}>
            <audio ref={audioRef} />
            <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e.target.files)} accept="audio/*" multiple className="hidden" />
            
            <div className="bg-[var(--bg-panel)] p-6 rounded-lg border border-[var(--border-primary)] shadow-2xl flex flex-col gap-4">
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 bg-black rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden shadow-inner">
                        <div className={`absolute w-full h-full bg-grid-pattern opacity-10 rounded-full ${isPlaying ? 'animate-spin-slow' : ''}`}></div>
                        <div className={`absolute w-32 h-32 bg-center bg-no-repeat bg-contain ${isPlaying ? 'animate-spin-slow' : ''}`} style={{backgroundImage: 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzIyMiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjAuNSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjM4IiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMC41Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIzMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjAuNSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE4IiBmaWxsPSIjMDgwODA4Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMyIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==)'}}></div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[var(--text-tertiary)] z-10" viewBox="0 0 20 20" fill="currentColor"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V4a1 1 0 00-1-1z" /></svg>
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-sm text-[var(--accent-primary)] font-semibold">Now Playing</p>
                        <h3 className="font-bold text-2xl text-white truncate">{currentTrack?.name || 'No music loaded'}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">By an unknown artist</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{formatTime(currentTime)}</span>
                    <input type="range" min={0} max={duration || 0} value={currentTime} onChange={handleProgressChange} disabled={!currentTrack} className="w-full h-2 bg-[var(--bg-input)] rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed" />
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{formatTime(duration)}</span>
                </div>

                <div className="flex justify-between items-center mt-2">
                    <button onClick={() => setIsLooping(!isLooping)} title="Toggle Loop" className={`p-2 rounded-full transition-colors ${isLooping ? 'text-[var(--accent-primary)] bg-[var(--bg-active)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v2.101a7.002 7.002 0 0011.601 2.566 1 1 0 10-1.885-.666A5.002 5.002 0 015.999 7H9a1 1 0 100-2H4a1 1 0 00-1-1H3a1 1 0 00-1 1zm1.12 11.854a1 1 0 00-1.244 1.244l.001.001a7.002 7.002 0 0011.601-2.566 1 1 0 10-1.885.666A5.002 5.002 0 015.999 13H9a1 1 0 100 2H4a1 1 0 00-1-1v-1a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                    
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrevious} disabled={!currentTrack} className="p-3 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.447 14.043l-4.243-4.242a1 1 0 010-1.414l4.243-4.243a1 1 0 111.414 1.414L7.07 9.414h7.43a1 1 0 010 2H7.07l2.79 2.79a1 1 0 01-1.414 1.414z" /></svg></button>
                        <button onClick={togglePlayPause} disabled={!currentTrack} className="p-4 rounded-full bg-white text-black hover:scale-105 transform transition-transform disabled:bg-[var(--bg-active)] disabled:scale-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">{isPlaying ? <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1zm5 0a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" /> : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />}</svg></button>
                        <button onClick={handleNext} disabled={!currentTrack} className="p-3 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M11.553 5.957l4.243 4.243a1 1 0 010 1.414l-4.243 4.243a1 1 0 11-1.414-1.414L12.93 10.586H5.5a1 1 0 010-2h7.43l-2.79-2.79a1 1 0 011.414-1.414z" /></svg></button>
                    </div>
                    
                    <div ref={volumeControlRef} className="relative">
                        <button onClick={() => setIsVolumeSliderVisible(!isVolumeSliderVisible)} className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 011.447.894L8.447 5H11a1 1 0 110 2H8.447l.003.106A1 1 0 017 8v8a2 2 0 01-4 0V8a2 2 0 012-2h1V5a1 1 0 011-1zm2 12a1 1 0 110 2h3a1 1 0 110-2H9zM3 8a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" /></svg></button>
                        {isVolumeSliderVisible && <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="absolute -top-24 -left-1/2 transform -rotate-90 origin-bottom-left h-2 w-20 bg-[var(--bg-input)] rounded-lg appearance-none cursor-pointer" />}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 bg-[var(--bg-panel)] p-4 rounded-lg border border-[var(--border-primary)]">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-white">Playlist ({playlist.length})</h3>
                    <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-[var(--accent-primary)] hover:underline">Add Music</button>
                </div>
                {playlist.map((file, index) => (
                    <div key={`${file.name}-${index}`} className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${currentTrackIndex === index ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}>
                         <button onClick={() => setCurrentTrackIndex(index)} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[var(--bg-input)]">
                            {currentTrackIndex === index && isPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.75a.75.75 0 01.75.75v11.5a.75.75 0 01-1.5 0V4.5a.75.75 0 01.75-.75zM5.5 3.75a.75.75 0 01.75.75v11.5a.75.75 0 01-1.5 0V4.5a.75.75 0 01.75-.75zM14.5 3.75a.75.75 0 01.75.75v11.5a.75.75 0 01-1.5 0V4.5a.75.75 0 01.75-.75z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>}
                         </button>
                         <div className="flex-grow truncate"><p className={`text-sm ${currentTrackIndex === index ? 'text-white font-semibold' : 'text-[var(--text-secondary)]'}`}>{file.name}</p></div>
                         <button onClick={() => removeTrack(index)} className="p-1 rounded-full text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                    </div>
                ))}
            </div>
             <style>{`
                .animate-spin-slow { animation: spin 20s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default MusicPlayer;
