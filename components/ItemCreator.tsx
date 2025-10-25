import React, { useState, useCallback } from 'react';
import { GeneratedFile, UploadedFile, AssetMapping } from '../types';
import { useNotification } from '../contexts/NotificationContext';

// --- PROPS & STATE TYPES ---

interface ItemCreatorProps {
    onGenerationComplete: (
        generatedFiles: GeneratedFile[],
        uploadedFiles: UploadedFile[],
        assetMappings: AssetMapping[],
        addonName: string
      ) => void;
}

// --- HELPER & UI COMPONENTS ---

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full p-4 text-left">
                <h3 className="font-bold text-md text-[var(--text-primary)]">{title}</h3>
                <svg className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-[var(--border-primary)]">
                    {children}
                </div>
            )}
        </div>
    );
};


const InputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; info?: string; type?: string }> = 
({ label, value, onChange, placeholder, info, type = 'text' }) => (
    <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        <input 
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            placeholder={placeholder}
        />
        {info && <p className="text-xs text-[var(--text-tertiary)]">{info}</p>}
    </div>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }> =
({ label, value, onChange, min, max, step }) => (
    <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        <input 
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={min} max={max} step={step}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />
    </div>
);

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between bg-[var(--bg-input)] p-2 rounded-lg">
        <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        <button onClick={() => onChange(!checked)} className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-app)]'}`}>
            <span className={`block w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}></span>
        </button>
    </div>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }> =
({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]">
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

const IconUpload: React.FC<{ onFileChange: (file: File | null) => void }> = ({ onFileChange }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const id = 'icon-upload';
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            onFileChange(file);
        } else {
            setFileName(null);
            onFileChange(null);
        }
    };

    return (
        <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">Item Icon</label>
            <label htmlFor={id} className="w-full flex items-center gap-4 p-4 border-2 border-dashed border-[var(--border-primary)] rounded-lg cursor-pointer hover:border-[var(--accent-primary)] bg-[var(--bg-input)]">
                <div className="w-16 h-16 bg-[var(--bg-app)] rounded-lg flex items-center justify-center text-3xl text-[var(--text-tertiary)] border border-[var(--border-primary)]">+</div>
                <div className="text-sm text-[var(--text-secondary)]">
                    {fileName ? `Selected: ${fileName}` : 'Upload a .png texture'}
                </div>
            </label>
            <input id={id} type="file" accept="image/png" onChange={handleChange} className="hidden" />
        </div>
    );
};


// --- CONSTANTS ---
const CREATIVE_CATEGORIES = [
    { value: 'none', label: 'None' },
    { value: 'nature', label: 'Nature' },
    { value: 'items', label: 'Items' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'construction', label: 'Construction' },
];

const RARITIES = [
    { value: 'common', label: 'Common' },
    { value: 'uncommon', label: 'Uncommon' },
    { value: 'rare', label: 'Rare' },
    { value: 'epic', label: 'Epic' },
];

const ENCHANTABLE_SLOTS = [
    "all", "armor_head", "armor_chestplate", "armor_leggins", "armor_boot", "bow", "crossbow", 
    "elytra", "fishing_rod", "flint_and_steel", "shears", "sword", "pickaxe", "axe", 
    "shovel", "hoe", "shield"
].map(s => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }));


// --- MAIN COMPONENT ---

const ItemCreator: React.FC<ItemCreatorProps> = ({ onGenerationComplete }) => {
    // This is a simplified state for demonstration. A real implementation would have a much larger state object.
    const [identifier, setIdentifier] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [creativeCategory, setCreativeCategory] = useState('none');
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [stackSize, setStackSize] = useState(64);

    const [specialItems, setSpecialItems] = useState(false);
    
    const [enchantable, setEnchantable] = useState(false);
    const [enchantSlot, setEnchantSlot] = useState('all');
    const [enchantValue, setEnchantValue] = useState(10);
    
    const [useDurability, setUseDurability] = useState(false);
    const [durability, setDurability] = useState(100);

    const { addNotification } = useNotification();

    const handleGenerate = () => {
        if (!identifier.includes(':')) {
            addNotification('error', 'Identifier must be in format namespace:id');
            return;
        }
        if (!displayName) {
            addNotification('error', 'Display Name is required.');
            return;
        }
        if (!iconFile) {
            addNotification('error', 'Item Icon is required.');
            return;
        }

        const id_short = identifier.split(':')[1];
        
        const itemJson = {
            "format_version": "1.21.10",
            "minecraft:item": {
                "description": {
                    "identifier": identifier,
                    "menu_category": {
                        "category": creativeCategory === 'none' ? undefined : creativeCategory
                    }
                },
                "components": {
                    "minecraft:display_name": { "value": displayName },
                    "minecraft:icon": { "texture": id_short },
                    "minecraft:max_stack_size": stackSize,
                    ...(useDurability && { "minecraft:durability": { "max_durability": durability } }),
                    ...(enchantable && { "minecraft:enchantable": { "slot": enchantSlot, "value": enchantValue } }),
                }
            }
        }

        const generatedFiles: GeneratedFile[] = [{
            path: `behavior_pack/items/${id_short}.json`,
            content: JSON.stringify(itemJson, null, 2)
        }];
        
        // This is a placeholder for a full addon generation
        addNotification('success', 'Addon generation logic is not fully implemented for all fields, but the basic structure is here!');
        console.log("Generated Item JSON:", itemJson);
    };

    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Item Creator</h2>
            <InputField label="Identifier" value={identifier} onChange={setIdentifier} placeholder="custom:ruby_sword" />
            <InputField label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Ruby Sword" />
            <SelectField label="Creative Category" value={creativeCategory} onChange={setCreativeCategory} options={CREATIVE_CATEGORIES} />
            <IconUpload onFileChange={setIconFile} />
            <NumberField label="Stack Size" value={stackSize} onChange={setStackSize} min={1} max={64} />

            <Section title="Presets">
                <ToggleSwitch label="Special Items" checked={specialItems} onChange={setSpecialItems} />
                <div className={`p-2 border border-dashed border-[var(--border-primary)] rounded-lg text-center text-sm text-[var(--text-tertiary)] ${specialItems ? 'opacity-50' : ''}`}>
                    Normal Items Presets (Sword, Pickaxe, etc.) would go here.
                </div>
            </Section>
            
            <Section title="Extra Features">
                 <div className="flex flex-col gap-2">
                    <ToggleSwitch label="Enchantable" checked={enchantable} onChange={setEnchantable} />
                    {enchantable && (
                        <div className="flex gap-2 p-2 bg-[var(--bg-input)] rounded-lg">
                            <SelectField label="Slot" value={enchantSlot} onChange={setEnchantSlot} options={ENCHANTABLE_SLOTS} />
                            <NumberField label="Value" value={enchantValue} onChange={setEnchantValue} min={0} max={30} />
                        </div>
                    )}
                 </div>
            </Section>

            <Section title="Durability & Repair">
                 <div className="flex flex-col gap-2">
                    <ToggleSwitch label="Use Durability" checked={useDurability} onChange={setUseDurability} />
                    {useDurability && (
                        <div className="p-2 bg-[var(--bg-input)] rounded-lg">
                            <NumberField label="Max Durability" value={durability} onChange={setDurability} min={1} />
                        </div>
                    )}
                 </div>
            </Section>

             <button onClick={handleGenerate} className="w-full mt-4 flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)]">
                Generate Item
            </button>
             <p className="text-xs text-[var(--text-tertiary)] text-center">Note: This is a prototype based on your sketches. Not all fields are wired up to generate code yet.</p>
        </div>
    );
};

export default ItemCreator;
