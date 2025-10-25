import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { generateParticleSettingsFromPrompt } from '../services/geminiService';

// Type definitions
interface ParticleSettings {
    identifier: string;
    texture: string;
    lifespan: number;
    rate: number;
    maxParticles: number;
    emitterShape: 'point' | 'sphere' | 'box';
    emitterRadius: number;
    direction: 'outward' | 'upward';
    initialSpeed: number;
    gravity: number;
    airDrag: number;
    startSize: number;
    endSize: number;
    startColor: string;
    endColor: string;
    startOpacity: number;
    endOpacity: number;
}

const defaultSettings: ParticleSettings = {
    identifier: 'custom:my_particle',
    texture: 'textures/particle/particles',
    lifespan: 2.0,
    rate: 10,
    maxParticles: 100,
    emitterShape: 'point',
    emitterRadius: 0.5,
    direction: 'outward',
    initialSpeed: 2.0,
    gravity: -1.0,
    airDrag: 1.0,
    startSize: 0.1,
    endSize: 0.01,
    startColor: '#FFFFFF',
    endColor: '#FFFFFF',
    startOpacity: 1.0,
    endOpacity: 0.0,
};

const ControlSlider: React.FC<{ label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; hint?: string }> = ({ label, value, onChange, min, max, step, hint }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)]" title={hint}>{label}</label>
        <div className="flex items-center gap-2">
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-2 bg-[var(--bg-input)] rounded-lg appearance-none cursor-pointer" />
            <input type="number" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-16 bg-[var(--bg-input)] text-center text-sm rounded border border-[var(--border-primary)]" />
        </div>
    </div>
);

