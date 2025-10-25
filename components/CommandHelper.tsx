import React, { useState, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { startCommandChat } from '../services/geminiService';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNotification } from '../contexts/NotificationContext';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const CommandHelper: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newChat = startCommandChat();
    setChat(newChat);
    setMessages([{ role: 'model', text: "Hello! I'm here to help you with Minecraft Bedrock commands. What would you like to create?" }]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chat || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: input });
      const modelMessage: Message = { role: 'model', text: response.text };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = { role: 'model', text: 'Sorry, something went wrong. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const CommandCodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const { addNotification } = useNotification();
    const match = /language-(\w+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        addNotification('info', 'Command copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    if (inline) {
        return <code className="bg-[var(--bg-active)] text-yellow-300 px-1 py-0.5 rounded-sm font-mono text-xs" {...props}>{children}</code>;
    }
    
    const lang = match ? match[1] : 'text';

    return (
        <div className="bg-[var(--bg-input)] rounded-lg my-2 border border-[var(--border-primary)] overflow-hidden">
            <div className="flex justify-between items-center px-4 py-1 bg-[var(--bg-panel-secondary)] text-xs text-[var(--text-secondary)]">
                <span>{lang === 'mcbe' ? 'Bedrock Utility' : lang}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 hover:text-[var(--text-primary)]">
                    {copied ? (
                         <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-green)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Copied
                         </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Copy
                        </>
                    )}
                </button>
            </div>
            <pre className="p-4 text-sm overflow-x-auto text-[var(--editor-default)] font-mono">
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl rounded-lg ${msg.role === 'user' ? 'bg-[var(--accent-primary)] text-white p-4' : ''}`}>
              <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
                <Markdown 
                    remarkPlugins={[remarkGfm]} 
                    components={{ 
                        code: CommandCodeBlock,
                        h2: ({node, ...props}) => <h2 className="text-xl font-bold border-b border-[var(--border-primary)] pb-2 mb-4" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-semibold" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-none p-0" {...props} />,
                        li: ({node, ...props}) => <li className="mb-4" {...props} />,
                    }}
                >
                    {msg.text}
                </Markdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="max-w-xl px-4 py-2 rounded-lg bg-[var(--bg-input)]">
                    <div className="animate-pulse flex space-x-2">
                        <div className="rounded-full bg-slate-700 h-2 w-2"></div>
                        <div className="rounded-full bg-slate-700 h-2 w-2"></div>
                        <div className="rounded-full bg-slate-700 h-2 w-2"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 mt-6">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="e.g., give players on a team a special item"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
            disabled={isLoading}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-[var(--accent-primary)] text-white font-semibold rounded-lg disabled:bg-[var(--bg-active)]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommandHelper;
