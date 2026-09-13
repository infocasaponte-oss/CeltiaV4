import React, { useState } from 'react';

interface Message {
  role: string;
  content: string;
}

const App = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'CELTIA v2 Online. Agardando ordes.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input;
    const userMsg: Message = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, user_id: 'admin' }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: 'Erro de conexión co núcleo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-4 flex flex-col">
      <header className="border-b border-green-900 pb-2 mb-4">
        <h1 className="text-xl font-bold tracking-widest text-green-400">CELTIA ENTERPRISE OS v2</h1>
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`${m.role === 'user' ? 'text-blue-400' : 'text-green-500'}`}>
            <span className="opacity-50">[{m.role.toUpperCase()}]</span> {m.content}
          </div>
        ))}
        {isLoading && (
          <div className="text-green-600 animate-pulse">
            <span className="opacity-50">[CELTIA]</span> Procesando orde...
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-green-900 pt-4">
        <span className="text-green-400">{">"}</span>
        <input 
          id="command-input"
          className="bg-transparent outline-none flex-1 text-green-400 placeholder-green-800"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Escribe unha orde (ex: stock, intel, factura, axuda)..."
          autoFocus
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default App;
