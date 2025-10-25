import React, { useState, useEffect, useRef } from 'react';
import { GeneratedFile } from '../types';
import SyntaxHighlighter from './SyntaxHighlighter';

interface CodeEditorProps {
    file: GeneratedFile;
    onContentChange: (newContent: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ file, onContentChange }) => {
    const [content, setContent] = useState(file.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        setContent(file.content);
    }, [file]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        onContentChange(e.target.value);
    };

    const handleScroll = () => {
        if (preRef.current && textareaRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };
    
    const getLanguage = (path: string): 'js' | 'json' | 'text' => {
        if (path.endsWith('.js')) return 'js';
        if (path.endsWith('.json')) return 'json';
        return 'text';
    };

    return (
        <div className="relative h-full w-full font-mono text-sm">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onScroll={handleScroll}
                className="absolute inset-0 z-10 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none border-0 outline-none overflow-auto"
                spellCheck="false"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
            />
            <pre
                ref={preRef}
                className="absolute inset-0 w-full h-full m-0 p-4 bg-[var(--editor-bg)] pointer-events-none overflow-auto"
                aria-hidden="true"
            >
                <SyntaxHighlighter code={content} language={getLanguage(file.path)} />
            </pre>
        </div>
    );
};

export default CodeEditor;
