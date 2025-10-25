import React, { useState, useEffect, useRef } from 'react';
import { VANILLA_ITEMS, VanillaItem } from '../data/vanillaItems';

interface ItemSelectorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const ItemSelector: React.FC<ItemSelectorProps> = ({ value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    const filteredItems = VANILLA_ITEMS.filter(item => 
        item.name.toLowerCase().includes(value.toLowerCase()) || 
        item.id.toLowerCase().includes(value.toLowerCase())
    );

    const handleSelect = (item: VanillaItem) => {
        onChange(item.id);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[var(--text-secondary)]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </span>
            <input
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder || 'Search or enter ID...'}
                className="w-full bg-[var(--bg-input)] p-1.5 pl-7 rounded text-xs border border-transparent focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none"
                autoComplete="off"
            />
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                    <ul className="overflow-y-auto flex-grow">
                        {filteredItems.slice(0, 100).map(item => ( // limit to 100 to avoid performance issues
                            <li
                                key={item.id}
                                onMouseDown={() => handleSelect(item)} // use onMouseDown to fire before onBlur from input
                                className="px-3 py-2 text-xs cursor-pointer hover:bg-[var(--bg-hover)] flex justify-between items-center"
                            >
                                <span className="text-[var(--text-primary)]">{item.name}</span>
                                <span className="text-[var(--text-tertiary)] ml-2 truncate">{item.id}</span>
                            </li>
                        )) }
                        {filteredItems.length === 0 && (
                            <li className="px-3 py-2 text-xs text-[var(--text-secondary)]">No vanilla items found. Enter a custom ID.</li>
                        )}
                         {filteredItems.length > 100 && (
                            <li className="px-3 py-2 text-xs text-center text-[var(--text-tertiary)]">...and {filteredItems.length - 100} more</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ItemSelector;
