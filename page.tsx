'use client';

import React, { useState, useEffect } from 'react';

type FileItem = { name: string; data: string; kind: 'pdf' | 'txt' };
type Message = { role: 'user' | 'ai'; text: string; source?: string };

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'teach'>('chat');
  const [complexity, setComplexity] = useState<'simple' | 'expert'>('simple');
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState('');
  const [evaluation, setEvaluation] = useState<any>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('studyo_key');
    if (savedKey) { setApiKey(savedKey); setIsKeySet(true); }
  }, []);

  const saveKey = () => {
    localStorage.setItem('studyo_key', apiKey);
    setIsKeySet(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = Array.from(e.target.files || []);
    uploaded.forEach(file => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const reader = new FileReader();
      reader.onload = (ev) => {
        let data = ev.target?.result as string;
        if (isPdf) data = data.split(',')[1]; // strip "data:...;base64," prefix
        setFiles(prev => [...prev, { name: file.name, data, kind: isPdf ? 'pdf' : 'txt' }]);
      };
      if (isPdf) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
    e.target.value = '';
  };

  const sendToGemini = async (prompt: string, mode: 'chat' | 'teach') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, files, apiKey, complexity, mode }),
      });
      return await response.json();
    } finally {
      setIsLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    if (!isKeySet) { setChatMessages(p => [...p, { role: 'ai', text: 'Add your Gemini API key first (left panel).' }]); return; }
    if (files.length === 0) { setChatMessages(p => [...p, { role: 'ai', text: 'Upload a document first.' }]); return; }
    const q = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
    setChatInput('');
    const res = await sendToGemini(q, 'chat');
    setChatMessages(prev => [...prev, { role: 'ai', text: res.text, source: res.source }]);
  };

  const handleEvaluate = async () => {
    if (!isKeySet || files.length === 0) {
      setEvaluation({ right: '', missed: '', off: '', score: 0, feedback: 'Add your API key and upload a document first.' });
      return;
    }
    const res = await sendToGemini(`Concept: ${concept}\n\nMy explanation: ${explanation}`, 'teach');
    try {
      setEvaluation(JSON.parse(res.text));
    } catch {
      setEvaluation({ right: '', missed: '', off: '', score: 0, feedback: 'Could not parse the response — try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4EF] p-4 md:p-8 flex flex-col md:flex-row gap-8 font-sans text-[#1F1E1B]">
      <aside className="w-full md:w-[32%] flex flex-col gap-6">
        <h1 className="text-2xl font-medium">Studyo <span className="text-sm text-[#6B6A63] font-normal">Upload, understand, and prove you've learned it.</span></h1>

        <div className="bg-white p-6 rounded-xl border border-[#E7E5DE]">
          <h2 className="font-medium mb-4">Your documents</h2>
          <label className="border-2 border-dashed border-[#E7E5DE] rounded-xl p-8 block text-center text-[#6B6A63] cursor-pointer hover:bg-gray-50">
            Drag files here or click to upload — PDF or .txt
            <input type="file" multiple accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            {files.map(f => <span key={f.name} className="bg-[#F1EFE8] px-2 py-1 rounded text-sm">{f.name} <button onClick={() => setFiles(files.filter(x => x.name !== f.name))}>×</button></span>)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E7E5DE]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isKeySet ? 'bg-[#1D9E75]' : 'bg-[#B4B2A9]'}`} />
            <label className="font-medium text-sm">Gemini API key</label>
          </div>
          <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); setIsKeySet(false); }} placeholder="Paste your key" className="w-full border rounded-lg p-2 mb-2" />
          <button onClick={saveKey} className="text-[#2F7FD1] text-sm">Save</button>
          <a href="https://aistudio.google.com/apikey" className="block text-xs text-[#6B6A63] mt-2 underline">Get a free key →</a>
        </div>
      </aside>

      <main className="flex-1 bg-white p-6 rounded-xl border border-[#E7E5DE] flex flex-col min-h-[70vh]">
        <div className="flex justify-between mb-6">
          <div className="flex bg-[#F1EFE8] rounded-full p-1">
            <button onClick={() => setActiveTab('chat')} className={`px-4 py-1 rounded-full ${activeTab === 'chat' ? 'bg-white' : ''}`}>Chat</button>
            <button onClick={() => setActiveTab('teach')} className={`px-4 py-1 rounded-full ${activeTab === 'teach' ? 'bg-white' : ''}`}>Teach-back</button>
          </div>
          <button onClick={() => setComplexity(complexity === 'simple' ? 'expert' : 'simple')} className="text-sm border rounded-full px-4 py-1">
            {complexity === 'simple' ? 'Simple' : 'Expert'}
          </button>
        </div>

        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {chatMessages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <p className={`inline-block p-3 rounded-lg ${m.role === 'user' ? 'bg-[#2F7FD1] text-white' : 'bg-[#F1EFE8]'}`}>{m.text}</p>
                  {m.source && <p className="text-[10px] text-[#6B6A63] mt-1">Source: {m.source}</p>}
                </div>
              ))}
              {isLoading && <p className="text-sm text-[#6B6A63]">Thinking…</p>}
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} className="flex-1 border rounded-lg p-2" placeholder="Ask a question..." />
              <button onClick={handleChat} disabled={isLoading} className="bg-[#2F7FD1] text-white px-6 rounded-lg disabled:opacity-50">Send</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input value={concept} onChange={e => setConcept(e.target.value)} className="w-full border rounded-lg p-3" placeholder="Concept to teach..." />
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} className="w-full border rounded-lg p-3 h-40" placeholder="Explain it in your own words..." />
            <button onClick={handleEvaluate} disabled={isLoading} className="bg-[#2F7FD1] text-white w-full py-2 rounded-lg disabled:opacity-50">{isLoading ? 'Evaluating…' : 'Evaluate my understanding'}</button>
            {evaluation && (
              <div className="mt-6 space-y-3">
                {evaluation.right && <div className="p-4 bg-[#E5F4EE] text-[#0F6E56] rounded-lg"><strong>What you got right:</strong> {evaluation.right}</div>}
                {evaluation.missed && <div className="p-4 bg-[#FBEFD9] text-[#854F0B] rounded-lg"><strong>What you missed:</strong> {evaluation.missed}</div>}
                {evaluation.off && <div className="p-4 bg-[#FAECE7] text-[#993C1D] rounded-lg"><strong>What's slightly off:</strong> {evaluation.off}</div>}
                <div className="p-4 bg-[#F1EFE8] rounded-lg flex items-center gap-4">
                  <span className="text-3xl font-medium">{evaluation.score} / 5</span>
                  <span className="text-sm text-[#6B6A63]">{evaluation.feedback}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
