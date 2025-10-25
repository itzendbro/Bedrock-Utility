import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { generateTexture, refineTexture } from '../services/geminiService';

// --- TYPES ---
type Layer = {
  id: string;
  name: string;
  image: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
};

// --- SUB-COMPONENTS ---
const ControlSlider: React.FC<{ label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; hint?: string }> = ({ label, value, onChange, min, max, step, hint }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" title={hint}>{label}</label>
        <div className="flex items-center gap-2">
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--bg-input)] rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-mono w-14 text-center bg-[var(--bg-input)] py-1 rounded border border-[var(--border-primary)]">{value.toFixed(2)}</span>
        </div>
    </div>
);

const Spinner: React.FC<{text?: string}> = ({text = "Loading..."}) => (
  <div className="flex items-center justify-center">
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text}
  </div>
);


// --- MAIN COMPONENT ---
const GlyphTool: React.FC = () => {
    const [layers, setLayers] = useState<Layer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [resolution, setResolution] = useState('64x64');
    const [aiPrompt, setAiPrompt] = useState('');
    const [refinePrompt, setRefinePrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragLayerRef = useRef<{ id: string, index: number } | null>(null);
    const dragCanvasRef = useRef<{ startX: number, startY: number, layerStartX: number, layerStartY: number } | null>(null);

    const { addNotification } = useNotification();
    const selectedLayer = useMemo(() => layers.find(l => l.id === selectedLayerId), [layers, selectedLayerId]);

    // --- LAYER MANAGEMENT ---
    const addLayer = useCallback((image: HTMLImageElement, name: string) => {
        const canvas = canvasRef.current;
        const newLayer: Layer = {
            id: `${name}-${Date.now()}`,
            name: name.replace(/\.png$/, ''),
            image,
            x: canvas ? canvas.width / 2 : 256,
            y: canvas ? canvas.height / 2 : 256,
            scale: 1,
            rotation: 0,
            opacity: 1,
            visible: true,
        };
        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
    }, []);

    const updateLayer = (id: string, newProps: Partial<Omit<Layer, 'id' | 'image'>>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...newProps } : l));
    };

    const removeLayer = (id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) {
            setSelectedLayerId(layers.length > 1 ? layers.find(l => l.id !== id)?.id ?? null : null);
        }
    };

    // --- AI HANDLERS ---
    const handleGenerateLayer = async () => {
        if (!aiPrompt.trim()) {
            addNotification('error', "Please enter a description to generate a layer.");
            return;
        }
        setIsLoading(true);
        try {
            const base64 = await generateTexture(aiPrompt, 'pixel art', '64x64');
            const img = new Image();
            img.onload = () => addLayer(img, aiPrompt.split(' ').slice(0, 3).join('_'));
            img.src = `data:image/png;base64,${base64}`;
            setAiPrompt('');
            addNotification('success', "AI Layer generated!");
        } catch(err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRefineLayer = async () => {
        if (!refinePrompt.trim() || !selectedLayer) {
            addNotification('error', "Please select a layer and enter a refinement instruction.");
            return;
        }
        setIsLoading(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = selectedLayer.image.width;
            canvas.height = selectedLayer.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(selectedLayer.image, 0, 0);
            const base64 = canvas.toDataURL('image/png').split(',')[1];

            const refinedBase64 = await refineTexture(base64, refinePrompt);
            const img = new Image();
            img.onload = () => {
                setLayers(prev => prev.map(l => l.id === selectedLayer.id ? {...l, image: img} : l));
            };
            img.src = `data:image/png;base64,${refinedBase64}`;
            setRefinePrompt('');
            addNotification('success', "Layer refined by AI!");
        } catch(err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- FILE & EXPORT HANDLERS ---
    const handleFileDrop = useCallback((files: FileList | null) => {
        if (!files) return;
        Array.from(files).filter(f => f.type === 'image/png').forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => addLayer(img, file.name);
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    }, [addLayer]);

    const handleExport = () => {
        const exportSize = parseInt(resolution.split('x')[0]);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasSize = canvas.width;
        const scaleFactor = exportSize / canvasSize;

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = exportSize;
        offscreenCanvas.height = exportSize;
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        layers.filter(l => l.visible).forEach(layer => {
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.translate(layer.x * scaleFactor, layer.y * scaleFactor);
            ctx.rotate(layer.rotation * Math.PI / 180);
            
            const scaledWidth = layer.image.width * layer.scale * scaleFactor;
            const scaledHeight = layer.image.height * layer.scale * scaleFactor;
            ctx.drawImage(layer.image, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
            ctx.restore();
        });

        const link = document.createElement('a');
        link.download = `custom_glyph_${resolution}.png`;
        link.href = offscreenCanvas.toDataURL('image/png');
        link.click();
        addNotification('success', 'Glyph exported successfully!');
    };

    // --- CANVAS DRAWING & INTERACTION ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        layers.filter(l => l.visible).forEach(layer => {
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.translate(layer.x, layer.y);
            ctx.rotate(layer.rotation * Math.PI / 180);
            const drawWidth = layer.image.width * layer.scale;
            const drawHeight = layer.image.height * layer.scale;
            ctx.drawImage(layer.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            
            if (layer.id === selectedLayerId) {
                ctx.strokeStyle = "rgba(0, 122, 204, 0.8)";
                ctx.lineWidth = 2;
                ctx.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            }
            ctx.restore();
        });
    }, [layers, selectedLayerId]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (!selectedLayer) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Basic hit detection (a more accurate one would account for rotation)
            const dx = mouseX - selectedLayer.x;
            const dy = mouseY - selectedLayer.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < (selectedLayer.image.width * selectedLayer.scale) / 2) {
                 dragCanvasRef.current = { startX: mouseX, startY: mouseY, layerStartX: selectedLayer.x, layerStartY: selectedLayer.y };
            }
        };
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragCanvasRef.current || !selectedLayer) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newX = dragCanvasRef.current.layerStartX + (mouseX - dragCanvasRef.current.startX);
            const newY = dragCanvasRef.current.layerStartY + (mouseY - dragCanvasRef.current.startY);
            updateLayer(selectedLayer.id, { x: newX, y: newY });
        };
        const handleMouseUp = () => {
            dragCanvasRef.current = null;
        };
        
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [selectedLayer, layers]);

    // --- LAYER DRAG & DROP REORDERING ---
    const handleLayerDragStart = (id: string, index: number) => {
        dragLayerRef.current = { id, index };
    };
    const handleLayerDragEnter = (index: number) => {
        if (!dragLayerRef.current || dragLayerRef.current.index === index) return;
        const newLayers = [...layers];
        const draggedItem = newLayers.splice(dragLayerRef.current.index, 1)[0];
        newLayers.splice(index, 0, draggedItem);
        dragLayerRef.current.index = index;
        setLayers(newLayers);
    };

    return (
        <div className="flex flex-grow gap-6 p-6 overflow-hidden h-full">
            {/* Left Panel: Controls */}
            <div className="w-[350px] flex-shrink-0 flex flex-col gap-4 bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-primary)] overflow-y-auto">
                <h3 className="text-lg font-bold">Glyph Controls</h3>
                {/* AI Generation */}
                <div className="p-3 bg-[var(--bg-app)] rounded-lg border border-[var(--border-primary)] flex flex-col gap-3">
                    <h4 className="font-semibold text-sm">AI Generation</h4>
                    <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g., A single pixelated flame icon" rows={3} className="w-full bg-[var(--bg-input)] text-sm p-2 rounded"/>
                    <button onClick={handleGenerateLayer} disabled={isLoading} className="w-full flex justify-center items-center py-2 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                        {isLoading && !selectedLayer ? <Spinner text="Generating..." /> : 'Generate New Layer'}
                    </button>
                </div>
                {/* Layer Controls */}
                <div className={`p-3 bg-[var(--bg-app)] rounded-lg border border-[var(--border-primary)] flex flex-col gap-3 transition-opacity ${selectedLayer ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <h4 className="font-semibold text-sm">Selected Layer Controls</h4>
                    <ControlSlider label="Scale" value={selectedLayer?.scale ?? 1} onChange={v => updateLayer(selectedLayerId, { scale: v })} min={0.1} max={5} step={0.01} />
                    <ControlSlider label="Rotation" value={selectedLayer?.rotation ?? 0} onChange={v => updateLayer(selectedLayerId, { rotation: v })} min={0} max={360} step={1} />
                    <ControlSlider label="Opacity" value={selectedLayer?.opacity ?? 1} onChange={v => updateLayer(selectedLayerId, { opacity: v })} min={0} max={1} step={0.01} />
                    <h4 className="font-semibold text-sm pt-2 border-t border-[var(--border-primary)]">AI Refinement</h4>
                    <textarea value={refinePrompt} onChange={e => setRefinePrompt(e.target.value)} placeholder="e.g., Add a glowing blue outline" rows={2} className="w-full bg-[var(--bg-input)] text-sm p-2 rounded"/>
                    <button onClick={handleRefineLayer} disabled={isLoading} className="w-full flex justify-center items-center py-2 font-semibold rounded-lg text-black bg-[var(--accent-yellow)] hover:opacity-80 disabled:bg-[var(--bg-active)]">
                         {isLoading && selectedLayer ? <Spinner text="Refining..." /> : 'Refine Selected Layer'}
                    </button>
                </div>
                {/* Export */}
                 <div className="p-3 bg-[var(--bg-app)] rounded-lg border border-[var(--border-primary)] flex flex-col gap-3">
                    <h4 className="font-semibold text-sm">Export</h4>
                     <div className="flex gap-2">
                        {['16x16', '32x32', '64x64'].map(res => (
                            <button key={res} onClick={() => setResolution(res)} className={`w-full py-2 text-xs font-semibold rounded-md transition-colors ${resolution === res ? 'bg-[var(--bg-active)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>{res}</button>
                        ))}
                    </div>
                    <button onClick={handleExport} disabled={layers.length === 0} className="w-full flex justify-center items-center py-2 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] disabled:bg-[var(--bg-active)]">Export as PNG</button>
                 </div>
            </div>

            {/* Center Panel: Canvas */}
            <div className="flex-grow flex items-center justify-center bg-grid-pattern p-4 rounded-xl border border-[var(--border-primary)]"
                onDragEnter={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingFile(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDraggingFile(false); handleFileDrop(e.dataTransfer.files); }}>
                <canvas ref={canvasRef} width={512} height={512} className={`bg-transparent ${selectedLayer ? 'cursor-move' : 'cursor-default'}`}/>
            </div>

            {/* Right Panel: Layers */}
            <div className="w-64 flex-shrink-0 flex flex-col gap-2 bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-primary)]">
                <h3 className="text-lg font-bold">Layers ({layers.length})</h3>
                <div className="flex-grow overflow-y-auto pr-1 space-y-2">
                    {layers.slice().reverse().map((layer, index) => {
                        const originalIndex = layers.length - 1 - index;
                        return (
                            <div key={layer.id} 
                                 onClick={() => setSelectedLayerId(layer.id)}
                                 draggable
                                 onDragStart={() => handleLayerDragStart(layer.id, originalIndex)}
                                 onDragEnter={() => handleLayerDragEnter(originalIndex)}
                                 onDragEnd={() => dragLayerRef.current = null}
                                 className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border-2 ${selectedLayerId === layer.id ? 'border-[var(--accent-primary)] bg-[var(--bg-input)]' : 'border-transparent hover:bg-[var(--bg-hover)]'}`}>
                                <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible })}} className="p-1">{layer.visible ? '👁️' : '🙈'}</button>
                                <img src={layer.image.src} alt={layer.name} className="w-8 h-8 object-contain bg-grid-pattern rounded-md flex-shrink-0" style={{imageRendering: 'pixelated'}}/>
                                <input type="text" value={layer.name} onChange={e => updateLayer(layer.id, { name: e.target.value })} onClick={e => e.stopPropagation()} className="w-full bg-transparent text-sm focus:bg-[var(--bg-app)] rounded px-1 outline-none focus:ring-1 focus:ring-[var(--accent-primary)]" />
                                <button onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }} className="p-1 rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        )
                    })}
                </div>
                 <label htmlFor="glyph-upload-btn" className="w-full text-center mt-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] cursor-pointer">
                    Upload PNG
                </label>
                <input id="glyph-upload-btn" type="file" className="sr-only" multiple accept="image/png" onChange={e => handleFileDrop(e.target.files)} />
            </div>
        </div>
    );
};

export default GlyphTool;