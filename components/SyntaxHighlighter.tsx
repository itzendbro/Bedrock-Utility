import React from 'react';

interface SyntaxHighlighterProps {
    code: string;
    language: 'js' | 'json' | 'text';
}

const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = React.memo(({ code, language }) => {
    const highlight = (code: string, language: 'js' | 'json' | 'text') => {
        if (language === 'text' || !code) {
            return <code style={{color: 'var(--editor-default)'}}>{code}</code>;
        }
        
        let tokens: { type: string; value: string }[] = [];

        if (language === 'json') {
            const jsonRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[\[\]\{\},:])/g;
            let match;
            let lastIndex = 0;
            while ((match = jsonRegex.exec(code)) !== null) {
                const preMatch = code.substring(lastIndex, match.index);
                if (preMatch) tokens.push({ type: 'default', value: preMatch });

                const value = match[0];
                if (/^"/.test(value)) {
                    tokens.push({ type: match[3] ? 'key' : 'string', value });
                } else if (/true|false|null/.test(value)) {
                    tokens.push({ type: 'keyword', value });
                } else if (!isNaN(parseFloat(value))) {
                    tokens.push({ type: 'number', value });
                } else {
                    tokens.push({ type: 'punctuation', value });
                }
                lastIndex = match.index + value.length;
            }
            const postMatch = code.substring(lastIndex);
            if(postMatch) tokens.push({type: 'default', value: postMatch});
        } else if (language === 'js') {
            const jsRegex = /(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)|(\b(const|let|var|function|return|if|else|for|while|import|export|from|new|this|async|await|switch|case|default|break)\b)|('(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*'|"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"|`[^`]*`)|(\b(true|false|null|undefined)\b)|(-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)|([A-Z][a-zA-Z0-9]*)|([\{\}\[\]\(\)\.,:;=\+\-\*\/%&\|!<>?~])|(\b[a-z_][a-zA-Z0-9_]*\b)/g;
            let match;
            let lastIndex = 0;
            while ((match = jsRegex.exec(code)) !== null) {
                const preMatch = code.substring(lastIndex, match.index);
                if (preMatch) tokens.push({ type: 'default', value: preMatch });

                const [value, comment, keyword, string, boolean, number, className, punctuation, variable] = match;
                if (comment) tokens.push({ type: 'comment', value });
                else if (keyword) tokens.push({ type: 'keyword', value });
                else if (string) tokens.push({ type: 'string', value });
                else if (boolean) tokens.push({ type: 'keyword', value });
                else if (number) tokens.push({ type: 'number', value });
                else if (className) tokens.push({ type: 'className', value });
                else if (punctuation) tokens.push({ type: 'punctuation', value });
                else if (variable) tokens.push({ type: 'default', value});
                else tokens.push({ type: 'default', value });

                lastIndex = match.index + value.length;
            }
            const postMatch = code.substring(lastIndex);
            if(postMatch) tokens.push({type: 'default', value: postMatch});
        }

        return (
            <code style={{ whiteSpace: 'pre-wrap' }}>
                {tokens.map((token, i) => {
                    let color = 'var(--editor-default)';
                    switch(token.type) {
                        case 'string': color = 'var(--editor-string)'; break;
                        case 'number': color = 'var(--editor-number)'; break;
                        case 'keyword': color = 'var(--editor-keyword)'; break;
                        case 'key': color = 'var(--editor-key)'; break;
                        case 'punctuation': color = 'var(--editor-punctuation)'; break;
                        case 'comment': color = 'var(--text-tertiary)'; break;
                        case 'className': color = 'var(--accent-yellow)'; break;
                    }
                    return <span key={i} style={{ color }}>{token.value}</span>;
                })}
            </code>
        );
    };

    return highlight(code, language);
});

export default SyntaxHighlighter;
