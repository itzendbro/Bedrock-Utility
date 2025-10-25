import React, { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { GeneratedFile } from '../types';
import { downloadAddon } from '../utils/fileConverter';
import ItemSelector from './ItemSelector';

// --- TYPE DEFINITIONS ---
interface TradeItem {
    item: string;
    quantity: number;
}

interface Trade {
    id: string;
    wants: TradeItem[];
    gives: TradeItem[];
    max_uses: number;
    xp_reward: boolean;
}

interface TradeTier {
    id: string;
    level: number;
    trades: Trade[];
}

const CodeBlock: React.FC<{ files: GeneratedFile[]; onClear: () => void; addonName: string }> = ({ files, onClear, addonName }) => {
    const [activeFile, setActiveFile] = useState(files[0]);
    const { addNotification } = useNotification();
  
    const handleDownload = async () => {
        try {
            await downloadAddon(addonName, files, [], []);
            addNotification('success', `${addonName}.mcaddon downloaded!`);
        } catch (e) {
            addNotification('error', `Failed to package addon: ${(e as Error).message}`);
        }
    };
  
    return (
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Generated Addon Files</h3>
            <div className="flex gap-2">
                <button onClick={onClear} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-[var(--bg-hover)] hover:opacity-80">Clear</button>
                <button onClick={handleDownload} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-[var(--accent-green)] hover:bg-[var(--accent-green-hover)] text-white">Download .mcaddon</button>
            </div>
        </div>
        <div className="flex gap-2 border-b border-[var(--border-primary)]">
            {files.map(file => (
                <button key={file.path} onClick={() => setActiveFile(file)} className={`px-3 py-2 text-sm border-b-2 ${activeFile.path === file.path ? 'border-[var(--accent-primary)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}>
                    {file.path.split('/').pop()}
                </button>
            ))}
        </div>
        <div className="relative bg-[var(--bg-app)] p-4 rounded-lg border border-[var(--border-primary)] max-h-96 overflow-y-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap"><code>{activeFile.content}</code></pre>
        </div>
      </div>
    );
};

const TradeEditor: React.FC = () => {
    const { addNotification } = useNotification();
    
    // --- STATE ---
    const [addonName, setAddonName] = useState('MyTradeAddon');
    const [npcIdentifier, setNpcIdentifier] = useState('custom:shopkeeper');
    const [displayName, setDisplayName] = useState('Shopkeeper');
    const [professionName, setProfessionName] = useState('shopkeeper');

    const [tiers, setTiers] = useState<TradeTier[]>([{ id: `tier-${Date.now()}`, level: 1, trades: [] }]);
    const [activeTierId, setActiveTierId] = useState<string | null>(tiers[0]?.id || null);

    const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[] | null>(null);

    // --- STATE UPDATE HANDLERS ---
    const addTier = () => {
        const newLevel = tiers.length > 0 ? Math.max(...tiers.map(t => t.level)) + 1 : 1;
        const newTier = { id: `tier-${Date.now()}`, level: newLevel, trades: [] };
        setTiers([...tiers, newTier]);
        setActiveTierId(newTier.id);
    };

    const removeTier = (id: string) => {
        setTiers(tiers.filter(t => t.id !== id));
        if (activeTierId === id) {
            setActiveTierId(tiers.length > 1 ? tiers.find(t => t.id !== id)?.id ?? null : null);
        }
    };

    const addTrade = (tierId: string) => {
        const newTrade: Trade = { id: `trade-${Date.now()}`, wants: [{item: 'minecraft:emerald', quantity: 1}], gives: [{item: 'minecraft:diamond', quantity: 1}], max_uses: 10, xp_reward: true };
        setTiers(tiers.map(t => t.id === tierId ? { ...t, trades: [...t.trades, newTrade] } : t));
    };

    const updateTrade = (tierId: string, tradeId: string, updatedTrade: Partial<Trade>) => {
        setTiers(tiers.map(t => t.id === tierId ? { ...t, trades: t.trades.map(tr => tr.id === tradeId ? {...tr, ...updatedTrade} : tr) } : t));
    };
    
    const removeTrade = (tierId: string, tradeId: string) => {
        setTiers(tiers.map(t => t.id === tierId ? { ...t, trades: t.trades.filter(tr => tr.id !== tradeId) } : t));
    };
    
    const activeTier = tiers.find(t => t.id === activeTierId);

    // --- FILE GENERATION ---
    const handleGenerate = () => {
        if (!npcIdentifier.includes(':')) {
            addNotification('error', 'NPC Identifier must include a namespace (e.g., custom:trader).');
            return;
        }

        const tradeJson: any = {
            tiers: tiers.map(tier => ({
                total_exp_required: tier.level * 10, // Example logic
                groups: [{
                    trades: tier.trades.map(trade => ({
                        wants: trade.wants,
                        gives: trade.gives,
                        trader_exp: trade.xp_reward ? 3 : 0,
                        max_uses: trade.max_uses,
                        reward_exp: trade.xp_reward,
                    }))
                }]
            }))
        };

        const files: GeneratedFile[] = [
            {
                path: `behavior_pack/trading/${npcIdentifier.split(':')[1]}.json`,
                content: JSON.stringify(tradeJson, null, 2),
            },
            {
                path: `resource_pack/texts/en_US.lang`,
                content: `entity.${npcIdentifier}.name=${displayName}`
            },
            {
                path: `behavior_pack/manifest.json`,
                content: JSON.stringify({
                    format_version: 2,
                    header: { name: `${addonName} BP`, description: `Behavior pack for ${addonName}`, uuid: crypto.randomUUID(), version: [1,0,0], min_engine_version: [1,21,114] },
                    modules: [{ type: "data", uuid: crypto.randomUUID(), version: [1,0,0] }],
                    dependencies: [{ module_name: "@minecraft/server", version: "1.12.0-beta" }]
                }, null, 2)
            },
            {
                path: `resource_pack/manifest.json`,
                content: JSON.stringify({
                    format_version: 2,
                    header: { name: `${addonName} RP`, description: `Resource pack for ${addonName}`, uuid: crypto.randomUUID(), version: [1,0,0], min_engine_version: [1,21,114] },
                    modules: [{ type: "resources", uuid: crypto.randomUUID(), version: [1,0,0] }]
                }, null, 2)
            }
        ];
        
        setGeneratedFiles(files);
        addNotification('success', 'Addon files generated!');
    };
    
    if (generatedFiles) {
        return <CodeBlock files={generatedFiles} onClear={() => setGeneratedFiles(null)} addonName={addonName} />;
    }

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Villager Trade Editor</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" placeholder="Addon Name (for download)" value={addonName} onChange={e => setAddonName(e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>
                <input type="text" placeholder="NPC Identifier (e.g., custom:trader)" value={npcIdentifier} onChange={e => setNpcIdentifier(e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>
                <input type="text" placeholder="Display Name (e.g., Magic Trader)" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Tiers Column */}
                <div className="w-full md:w-1/4 flex flex-col gap-2">
                    <h3 className="font-bold">Trade Tiers</h3>
                    {tiers.map((tier, index) => (
                        <div key={tier.id} onClick={() => setActiveTierId(tier.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${activeTierId === tier.id ? 'bg-[var(--bg-active)] border-[var(--accent-primary)]' : 'bg-[var(--bg-panel-secondary)] border-transparent hover:border-[var(--border-primary)]'}`}>
                            <span>Tier {index + 1}</span>
                            <button onClick={(e) => {e.stopPropagation(); removeTier(tier.id)}} className="p-1 text-red-500 rounded-full hover:bg-red-500/10"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg></button>
                        </div>
                    ))}
                    <button onClick={addTier} className="w-full mt-2 py-2 text-sm text-center rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]">+ Add Tier</button>
                </div>

                {/* Trades Column */}
                <div className="w-full md:w-3/4 flex flex-col gap-4 p-4 bg-[var(--bg-panel-secondary)] rounded-lg border border-[var(--border-primary)]">
                    {!activeTier ? (
                        <div className="text-center text-[var(--text-secondary)]">Select or add a tier to see its trades.</div>
                    ) : (
                        <>
                            <h3 className="font-bold">Trades for Tier {tiers.findIndex(t => t.id === activeTierId) + 1}</h3>
                            <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto pr-2">
                                {activeTier.trades.map(trade => (
                                     <div key={trade.id} className="bg-[var(--bg-app)] p-3 rounded-lg border border-[var(--border-primary)]">
                                        <div className="flex items-start gap-4">
                                            {/* Wants */}
                                            <div className="flex-1 space-y-1">
                                                <h4 className="text-sm font-semibold text-green-400">Wants</h4>
                                                <div className="flex gap-2 text-xs text-[var(--text-secondary)] px-1">
                                                    <div className="flex-grow">Item ID</div>
                                                    <div className="w-16 text-center">Quantity</div>
                                                </div>
                                                {trade.wants.map((item, i) => (
                                                    <div key={i} className="flex gap-2 items-center">
                                                        <ItemSelector
                                                            value={item.item}
                                                            onChange={value => updateTrade(activeTier.id, trade.id, { wants: trade.wants.map((w, wi) => wi === i ? {...w, item: value} : w)})}
                                                        />
                                                        <input type="number" min="1" value={item.quantity} onChange={e => updateTrade(activeTier.id, trade.id, { wants: trade.wants.map((w, wi) => wi === i ? {...w, quantity: parseInt(e.target.value) || 1} : w)})} className="w-16 bg-[var(--bg-input)] p-1.5 rounded text-xs text-center border border-transparent focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none"/>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-2xl pt-8">→</div>
                                             {/* Gives */}
                                             <div className="flex-1 space-y-1">
                                                <h4 className="text-sm font-semibold text-sky-400">Gives</h4>
                                                 <div className="flex gap-2 text-xs text-[var(--text-secondary)] px-1">
                                                    <div className="flex-grow">Item ID</div>
                                                    <div className="w-16 text-center">Quantity</div>
                                                </div>
                                                {trade.gives.map((item, i) => (
                                                    <div key={i} className="flex gap-2 items-center">
                                                        <ItemSelector
                                                            value={item.item}
                                                            onChange={value => updateTrade(activeTier.id, trade.id, { gives: trade.gives.map((g, gi) => gi === i ? {...g, item: value} : g)})}
                                                        />
                                                        <input type="number" min="1" value={item.quantity} onChange={e => updateTrade(activeTier.id, trade.id, { gives: trade.gives.map((g, gi) => gi === i ? {...g, quantity: parseInt(e.target.value) || 1} : g)})} className="w-16 bg-[var(--bg-input)] p-1.5 rounded text-xs text-center border border-transparent focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none"/>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-primary)]">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-[var(--text-secondary)]">Max Uses:</label>
                                                <input type="number" value={trade.max_uses} onChange={e => updateTrade(activeTier.id, trade.id, {max_uses: parseInt(e.target.value)})} className="w-20 bg-[var(--bg-input)] p-1 rounded text-xs text-center"/>
                                            </div>
                                            <button onClick={() => removeTrade(activeTier.id, trade.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                                        </div>
                                     </div>
                                ))}
                            </div>
                            <button onClick={() => addTrade(activeTier.id)} className="w-full mt-2 py-2 text-sm text-center rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]">+ Add Trade to Tier</button>
                        </>
                    )}
                </div>
            </div>

            <button onClick={handleGenerate} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] mt-4">
                Generate Addon
            </button>
        </div>
    );
};

export default TradeEditor;
