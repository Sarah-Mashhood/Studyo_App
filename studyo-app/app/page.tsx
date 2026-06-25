'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  // State Management
  const [apiKey, setApiKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'teach-back'
  const [depth, setDepth] = useState('simple'); // 'simple' or 'expert'
  
  // Chat View State
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: "Welcome to Studyo! Upload some documents on the left, then ask me anything. I will answer strictly based on your documents and cite my sources.",
      sources: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Teach-back View State
  const [tbConcept, setTbConcept] = useState('');
  const [tbExplanation, setTbExplanation] = useState('');
  const [isTbLoading, setIsTbLoading] = useState(false);
  const [tbResult, setTbResult] = useState(null);

  // Feedback notifications
  const [notification, setNotification] = useState(null);

  // Load API Key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('studyo_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setInputKey(savedKey);
      setIsKeySaved(true);
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Utility to trigger non-intrusive notifications
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Save API Key
  const handleSaveKey = (e) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      localStorage.removeItem('studyo_api_key');
      setApiKey('');
      setIsKeySaved(false);
      showNotification('API key removed.', 'info');
      return;
    }
    localStorage.setItem('studyo_api_key', inputKey.trim());
    setApiKey(inputKey.trim());
    setIsKeySaved(true);
    showNotification('API key saved successfully!', 'success');
  };

  // Document Upload Handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      if (documents.some(doc => doc.name === file.name)) {
        showNotification(`File "${file.name}" is already uploaded.`, 'warning');
        continue;
      }

      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setDocuments(prev => [...prev, {
            name: file.name,
            type: 'text/plain',
            content: event.target.result,
            size: (file.size / 1024).toFixed(1) + ' KB'
          }]);
          showNotification(`Loaded ${file.name}`, 'success');
        };
        reader.readAsText(file);
      } else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (event) => {
          // Extract base64 representation of PDF
          const base64Content = event.target.result.split(',')[1];
          setDocuments(prev => [...prev, {
            name: file.name,
            type: 'application/pdf',
            content: base64Content, // raw base64 string
            size: (file.size / 1024).toFixed(1) + ' KB'
          }]);
          showNotification(`Loaded ${file.name} (PDF native model content)`, 'success');
        };
        reader.readAsDataURL(file);
      } else {
        showNotification(`Unsupported file format: ${file.name}. Please upload .txt or .pdf files.`, 'error');
      }
    }
    // Clear input
    e.target.value = '';
  };

  // Remove Document Handler
  const handleRemoveDoc = (indexToRemove) => {
    setDocuments(prev => prev.filter((_, idx) => idx !== indexToRemove));
    showNotification('Document removed.', 'info');
  };

  // Base payload construction for Gemini API
  const makeGeminiRequest = async (systemInstruction, userParts) => {
    if (!apiKey) {
      showNotification('Please set your Gemini API key in the left column first.', 'error');
      return null;
    }

    // Prepare content parts: user instruction + uploaded documents as content injection
    const promptParts = [...userParts];

    // Inject TXT files into the prompt block
    const txtDocs = documents.filter(d => d.type === 'text/plain');
    if (txtDocs.length > 0) {
      let documentContext = "ADDITIONAL CONTEXT (Uploaded Documents):\n\n";
      txtDocs.forEach(doc => {
        documentContext += `--- START DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END DOCUMENT: ${doc.name} ---\n\n`;
      });
      promptParts.unshift({ text: documentContext });
    }

    // Inject PDF files natively as inlineData components
    const pdfDocs = documents.filter(d => d.type === 'application/pdf');
    pdfDocs.forEach(doc => {
      promptParts.unshift({
        inlineData: {
          mimeType: 'application/pdf',
          data: doc.content
        }
      });
      // Also supply the name in context so Gemini knows which file is which
      promptParts.unshift({
        text: `The following PDF document is named "${doc.name}". You must reference it by this name when citing.`
      });
    });

    const payload = {
      contents: [
        {
          role: 'user',
          parts: promptParts
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemInstruction }
        ]
      }
    };

    // Exponential Backoff API Fetch
    let retries = 5;
    let delay = 1000;
    while (retries > 0) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        retries--;
        if (retries === 0) {
          throw err;
        }
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  };

  // Send Chat message
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (documents.length === 0) {
      showNotification('Please upload at least one document first to chat.', 'warning');
      return;
    }

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    const systemPrompt = `You are "Studyo", an intelligent study assistant. Your goal is to answer the user's questions based strictly and ONLY on the provided documents.
- Do NOT use outside knowledge to answer things that aren't mentioned.
- If the answer cannot be found in the documents, respond with: "I cannot find this information in your uploaded documents." Do not invent or guess information.
- Always provide precise source citations at the end of your response referencing which file(s) the information came from (e.g., "[Source: manual.pdf]" or "[Source: biology_notes.txt]").
- Match the depth of explanation requested: we are using "${depth.toUpperCase()}" depth.
  * SIMPLE: Use friendly, clean analogies, conversational language, and high-level conceptual summaries.
  * EXPERT: Use technical, detailed terminology, precise references, academic phrasing, and deep system analysis.`;

    try {
      const responseText = await makeGeminiRequest(systemPrompt, [{ text: userMessage }]);
      if (responseText) {
        // Extract citation sources from text to display them neatly
        const citationRegex = /\[Source:\s*([^\]]+)\]/gi;
        const foundCitations = [];
        let match;
        while ((match = citationRegex.exec(responseText)) !== null) {
          foundCitations.push(match[1].trim());
        }
        
        // Filter unique citations
        const uniqueCitations = [...new Set(foundCitations)];

        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: responseText,
          sources: uniqueCitations
        }]);
      }
    } catch (err) {
      showNotification(`Chat Error: ${err.message}`, 'error');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: `An error occurred while generating a response. Please verify your Gemini API key and network connection.\n\nDetails: ${err.message}`,
        sources: []
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Evaluate Teach-back
  const handleEvaluateTeachBack = async (e) => {
    e.preventDefault();
    if (documents.length === 0) {
      showNotification('Please upload documents first so I can grade your explanation against them.', 'warning');
      return;
    }
    if (!tbConcept.trim() || !tbExplanation.trim()) {
      showNotification('Please fill in both the Concept and your Explanation to run teach-back evaluation.', 'warning');
      return;
    }

    setIsTbLoading(true);
    setTbResult(null);

    const systemPrompt = `You are "Studyo", an expert academic evaluator. The user is performing a "teach-back" exercise to prove they understood a concept from their uploaded documents.
Evaluate their explanation strictly against the documents. Do not judge based on general outside knowledge, only what is verified in the materials.
Analyze details based on target depth: "${depth.toUpperCase()}".

You MUST return your evaluation strictly as a valid JSON object. Do not include markdown code block syntax (like \`\`\`json). Return ONLY raw stringified JSON with the following structure:
{
  "gotRight": "Explain what parts of their explanation they got entirely correct based on the text. Be encouraging but accurate.",
  "missed": "Identify crucial facts, definitions, or nuances mentioned in the documents about this concept that they failed to mention.",
  "slightlyOff": "Point out any subtle inaccuracies, misunderstandings, or misattributions in their explanation.",
  "score": 3, // An integer score from 1 to 5
  "feedback": "A one-sentence ultimate feedback/verdict of their understanding."
}`;

    const userPrompt = `Concept to evaluate: "${tbConcept.trim()}"
User's self-explanation: "${tbExplanation.trim()}"`;

    try {
      const responseText = await makeGeminiRequest(systemPrompt, [{ text: userPrompt }]);
      if (responseText) {
        // Clean markdown blocks if Gemini added them anyway
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.substring(7);
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        }
        cleanJson = cleanJson.trim();

        const parsedResult = JSON.parse(cleanJson);
        setTbResult(parsedResult);
        showNotification('Teach-back evaluation completed!', 'success');
      }
    } catch (err) {
      showNotification(`Teach-back Error: ${err.message}`, 'error');
    } finally {
      setIsTbLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4EF] text-[#1F1E1B] font-sans antialiased flex flex-col selection:bg-[#2F7FD1]/10 selection:text-[#2F7FD1]">
      
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-[#FFFFFF] border border-[#E7E5DE] rounded-xl p-4 shadow-lg flex items-start space-x-3 animate-slide-in">
          <div className="mt-0.5">
            {notification.type === 'success' && (
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#1D9E75]" />
            )}
            {notification.type === 'error' && (
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#993C1D]" />
            )}
            {notification.type === 'warning' && (
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#854F0B]" />
            )}
            {notification.type === 'info' && (
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2F7FD1]" />
            )}
          </div>
          <div className="flex-1 text-sm font-normal leading-tight text-[#1F1E1B]">
            {notification.message}
          </div>
        </div>
      )}

      {/* Premium Header with Impressive Logo & Tagline */}
      <header className="border-b border-[#E7E5DE] bg-[#FFFFFF] px-6 py-4.5 flex items-center justify-between shadow-[0_1px_2px_rgba(31,30,27,0.02)]">
        <div className="flex items-center space-x-4">
          
          {/* Custom Geometric Brandmark Icon */}
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-[#2F7FD1]/8 text-[#2F7FD1] border border-[#2F7FD1]/15 shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Left page */}
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H10v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
              {/* Right page */}
              <path d="M20 19.5v-15A2.5 2.5 0 0 0 17.5 2H14v20h3.5a2.5 2.5 0 0 0 2.5-2.5z" />
              {/* Stars signifying master learning */}
              <path d="M12 6l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2-1.5-1.5 2-.5z" className="fill-[#2F7FD1] stroke-none" />
            </svg>
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#1D9E75] rounded-full ring-2 ring-white animate-pulse" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3.5">
            {/* Typographic Logo */}
            <span className="text-[21px] font-bold tracking-tight text-[#1F1E1B] select-none leading-none">
              Study<span className="text-[#2F7FD1] font-extrabold relative inline-block">o<span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-1 h-1 bg-[#1D9E75] rounded-full"></span></span>
            </span>
            
            {/* Tagline Lockup */}
            <span className="hidden sm:inline-block w-[1px] h-4 bg-[#E7E5DE]" />
            <span className="text-[11px] font-medium tracking-wide text-[#6B6A63] bg-[#F5F4EF]/70 px-2.5 py-1 rounded-full border border-[#E7E5DE]/40 uppercase mt-1 sm:mt-0">
              Upload, understand, and prove you've learned it
            </span>
          </div>
        </div>

        <div className="text-xs text-[#6B6A63] font-medium hidden md:flex items-center space-x-2 bg-[#F5F4EF]/60 px-3 py-1.5 rounded-lg border border-[#E7E5DE]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2F7FD1] animate-ping" />
          <span>Active Depth: <strong className="text-[#1F1E1B] capitalize">{depth}</strong></span>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Docs & API settings (~32%) */}
        <div className="md:col-span-4 flex flex-col space-y-6">
          
          {/* Your Documents Card */}
          <div className="bg-[#FFFFFF] border border-[#E7E5DE] rounded-xl p-5 flex flex-col">
            <h2 className="text-sm font-medium text-[#1F1E1B] mb-3">Your documents</h2>
            
            {/* Drag & Drop Upload Zone */}
            <label className="border border-dashed border-[#E7E5DE] hover:border-[#2F7FD1] transition rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer text-center group bg-[#F5F4EF]/40">
              <input 
                type="file" 
                multiple 
                accept=".txt,.pdf" 
                className="hidden" 
                onChange={handleFileUpload}
              />
              <svg className="w-6 h-6 text-[#6B6A63] group-hover:text-[#2F7FD1] mb-2 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-xs text-[#1F1E1B] font-medium">Drag files here or click to upload</span>
              <span className="text-[11px] text-[#6B6A63] mt-1">PDF or .txt (Under 20MB)</span>
            </label>

            {/* List of uploaded documents */}
            {documents.length > 0 ? (
              <div className="mt-4 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#F5F4EF]/80 px-3 py-2 rounded-lg text-xs border border-[#E7E5DE]/60">
                    <div className="flex items-center space-x-2 truncate">
                      {/* Document icon based on file extension */}
                      {doc.type === 'application/pdf' ? (
                        <svg className="w-4 h-4 text-[#993C1D] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[#2F7FD1] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h6a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="truncate font-medium text-[#1F1E1B]">{doc.name}</span>
                      <span className="text-[10px] text-[#6B6A63]">({doc.size})</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveDoc(idx)} 
                      className="text-[#6B6A63] hover:text-[#993C1D] p-1 rounded transition"
                      title="Remove document"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-center py-4 text-xs text-[#6B6A63] bg-[#F5F4EF]/30 rounded-lg">
                No documents uploaded yet.
              </div>
            )}
          </div>

          {/* Gemini API Key Card */}
          <div className="bg-[#FFFFFF] border border-[#E7E5DE] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2.5">
              <label htmlFor="api-key-input" className="text-sm font-medium text-[#1F1E1B]">
                Gemini API key
              </label>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full transition-all duration-300 ${isKeySaved ? 'bg-[#1D9E75]' : 'bg-[#B4B2A9]'}`} />
                <span className="text-[11px] text-[#6B6A63]">{isKeySaved ? 'Active' : 'Unset'}</span>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-3">
              <div className="relative">
                <input
                  id="api-key-input"
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Paste your key (AIStudio)"
                  className="w-full text-xs px-3 py-2 bg-[#F5F4EF]/60 border border-[#E7E5DE] rounded-lg focus:outline-none focus:border-[#2F7FD1] font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal"
                />
              </div>
              
              <div className="flex items-center justify-between pt-1">
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#2F7FD1] hover:underline"
                >
                  Get a free key →
                </a>
                <button
                  type="submit"
                  className="bg-[#2F7FD1] text-white hover:bg-[#2069b0] text-xs px-4 py-1.5 rounded-lg font-medium transition"
                >
                  Save
                </button>
              </div>
            </form>

            {!isKeySaved && (
              <div className="mt-4 p-2.5 bg-[#FBEFD9]/50 border border-[#FBEFD9] rounded-lg">
                <p className="text-[11px] text-[#854F0B] leading-snug">
                  💡 Fill in your API key to make live document calls. Your key resides entirely in your browser memory and never gets stored or logs on a server.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Interaction Hub (~68%) */}
        <div className="md:col-span-8 flex">
          
          <div className="bg-[#FFFFFF] border border-[#E7E5DE] rounded-xl flex-1 flex flex-col min-h-[580px] overflow-hidden">
            
            {/* Top Toolbar Navigation */}
            <div className="border-b border-[#E7E5DE] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Segmented Toggle: Chat vs Teach-back */}
              <div className="bg-[#F5F4EF] p-1 rounded-lg flex space-x-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${activeTab === 'chat' ? 'bg-[#FFFFFF] text-[#1F1E1B] shadow-sm' : 'text-[#6B6A63] hover:text-[#1F1E1B]'}`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('teach-back')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${activeTab === 'teach-back' ? 'bg-[#FFFFFF] text-[#1F1E1B] shadow-sm' : 'text-[#6B6A63] hover:text-[#1F1E1B]'}`}
                >
                  Teach-back
                </button>
              </div>

              {/* Depth Toggle: Simple vs Expert */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#6B6A63]">Depth:</span>
                <div className="bg-[#F5F4EF] p-1 rounded-lg flex space-x-1">
                  <button
                    onClick={() => setDepth('simple')}
                    className={`px-3 py-1 text-[11px] font-medium rounded-md transition ${depth === 'simple' ? 'bg-[#FFFFFF] text-[#1F1E1B] shadow-sm' : 'text-[#6B6A63] hover:text-[#1F1E1B]'}`}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => setDepth('expert')}
                    className={`px-3 py-1 text-[11px] font-medium rounded-md transition ${depth === 'expert' ? 'bg-[#FFFFFF] text-[#1F1E1B] shadow-sm' : 'text-[#6B6A63] hover:text-[#1F1E1B]'}`}
                  >
                    Expert
                  </button>
                </div>
              </div>

            </div>

            {/* TAB VIEW: CHAT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                
                {/* Scrollable Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-h-[500px]">
                  
                  {documents.length === 0 && (
                    <div className="p-4 bg-[#FBEFD9]/30 border border-[#FBEFD9]/70 rounded-xl mb-4 text-xs text-[#854F0B] leading-relaxed">
                      ⚠️ <strong>No documents loaded:</strong> Please upload some files in the left sidebar first to start chatting and obtaining answers grounded in your custom data!
                    </div>
                  )}

                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' 
                          ? 'bg-[#2F7FD1] text-[#FFFFFF] rounded-br-none' 
                          : 'bg-[#F5F4EF] text-[#1F1E1B] rounded-bl-none border border-[#E7E5DE]'
                      }`}>
                        {msg.text}
                      </div>

                      {/* Cited Sources & Mode tag if available */}
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 ml-1">
                          {msg.sources.map((src, sIdx) => (
                            <span key={sIdx} className="inline-flex items-center text-[10px] bg-[#FFFFFF] border border-[#E7E5DE] text-[#6B6A63] px-2 py-0.5 rounded-full font-medium">
                              📄 {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isChatLoading && (
                    <div className="flex flex-col items-start">
                      <div className="bg-[#F5F4EF] text-[#6B6A63] rounded-xl rounded-bl-none px-4 py-3 text-xs border border-[#E7E5DE] flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 bg-[#6B6A63] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#6B6A63] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#6B6A63] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="ml-1.5 font-medium">Studyo is analyzing your files...</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSendChat} className="p-4 border-t border-[#E7E5DE] bg-[#FFFFFF] flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={documents.length > 0 ? "Ask a question about the documents..." : "Upload documents to unlock chat!"}
                    disabled={documents.length === 0}
                    className="flex-1 text-xs md:text-sm px-4 py-3 bg-[#F5F4EF]/60 border border-[#E7E5DE] rounded-lg focus:outline-none focus:border-[#2F7FD1] disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={documents.length === 0 || isChatLoading}
                    className="bg-[#2F7FD1] text-white hover:bg-[#2069b0] disabled:bg-[#B4B2A9] text-xs md:text-sm px-5 py-3 rounded-lg font-medium transition shrink-0"
                  >
                    Send
                  </button>
                </form>

              </div>
            )}

            {/* TAB VIEW: TEACH-BACK */}
            {activeTab === 'teach-back' && (
              <div className="flex-1 p-5 md:p-6 overflow-y-auto space-y-6">
                
                {documents.length === 0 && (
                  <div className="p-4 bg-[#FBEFD9]/30 border border-[#FBEFD9]/70 rounded-xl text-xs text-[#854F0B] leading-relaxed">
                    ⚠️ <strong>Document required:</strong> Please upload a text or PDF file so Studyo can objectively cross-examine your understanding.
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1F1E1B] mb-1">Concept</label>
                    <input
                      type="text"
                      value={tbConcept}
                      onChange={(e) => setTbConcept(e.target.value)}
                      placeholder="e.g., Photosynthesis light reactions, Redux state cycles..."
                      className="w-full text-xs px-3 py-2 bg-[#F5F4EF]/60 border border-[#E7E5DE] rounded-lg focus:outline-none focus:border-[#2F7FD1]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1F1E1B] mb-1">Explain it in your own words</label>
                    <textarea
                      rows={5}
                      value={tbExplanation}
                      onChange={(e) => setTbExplanation(e.target.value)}
                      placeholder="Write your personal understanding of how this concept operates as detailed in the uploaded texts..."
                      className="w-full text-xs p-3 bg-[#F5F4EF]/60 border border-[#E7E5DE] rounded-lg focus:outline-none focus:border-[#2F7FD1] resize-none font-sans leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleEvaluateTeachBack}
                    disabled={isTbLoading || documents.length === 0}
                    className="w-full bg-[#2F7FD1] text-[#FFFFFF] hover:bg-[#2069b0] disabled:bg-[#B4B2A9] py-3 rounded-lg text-xs font-medium transition flex items-center justify-center space-x-2"
                  >
                    {isTbLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Analyzing with Studyo Core...</span>
                      </>
                    ) : (
                      <span>Evaluate my understanding</span>
                    )}
                  </button>
                </div>

                {/* TEACH-BACK RESULT CARDS */}
                {tbResult && (
                  <div className="space-y-4 pt-4 border-t border-[#E7E5DE] animate-fade-in">
                    
                    <h3 className="text-sm font-medium text-[#1F1E1B]">Evaluation Results</h3>

                    {/* What you got right */}
                    <div className="bg-[#E5F4EE] border border-[#1D9E75]/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-[#0F6E56] mb-1">What you got right</h4>
                      <p className="text-xs text-[#0F6E56] leading-relaxed">{tbResult.gotRight || 'No direct matches found.'}</p>
                    </div>

                    {/* What you missed */}
                    <div className="bg-[#FBEFD9] border border-[#854F0B]/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-[#854F0B] mb-1">What you missed</h4>
                      <p className="text-xs text-[#854F0B] leading-relaxed">{tbResult.missed || 'No details were noticeably missing.'}</p>
                    </div>

                    {/* What's slightly off */}
                    <div className="bg-[#FAEbE4] border border-[#993C1D]/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-[#993C1D] mb-1">What's slightly off</h4>
                      <p className="text-xs text-[#993C1D] leading-relaxed">{tbResult.slightlyOff || 'Nothing was mischaracterized!'}</p>
                    </div>

                    {/* Score badge */}
                    <div className="bg-[#F1EFE8] border border-[#E7E5DE] rounded-xl p-4 flex items-center space-x-4">
                      <div className="bg-[#FFFFFF] border border-[#E7E5DE] rounded-lg py-3 px-5 text-center shadow-xs shrink-0">
                        <span className="block text-2xl font-bold text-[#1F1E1B]">{tbResult.score || '0'} / 5</span>
                        <span className="text-[10px] text-[#6B6A63] font-medium tracking-wide">Mastery Score</span>
                      </div>
                      <div className="text-xs text-[#6B6A63] leading-relaxed">
                        <p className="font-semibold text-[#1F1E1B] mb-0.5">Feedback Verdict</p>
                        {tbResult.feedback || 'Review documents to fill knowledge gaps.'}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </main>

      {/* Footer info banner */}
      <footer className="py-4 text-center text-[11px] text-[#6B6A63]">
        Studyo operates purely locally. Your keys and files are handled in-memory and are never permanently persisted on any database.
      </footer>
    </div>
  );
}