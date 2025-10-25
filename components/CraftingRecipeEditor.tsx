import React, { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { GeneratedFile } from '../types';

type RecipeType = 'shaped' | 'shapeless' | 'furnace';

const CodeBlock: React.FC<{ file: GeneratedFile; onClear: () => void }> = ({ file, onClear }) => {
    const [copied, setCopied] = useState(false);
    const { addNotification } = useNotification();
  
    const handleCopy = () => {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      addNotification('info', 'Content copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    };
    
    const handleDownload = () => {
      const blob = new Blob([file.content], { type: 'application/json' });
      const link = document.createElement('a');
      const fileName = file.path.split('/').pop() || 'recipe.json';
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addNotification('success', `${fileName} downloaded.`);
    };
  
    return (
      <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Generated Recipe File</label>
          <div className="relative bg-[var(--bg-app)] p-4 rounded-lg border border-[var(--border-primary)]">
            <div className="absolute top-2 right-2 flex gap-2">
               <button onClick={onClear} title="Clear" className="p-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
               <button onClick={handleDownload} title="Download file" className="p-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
              <button onClick={handleCopy} title="Copy content" className="p-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition">
                {copied ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-green)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
              </button>
            </div>
            <pre className="overflow-x-auto text-xs text-gray-300 font-mono"><code>{file.content}</code></pre>
          </div>
      </div>
    );
};

const ItemSlot: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string, large?: boolean }> = ({ value, onChange, placeholder, large }) => (
    <input 
        type="text" 
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-[var(--bg-input)] rounded border border-[var(--border-primary)] text-center text-[var(--text-secondary)] placeholder:text-opacity-50 text-xs truncate ${large ? 'w-20 h-20 p-2' : 'w-16 h-16 p-1'}`}
    />
);

const CraftingRecipeEditor: React.FC = () => {
    const [recipeType, setRecipeType] = useState<RecipeType>('shaped');
    const [identifier, setIdentifier] = useState('custom:my_recipe');
    const [tags, setTags] = useState('crafting_table');
    
    // Shaped
    const [pattern, setPattern] = useState(Array(9).fill(''));
    const [keys, setKeys] = useState<{key: string, item: string}[]>([]);

    // Shapeless
    const [ingredients, setIngredients] = useState<string[]>(['']);

    // Furnace
    const [furnaceInput, setFurnaceInput] = useState('');
    
    // Result
    const [resultItem, setResultItem] = useState('');
    const [resultCount, setResultCount] = useState(1);
    
    const [generatedFile, setGeneratedFile] = useState<GeneratedFile | null>(null);
    const { addNotification } = useNotification();

    const addKey = () => setKeys([...keys, { key: '', item: '' }]);
    const removeKey = (index: number) => setKeys(keys.filter((_, i) => i !== index));
    const updateKey = (index: number, field: 'key' | 'item', value: string) => {
        const newKeys = [...keys];
        newKeys[index][field] = value;
        setKeys(newKeys);
    };

    const addIngredient = () => setIngredients([...ingredients, '']);
    const removeIngredient = (index: number) => setIngredients(ingredients.filter((_, i) => i !== index));
    const updateIngredient = (index: number, value: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = value;
        setIngredients(newIngredients);
    };

    const handleGenerate = () => {
        if (!resultItem) {
            addNotification('error', 'Result item cannot be empty.');
            return;
        }

        const recipe: any = {
            format_version: "1.12.0",
        };
        
        const result = {
            item: resultItem,
            count: resultCount
        };

        const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);

        switch(recipeType) {
            case 'shaped':
                // Filter out empty rows from the pattern
                const p = pattern.map(char => char || ' ');
                const patternRows = [
                    p.slice(0, 3).join(''),
                    p.slice(3, 6).join(''),
                    p.slice(6, 9).join(''),
                ];
                const finalPattern = patternRows.filter(row => row.trim() !== '');
                if (finalPattern.length === 0) {
                    addNotification('error', 'Shaped recipe pattern cannot be empty.');
                    return;
                }
                
                recipe["minecraft:recipe_shaped"] = {
                    description: { identifier },
                    tags: tagsArray,
                    pattern: finalPattern,
                    key: keys.reduce((acc, key) => ({...acc, [key.key]: {item: key.item}}), {}),
                    result: result
                };
                break;
            case 'shapeless':
                 const validIngredients = ingredients.map(item => ({item})).filter(ing => ing.item.trim() !== '');
                 if (validIngredients.length === 0) {
                     addNotification('error', 'Shapeless recipe must have at least one ingredient.');
                     return;
                 }
                recipe["minecraft:recipe_shapeless"] = {
                    description: { identifier },
                    tags: tagsArray,
                    ingredients: validIngredients,
                    result: result
                };
                break;
            case 'furnace':
                if (!furnaceInput) {
                    addNotification('error', 'Furnace input cannot be empty.');
                    return;
                }
                recipe["minecraft:recipe_furnace"] = {
                    description: { identifier },
                    tags: tagsArray,
                    input: furnaceInput,
                    output: resultItem
                };
                break;
        }

        const fileName = (resultItem.split(':')[1] || identifier.split(':')[1] || "recipe") + ".json";
        setGeneratedFile({
            path: `recipes/${fileName}`,
            content: JSON.stringify(recipe)
        });
        addNotification('success', 'Recipe JSON generated!');
    };

    const renderForm = () => {
        switch (recipeType) {
            case 'shaped':
                return (
                    <div className="flex flex-col lg:flex-row gap-6">
                         <div className="flex-shrink-0 grid grid-cols-3 gap-2 p-2 bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg w-fit">
                           {pattern.map((p, i) => <input key={i} type="text" value={p} onChange={e => { const newPattern = [...pattern]; newPattern[i] = e.target.value.slice(0,1); setPattern(newPattern);}} maxLength={1} className="w-16 h-16 text-center bg-[var(--bg-input)] rounded border border-[var(--border-primary)]"/>)}
                        </div>
                        <div className="flex flex-col gap-2 flex-grow">
                           {keys.map((k, i) => (
                               <div key={i} className="flex items-center gap-2">
                                   <input type="text" placeholder="Key" value={k.key} onChange={e => updateKey(i, 'key', e.target.value.slice(0,1))} maxLength={1} className="w-12 text-center bg-[var(--bg-input)] rounded border p-2 border-[var(--border-primary)]"/>
                                   <input type="text" placeholder="Item ID (e.g., minecraft:stick)" value={k.item} onChange={e => updateKey(i, 'item', e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2 border-[var(--border-primary)] text-sm"/>
                                   <button onClick={() => removeKey(i)} className="p-2 text-red-500 rounded hover:bg-red-500/10 flex-shrink-0">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                   </button>
                               </div>
                           ))}
                           <button onClick={addKey} className="text-sm text-[var(--accent-primary)] hover:underline text-left mt-2">+ Add Key</button>
                        </div>
                    </div>
                );
            case 'shapeless':
                return (
                     <div className="grid grid-cols-3 gap-2 p-2 bg-[var(--bg-app)] border border-[var(--border-primary)] rounded-lg w-fit">
                        {ingredients.map((ing, i) => (
                             <ItemSlot key={i} value={ing} onChange={v => updateIngredient(i, v)} placeholder="Item ID"/>
                        ))}
                        <button onClick={addIngredient} className="w-16 h-16 flex items-center justify-center bg-[var(--bg-input)] rounded border-2 border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]">+</button>
                    </div>
                );
            case 'furnace':
                return (
                    <div className="flex items-center justify-center gap-4 p-4">
                        <ItemSlot value={furnaceInput} onChange={setFurnaceInput} placeholder="Input" large/>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        <ItemSlot value={resultItem} onChange={setResultItem} placeholder="Output" large />
                    </div>
                );
        }
    };
    
    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Crafting Recipe Editor</h2>
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Panel */}
                <div className="lg:w-1/3 flex flex-col gap-4">
                     <div className="flex bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-primary)]">
                        {(['shaped', 'shapeless', 'furnace'] as RecipeType[]).map(type => (
                            <button key={type} onClick={() => setRecipeType(type)} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors capitalize ${recipeType === type ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>{type}</button>
                        ))}
                    </div>
                    <input type="text" placeholder="Identifier (e.g., custom:my_recipe)" value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>
                    <input type="text" placeholder="Tags (e.g., crafting_table)" value={tags} onChange={e => setTags(e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>
                    
                    <div className="border-t border-[var(--border-primary)] my-2"></div>

                    <h3 className="font-bold text-lg">Result</h3>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Result Item ID" value={resultItem} onChange={e => setResultItem(e.target.value)} className="w-full bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>
                        {recipeType !== 'furnace' && <input type="number" value={resultCount} onChange={e => setResultCount(parseInt(e.target.value) || 1)} min="1" className="w-24 bg-[var(--bg-input)] rounded border p-2.5 border-[var(--border-primary)]"/>}
                    </div>
                    <button onClick={handleGenerate} className="w-full flex justify-center items-center px-6 py-3 font-semibold rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] mt-2">Generate Recipe File</button>

                </div>
                {/* Right Panel */}
                <div className="lg:w-2/3 p-4 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-panel-secondary)]">
                    <h3 className="font-bold text-lg mb-4 capitalize">{recipeType} Recipe</h3>
                    {renderForm()}
                </div>
            </div>

            {generatedFile && <CodeBlock file={generatedFile} onClear={() => setGeneratedFile(null)} />}
        </div>
    );
};

export default CraftingRecipeEditor;