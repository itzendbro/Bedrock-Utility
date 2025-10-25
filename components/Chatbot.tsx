import React, { useState, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { startMinecraftChat } from '../services/geminiService';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Source {
  uri: string;
  title: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
}

const Chatbot: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChat(startMinecraftChat());
     setMessages([{ role: 'model', text: "I'm a Minecraft expert with real-time web access. Ask me anything!" }]);
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
      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Source[] = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
            uri: chunk.web.uri,
            title: chunk.web.title || chunk.web.uri,
        }));

      const modelMessage: Message = { role: 'model', text, sources };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = { role: 'model', text: 'Sorry, something went wrong.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
     <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-3xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-input)]'}`}>
              <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
                <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
              </div>
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="max-w-3xl mt-2 text-xs">
                <p className="font-semibold text-[var(--text-secondary)] mb-1">Sources:</p>
                <ul className="flex flex-wrap gap-2">
                  {msg.sources.map((source, i) => (
                    <li key={i}>
                      <a href={source.uri} target="_blank" rel="noopener noreferrer" title={source.title} className="block max-w-xs truncate px-2 py-1 bg-[var(--bg-hover)] text-[var(--accent-primary)] rounded-md hover:underline">
                        {new URL(source.uri).hostname}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
      <div className="flex-shrink-0 mt-4">
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
            placeholder="Ask a question about Minecraft... (Shift + Enter for new line)"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 bg-[var(--accent-primary)] text-white font-semibold rounded-lg disabled:bg-[var(--bg-active)] self-stretch flex items-center justify-center"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