const ParticleEditor: React.FC = () => {
    const [settings, setSettings] = useState<ParticleSettings>(defaultSettings);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<any[]>([]);
    const { addNotification } = useNotification();
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const updateSetting = (key: keyof ParticleSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };
    
    // The main simulation and drawing loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const loop = (timestamp: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Emit new particles
            if (particlesRef.current.length < settings.maxParticles) {
                 for (let i = 0; i < Math.floor(settings.rate / 60); i++) {
                    let posX = canvas.width / 2, posY = canvas.height / 2;
                    let velX = (Math.random() - 0.5) * settings.initialSpeed;
                    let velY = (Math.random() - 0.5) * settings.initialSpeed;
                    
                    if(settings.direction === 'upward') {
                        velY = -Math.random() * settings.initialSpeed;
                    }
                    particlesRef.current.push({ x: posX, y: posY, vx: velX, vy: velY, age: 0, maxAge: settings.lifespan * 1000 });
                 }
            }

            // Update and draw particles
            particlesRef.current = particlesRef.current.filter(p => p.age < p.maxAge);
            particlesRef.current.forEach(p => {
                p.vx *= (1 - settings.airDrag * 0.01);
                p.vy *= (1 - settings.airDrag * 0.01);
                p.vy += settings.gravity * 0.01;
                p.x += p.vx;
                p.y += p.vy;
                p.age += 16; // rough delta time

                const lifeRatio = p.age / p.maxAge;
                const size = settings.startSize + (settings.endSize - settings.startSize) * lifeRatio;
                
                const r1 = parseInt(settings.startColor.slice(1, 3), 16);
                const g1 = parseInt(settings.startColor.slice(3, 5), 16);
                const b1 = parseInt(settings.startColor.slice(5, 7), 16);
                const r2 = parseInt(settings.endColor.slice(1, 3), 16);
                const g2 = parseInt(settings.endColor.slice(3, 5), 16);
                const b2 = parseInt(settings.endColor.slice(5, 7), 16);

                const r = Math.round(r1 + (r2 - r1) * lifeRatio);
                const g = Math.round(g1 + (g2 - g1) * lifeRatio);
                const b = Math.round(b1 + (b2 - b1) * lifeRatio);

                const opacity = settings.startOpacity + (settings.endOpacity - settings.startOpacity) * lifeRatio;

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size * 20, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(loop);
        };
        
        loop(0);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [settings]);

    const handleGenerateJson = () => {
        const particleJson = {
            format_version: "1.20.50",
            particle_effect: {
                description: {
                    identifier: settings.identifier,
                    basic_render_parameters: {
                        material: "particles_alpha",
                        texture: settings.texture,
                    },
                },
                components: {
                    "minecraft:emitter_rate_steady": {
                        spawn_rate: settings.rate,
                        max_particles: settings.maxParticles,
                    },
                    "minecraft:emitter_lifetime_looping": { active_time: 1 },
                    "minecraft:emitter_shape_point": {
                        direction: settings.direction === 'upward' ? [0, 1, 0] : "outwards",
                    },
                    "minecraft:particle_lifetime_expression": {
                        max_lifetime: settings.lifespan,
                    },
                    "minecraft:particle_initial_speed": settings.initialSpeed,
                    "minecraft:particle_motion_dynamic": {
                        linear_acceleration: [0, settings.gravity, 0],
                        linear_drag_coefficient: settings.airDrag,
                    },
                    "minecraft:particle_appearance_billboard": {
                        size: [`variable.particle_age / variable.particle_lifetime * ${settings.endSize - settings.startSize} + ${settings.startSize}`],
                        facing_camera_mode: "lookat_xyz",
                    },
                    "minecraft:particle_appearance_tinting": {
                        color: {
                            gradient: [
                                { time: 0.0, color: settings.startColor },
                                { time: 1.0, color: settings.endColor },
                            ],
                            interpolant: `variable.particle_age / variable.particle_lifetime`,
                        },
                    },
                },
            },
        };

        const content = JSON.stringify(particleJson);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = settings.identifier.split(':')[1] || 'particle';
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addNotification('success', 'Particle JSON downloaded!');
    };
    
    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) {
            addNotification('info', 'Please describe the particle effect.');
            return;
        }
        setIsAiLoading(true);
        try {
            const newSettings = await generateParticleSettingsFromPrompt(aiPrompt);
            setSettings(prev => ({ ...prev, ...newSettings }));
            addNotification('success', 'AI settings applied!');
        } catch (err) {
            addNotification('error', (err as Error).message);
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="flex flex-grow gap-6 p-6 overflow-hidden h-full">
            <div className="w-[400px] flex-shrink-0 flex flex-col gap-4 bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-primary)]">
                <h3 className="text-lg font-bold">Particle Controls</h3>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Identifier</label>
                        <input type="text" value={settings.identifier} onChange={e => updateSetting('identifier', e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-1.5 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Texture Path</label>
                        <input type="text" value={settings.texture} onChange={e => updateSetting('texture', e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-1.5 text-sm" />
                    </div>
                    <ControlSlider label="Lifespan (s)" value={settings.lifespan} onChange={v => updateSetting('lifespan', v)} min={0.1} max={10} step={0.1} />
                    <ControlSlider label="Spawn Rate" value={settings.rate} onChange={v => updateSetting('rate', v)} min={1} max={200} step={1} />
                    <ControlSlider label="Max Particles" value={settings.maxParticles} onChange={v => updateSetting('maxParticles', v)} min={10} max={1000} step={10} />
                    <ControlSlider label="Initial Speed" value={settings.initialSpeed} onChange={v => updateSetting('initialSpeed', v)} min={0} max={20} step={0.1} />
                    <ControlSlider label="Gravity" value={settings.gravity} onChange={v => updateSetting('gravity', v)} min={-20} max={20} step={0.1} hint="Negative for up, positive for down" />
                    <ControlSlider label="Air Drag" value={settings.airDrag} onChange={v => updateSetting('airDrag', v)} min={0} max={10} step={0.1} />
                    <ControlSlider label="Start Size" value={settings.startSize} onChange={v => updateSetting('startSize', v)} min={0} max={2} step={0.01} />
                    <ControlSlider label="End Size" value={settings.endSize} onChange={v => updateSetting('endSize', v)} min={0} max={2} step={0.01} />
                     <div className="flex gap-4">
                        <div className="flex-1">
                             <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Start Color</label>
                             <input type="color" value={settings.startColor} onChange={e => updateSetting('startColor', e.target.value)} className="w-full h-8 p-0 border-0 rounded" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">End Color</label>
                             <input type="color" value={settings.endColor} onChange={e => updateSetting('endColor', e.target.value)} className="w-full h-8 p-0 border-0 rounded" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-grow flex flex-col gap-4">
                 <div className="flex-grow flex items-center justify-center bg-grid-pattern bg-black/30 p-4 rounded-xl border border-[var(--border-primary)] relative">
                    <canvas ref={canvasRef} width={512} height={512} />
                </div>
                 <div className="h-48 flex-shrink-0 flex flex-col gap-2 bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-primary)]">
                    <h3 className="text-md font-bold">AI Generation</h3>
                    <div className="flex gap-2 flex-grow">
                        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a particle effect, e.g., 'a burst of purple fire that floats upwards'" className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm resize-none min-h-[80px]" />
                        <div className="flex flex-col gap-2">
                            <button onClick={handleAiGenerate} disabled={isAiLoading} className="w-32 h-full flex justify-center items-center font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-active)]">
                               {isAiLoading ? '...' : 'Apply AI'}
                            </button>
                            <button onClick={handleGenerateJson} className="w-32 h-full flex justify-center items-center font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)]">Download JSON</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParticleEditor;