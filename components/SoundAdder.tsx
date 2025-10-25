import React, { useState, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import JSZip from 'jszip';

// --- TYPE DEFINITIONS ---
interface SoundFile {
    id: string;
    file: File;
    volume: number;
    pitch: number;
    is3d: boolean;
    weight: number;
}

const soundCategories = ['block', 'bottle', 'bucket', 'hostile', 'music', 'neutral', 'player', 'record', 'ui', 'weather'] as const;
type SoundCategory = typeof soundCategories[number];


interface SoundNamespace {
    id:string;
    name: string;
    category: SoundCategory;
    sounds: SoundFile[];
}

// --- HELPER COMPONENTS ---
const Spinner: React.FC<{text: string}> = ({text}) => (
    <div className="flex items-center">
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text}
    </div>
);

const SoundControl: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col items-center gap-1">
        <label className="text-xs text-[var(--text-secondary)]">{label}</label>
        {children}
    </div>
);


// --- MAIN COMPONENT ---
const SoundAdder: React.FC = () => {
    const [namespaces, setNamespaces] = useState<SoundNamespace[]>([]);
    const [isLoadingPack, setIsLoadingPack] = useState(false);
    const { addNotification } = useNotification();
    const [isDragging, setIsDragging] = useState<{ [key: string]: boolean }>({});


    // --- STATE MANAGEMENT ---
    const addNamespace = () => {
        const newNamespace: SoundNamespace = {
            id: `ns-${Date.now()}`,
            name: '',
            category: 'neutral',
            sounds: [],
        };
        setNamespaces(prev => [...prev, newNamespace]);
    };

    const removeNamespace = (id: string) => {
        setNamespaces(prev => prev.filter(ns => ns.id !== id));
    };

    const updateNamespace = (id: string, field: 'name' | 'category', value: string) => {
        setNamespaces(prev => prev.map(ns => ns.id === id ? { ...ns, [field]: value } : ns));
    };

    const addSoundsToNamespace = (id: string, files: FileList) => {
        const audioFile = Array.from(files).find(file => file.type.startsWith('audio/'));
        if (!audioFile) {
            addNotification('error', 'No valid audio file was found.');
            return;
        }

        if (files.length > 1) {
            addNotification('info', `Multiple files were provided. Only adding '${audioFile.name}'. Each namespace supports only one sound file.`);
        }
        
        const newSound: SoundFile = {
            id: `sound-${Date.now()}-${Math.random()}-${audioFile.name}`,
            file: audioFile,
            volume: 1.0,
            pitch: 1.0,
            is3d: true,
            weight: 1,
        };

        setNamespaces(prev =>
            prev.map(ns => {
                if (ns.id === id) {
                    // This will be called only when sounds array is empty due to the UI change
                    return { ...ns, sounds: [newSound] };
                }
                return ns;
            })
        );
    };
    
    const removeSound = (namespaceId: string, soundId: string) => {
        setNamespaces(prev => prev.map(ns => {
            if (ns.id === namespaceId) {
                return { ...ns, sounds: ns.sounds.filter(s => s.id !== soundId) };
            }
            return ns;
        }));
    };

    const updateSound = (namespaceId: string, soundId: string, field: keyof SoundFile, value: any) => {
        setNamespaces(prev => prev.map(ns => {
            if (ns.id === namespaceId) {
                return { ...ns, sounds: ns.sounds.map(s => s.id === soundId ? { ...s, [field]: value } : s) };
            }
            return ns;
        }));
    };

    // --- Drag and Drop handlers ---
    const handleDrag = (e: React.DragEvent, namespaceId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(prev => ({ ...prev, [namespaceId]: true }));
        } else if (e.type === "dragleave") {
            setIsDragging(prev => ({ ...prev, [namespaceId]: false }));
        }
    };

    const handleDrop = (e: React.DragEvent, namespaceId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(prev => ({ ...prev, [namespaceId]: false }));
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addSoundsToNamespace(namespaceId, e.dataTransfer.files);
        }
    };


    // --- DOWNLOAD LOGIC ---

    const generateSoundDefinitions = () => {
        const soundDefinitions: any = {};
        for (const ns of namespaces) {
            if (!ns.name.trim()) continue;

            soundDefinitions[ns.name.trim()] = {
                category: ns.category,
                sounds: ns.sounds.map(sound => {
                    const shortName = sound.file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9_]/gi, '_').toLowerCase();
                    return {
                        name: `sounds/custom/${shortName}`,
                        volume: sound.volume,
                        pitch: sound.pitch,
                        is_3d: sound.is3d,
                        weight: sound.weight,
                    };
                })
            };
        }
        return {
            format_version: "1.14.0",
            sound_definitions: soundDefinitions
        };
    };

    const handleDownloadJson = () => {
        if (namespaces.every(ns => ns.sounds.length === 0)) {
            addNotification('error', 'Please add at least one sound to a namespace.');
            return;
        }
        const soundDefObject = generateSoundDefinitions();
        if (Object.keys(soundDefObject.sound_definitions).length === 0) {
            addNotification('error', 'Please provide a name for at least one namespace.');
            return;
        }

        const content = JSON.stringify(soundDefObject, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'sound_definitions.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification('success', 'sound_definitions.json downloaded!');
    };
    
    const handleDownloadPack = async () => {
        if (namespaces.every(ns => ns.sounds.length === 0)) {
            addNotification('error', 'Please add at least one sound to a namespace.');
            return;
        }
        const soundDefObject = generateSoundDefinitions();
        if (Object.keys(soundDefObject.sound_definitions).length === 0) {
            addNotification('error', 'Please provide a name for at least one namespace.');
            return;
        }
        setIsLoadingPack(true);
        try {
            const zip = new JSZip();
            const addonName = "CustomSoundPack";
            
            // manifest.json at the root
            zip.file('manifest.json', JSON.stringify({
                format_version: 2,
                header: { name: addonName, description: "Custom sounds", uuid: crypto.randomUUID(), version: [1,0,0], min_engine_version: [1,21,114] },
                modules: [{ type: "resources", uuid: crypto.randomUUID(), version: [1,0,0] }]
            }, null, 2));

            const soundsFolder = zip.folder("sounds");
            if (!soundsFolder) {
                 throw new Error("Could not create sounds folder in zip.");
            }

            // Place sound_definitions.json inside the 'sounds' folder as requested.
            soundsFolder.file('sound_definitions.json', JSON.stringify(soundDefObject, null, 2));
            
            // sound files go in sounds/custom/
            const customSoundsFolder = soundsFolder.folder("custom");
            if (!customSoundsFolder) {
                throw new Error("Could not create sounds/custom folder in zip.");
            }

            const allSounds = namespaces.flatMap(ns => ns.sounds);
            const uniqueSounds = Array.from(new Map(allSounds.map(s => [s.file.name, s])).values());
            
            // FIX: Cast `uniqueSounds` as `SoundFile[]` to correctly type the `sound` variable in the loop.
            // This resolves an issue where TypeScript was incorrectly inferring `sound` as `unknown`.
            for (const sound of uniqueSounds as SoundFile[]) {
                if (!sound.file.name.endsWith('.ogg')) {
                     addNotification('info', `'${sound.file.name}' is not an OGG. It may not work in-game.`);
                }
                const shortName = sound.file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9_]/gi, '_').toLowerCase();
                customSoundsFolder.file(`${shortName}.ogg`, sound.file);
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${addonName}.mcpack`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addNotification('success', 'Sound pack (.mcpack) downloaded!');
        } catch (err) {
            addNotification('error', 'Failed to create sound pack.');
            console.error(err);
        } finally {
            setIsLoadingPack(false);
        }
    };


    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-[var(--text-primary)]">Sound Adder</h2>
            <button onClick={addNamespace} className="w-full px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]">
                Add New Namespace
            </button>
            
            <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2">
                {namespaces.map((ns) => (
                    <div 
                        key={ns.id} 
                        className={`bg-[var(--bg-panel)] p-4 rounded-lg border border-[var(--border-primary)] transition-colors duration-200 ${isDragging[ns.id] && ns.sounds.length === 0 ? 'border-[var(--accent-primary)] bg-[var(--bg-active)]' : ''}`}
                        onDragEnter={(e) => { if (ns.sounds.length === 0) handleDrag(e, ns.id); }}
                        onDragOver={(e) => { if (ns.sounds.length === 0) handleDrag(e, ns.id); }}
                        onDragLeave={(e) => { if (ns.sounds.length === 0) handleDrag(e, ns.id); }}
                        onDrop={(e) => { if (ns.sounds.length === 0) handleDrop(e, ns.id); }}
                    >
                        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[var(--border-primary)]">
                            <input
                                type="text"
                                value={ns.name}
                                onChange={(e) => updateNamespace(ns.id, 'name', e.target.value)}
                                placeholder="Enter namespace (e.g., mob.creeper.say)"
                                className="w-full bg-[var(--bg-input)] p-2 rounded text-sm"
                            />
                            <select
                                value={ns.category}
                                onChange={(e) => updateNamespace(ns.id, 'category', e.target.value)}
                                className="bg-[var(--bg-input)] p-2 rounded text-sm capitalize"
                            >
                                {soundCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                             <button onClick={() => removeNamespace(ns.id)} className="p-2 rounded-full text-red-500 hover:bg-red-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {ns.sounds.map(sound => (
                                <div key={sound.id} className="bg-[var(--bg-app)] p-2 rounded-md flex flex-col sm:flex-row items-center gap-4">
                                    <p className="flex-grow text-sm truncate text-[var(--text-secondary)]" title={sound.file.name}>{sound.file.name}</p>
                                    <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
                                        <SoundControl label="Volume">
                                            <div className="flex items-center gap-1">
                                                <input type="range" min="0" max="1" step="0.05" value={sound.volume} onChange={(e) => updateSound(ns.id, sound.id, 'volume', parseFloat(e.target.value))} className="w-16"/>
                                                <input type="number" min="0" max="1" step="0.05" value={sound.volume} onChange={(e) => updateSound(ns.id, sound.id, 'volume', parseFloat(e.target.value))} className="w-14 text-center bg-[var(--bg-input)] rounded border-transparent p-1 text-xs"/>
                                            </div>
                                        </SoundControl>
                                        <SoundControl label="Pitch">
                                            <div className="flex items-center gap-1">
                                                <input type="range" min="1" max="10" step="0.05" value={sound.pitch} onChange={(e) => updateSound(ns.id, sound.id, 'pitch', parseFloat(e.target.value))} className="w-16"/>
                                                <input type="number" min="1" max="10" step="0.05" value={sound.pitch}
                                                    onBlur={(e) => {
                                                        const num = parseFloat(e.target.value);
                                                        updateSound(ns.id, sound.id, 'pitch', isNaN(num) ? 1 : Math.max(1, Math.min(10, num)));
                                                    }}
                                                    onChange={(e) => updateSound(ns.id, sound.id, 'pitch', parseFloat(e.target.value))}
                                                    className="w-14 text-center bg-[var(--bg-input)] rounded border-transparent p-1 text-xs"/>
                                            </div>
                                        </SoundControl>
                                        <SoundControl label="3D">
                                            <input type="checkbox" checked={sound.is3d} onChange={(e) => updateSound(ns.id, sound.id, 'is3d', e.target.checked)} />
                                        </SoundControl>
                                        <SoundControl label="Weight">
                                            <input type="number" min="1" value={sound.weight} onBlur={(e) => {
                                                const num = parseInt(e.target.value, 10);
                                                updateSound(ns.id, sound.id, 'weight', isNaN(num) ? 1 : Math.max(1, num));
                                            }} onChange={(e) => updateSound(ns.id, sound.id, 'weight', e.target.value)} className="w-14 text-center bg-[var(--bg-input)] rounded border-transparent p-1 text-xs"/>
                                        </SoundControl>
                                    </div>
                                    <button onClick={() => removeSound(ns.id, sound.id)} className="p-1 rounded-full text-red-500 hover:bg-red-500/10">
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        {ns.sounds.length === 0 && (
                            <label className="w-full mt-4 py-2 text-sm text-center rounded-lg border-2 border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors block cursor-pointer">
                                + Add Sound or Drag & Drop Here
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            addSoundsToNamespace(ns.id, e.target.files);
                                        }
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                    accept="audio/*"
                                />
                            </label>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                 <button 
                    onClick={handleDownloadPack} 
                    disabled={isLoadingPack || namespaces.length === 0} 
                    className="w-full flex justify-center items-center px-6 py-3 font-bold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed"
                 >
                    {isLoadingPack ? <Spinner text="Packaging..." /> : 'Download Pack'}
                </button>
                 <button 
                    onClick={handleDownloadJson} 
                    disabled={namespaces.length === 0}
                    className="w-full flex justify-center items-center px-6 py-3 font-bold rounded-lg text-[var(--text-primary)] bg-[var(--bg-panel-secondary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] disabled:bg-[var(--bg-active)] disabled:cursor-not-allowed"
                >
                    Download sound_definitions.json
                </button>
            </div>
        </div>
    );
};

export default SoundAdder;
