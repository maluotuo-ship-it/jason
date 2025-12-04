import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Search, Book, Brain, ArrowRight, Sparkles, Languages, ChevronDown, RotateCw, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES, PLACEHOLDER_IMAGE } from './constants';
import { DictionaryEntry, Language, AppView, AnalysisResult, Story } from './types';
import { analyzeText, generateImage, generateStoryFromWords, prefetchTTS } from './services/geminiService';
import ResultView from './components/ResultView';
import Flashcard from './components/Flashcard';
import ClickableText from './components/ClickableText';

interface NavState {
  view: AppView;
  scrollPosition: number;
}

const App: React.FC = () => {
  // State: Preferences
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Default En
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default Zh
  
  // State: Core
  const [view, setView] = useState<AppView>(AppView.HOME);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Navigation Stack for Nested Results (Deep Dives)
  const [resultStack, setResultStack] = useState<DictionaryEntry[]>([]);
  const currentResult = resultStack.length > 0 ? resultStack[resultStack.length - 1] : null;

  // View History for Cross-View Navigation (e.g. Story -> Result -> Story)
  const [navHistory, setNavHistory] = useState<NavState[]>([]);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const [notebook, setNotebook] = useState<DictionaryEntry[]>([]);
  
  // State: Features
  const [generatedStory, setGeneratedStory] = useState<Story | null>(null);
  const [isStoryLoading, setIsStoryLoading] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('lingopop_notebook');
    if (saved) setNotebook(JSON.parse(saved));
    const savedNative = localStorage.getItem('lingopop_native');
    if (savedNative) setNativeLang(JSON.parse(savedNative));
    const savedTarget = localStorage.getItem('lingopop_target');
    if (savedTarget) setTargetLang(JSON.parse(savedTarget));
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('lingopop_notebook', JSON.stringify(notebook));
  }, [notebook]);

  // Helper to process search (used for main search and deep dives)
  const performSearch = async (text: string) => {
    setIsLoading(true);
    try {
      // 0. Immediate Audio Prefetch (Zero Latency)
      // We start fetching audio before we even know the definition
      prefetchTTS(text);

      // 1. Text Analysis (Fast)
      const analysis = await analyzeText(text, nativeLang.name, targetLang.name);
      
      // Prefetch examples audio once we have them
      analysis.examples.forEach(ex => prefetchTTS(ex.original));

      // Create Entry (initially without image)
      const entryId = Date.now().toString();
      const newEntry: DictionaryEntry = {
        ...analysis,
        id: entryId,
        timestamp: Date.now(),
        imageUrl: undefined, // Loading state for image
        nativeLang: nativeLang.code,
        targetLang: targetLang.code
      };

      // 2. Render Text Results IMMEDIATELY
      setResultStack(prev => [...prev, newEntry]);
      setView(AppView.RESULT);
      setIsLoading(false); // Stop main loader

      // 3. Generate Image in Background
      const imagePrompt = analysis.imagePrompt || `A simple, colorful vector illustration of ${analysis.originalText}`;
      
      generateImage(imagePrompt).then(url => {
        setResultStack(currentStack => {
          return currentStack.map(item => {
            if (item.id === entryId) {
              return { ...item, imageUrl: url || PLACEHOLDER_IMAGE };
            }
            return item;
          });
        });
      });

    } catch (error) {
      alert("Oops! Something went wrong. Please try again.");
      console.error(error);
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!inputText.trim()) return;
    
    // Immediate prefetch for the search input
    prefetchTTS(inputText);

    setResultStack([]); // Clear stack on new main search
    setNavHistory([]); // Clear history on new main search
    await performSearch(inputText);
  };

  const handleDeepDive = async (word: string) => {
    // Immediate prefetch for the clicked word
    prefetchTTS(word);

    // If we are currently NOT in Result View, save state
    if (view !== AppView.RESULT) {
      const scrollPos = mainScrollRef.current?.scrollTop || 0;
      setNavHistory(prev => [...prev, { view, scrollPosition: scrollPos }]);
      setResultStack([]); // Start fresh stack for this diversion
    }
    
    await performSearch(word);
  };

  const handleBack = () => {
    if (resultStack.length > 1) {
      // Pop from result stack (simple nested word navigation)
      setResultStack(prev => prev.slice(0, -1));
    } else {
      // We are at the root of the result stack
      if (navHistory.length > 0) {
        // Go back to previous view (Story, Notebook, Flashcards)
        const lastState = navHistory[navHistory.length - 1];
        setNavHistory(prev => prev.slice(0, -1));
        setView(lastState.view);
        setResultStack([]);
        
        // Restore scroll position after render
        setTimeout(() => {
          if (mainScrollRef.current) {
            mainScrollRef.current.scrollTo({ top: lastState.scrollPosition, behavior: 'auto' });
          }
        }, 0);
      } else {
        // Fallback to home
        setView(AppView.HOME);
        setResultStack([]);
      }
    }
  };

  const saveToNotebook = (entry: AnalysisResult) => {
    if (!currentResult) return;
    if (!notebook.find(n => n.originalText === entry.originalText)) {
      setNotebook([currentResult, ...notebook]);
    }
  };

  const handleGenerateStory = async () => {
    if (notebook.length < 3) return;
    setIsStoryLoading(true);
    try {
      const words = notebook.slice(0, 10).map(n => n.originalText);
      const story = await generateStoryFromWords(words, targetLang.name, nativeLang.name);
      setGeneratedStory(story);
    } catch (e) {
      console.error(e);
    } finally {
      setIsStoryLoading(false);
    }
  };

  // --- Views ---

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-brand-dark mb-2 tracking-tight">LingoPop<span className="text-brand-yellow">.</span></h1>
        <p className="text-gray-400">Pop into a new language.</p>
      </div>

      <div className="w-full bg-white p-6 rounded-3xl shadow-xl shadow-brand-blue/10">
        {/* Language Selector */}
        <div className="flex items-center justify-between mb-6 bg-gray-50 p-2 rounded-2xl">
          <div className="flex-1 text-center border-r border-gray-200">
             <label className="text-xs text-gray-400 font-bold uppercase block mb-1">I speak</label>
             <div className="relative">
                <select 
                  className="appearance-none bg-transparent font-bold text-brand-dark w-full text-center focus:outline-none"
                  value={nativeLang.code}
                  onChange={(e) => {
                     const l = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                     if(l) { setNativeLang(l); localStorage.setItem('lingopop_native', JSON.stringify(l)); }
                  }}
                >
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
             </div>
          </div>
          <div className="p-2 text-gray-300">
            <ArrowRight size={20} />
          </div>
          <div className="flex-1 text-center">
             <label className="text-xs text-gray-400 font-bold uppercase block mb-1">I'm learning</label>
             <div className="relative">
                <select 
                  className="appearance-none bg-transparent font-bold text-brand-blue w-full text-center focus:outline-none"
                  value={targetLang.code}
                  onChange={(e) => {
                     const l = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                     if(l) { setTargetLang(l); localStorage.setItem('lingopop_target', JSON.stringify(l)); }
                  }}
                >
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
             </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
            }}
            placeholder={`Type a word or sentence in ${targetLang.name}...`}
            className="w-full bg-gray-50 rounded-2xl p-4 pr-12 pb-16 text-lg font-medium text-brand-dark placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-yellow resize-none h-48"
          />
          
          {/* Clear Button */}
          {inputText && (
            <button
              onClick={() => setInputText('')}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              title="Clear text"
            >
              <X size={20} />
            </button>
          )}

          <button
            onClick={handleSearch}
            disabled={isLoading || !inputText}
            className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 ${
              isLoading ? 'bg-gray-300' : 'bg-brand-dark text-white'
            }`}
          >
            {isLoading ? <RotateCw className="animate-spin" size={24} /> : <Search size={24} />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotebook = () => (
    <div className="px-4 py-8 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display text-brand-dark">My Notebook</h2>
        <span className="bg-brand-yellow/20 text-brand-dark px-3 py-1 rounded-full text-sm font-bold">{notebook.length} items</span>
      </div>

      {/* Story Mode Generator */}
      {notebook.length >= 3 && (
        <div className="mb-8">
          <button 
            onClick={() => setView(AppView.STORY)}
            className="w-full bg-gradient-to-r from-brand-pink to-orange-400 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Sparkles size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">Magic Story Mode</p>
                <p className="text-white/80 text-xs">Create a story from your words</p>
              </div>
            </div>
            <ArrowRight size={20} />
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {notebook.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <Book size={48} className="mx-auto mb-4 opacity-20" />
            <p>Your notebook is empty.</p>
            <button onClick={() => setView(AppView.HOME)} className="text-brand-blue font-bold mt-2">Go search something!</button>
          </div>
        ) : (
          notebook.map((entry) => (
            <div 
              key={entry.id} 
              onClick={() => { 
                setResultStack([entry]);
                // Save current state as we are leaving Notebook view
                setNavHistory(prev => [...prev, { view: AppView.NOTEBOOK, scrollPosition: mainScrollRef.current?.scrollTop || 0 }]);
                setView(AppView.RESULT); 
              }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-center hover:shadow-md transition cursor-pointer"
            >
              <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                <img src={entry.imageUrl || PLACEHOLDER_IMAGE} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-brand-dark truncate">{entry.originalText}</h3>
                <p className="text-gray-500 text-sm truncate">{entry.translation}</p>
              </div>
              <ChevronDown className="text-gray-300 -rotate-90" size={20} />
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderStory = () => (
    <div className="px-4 py-8 pb-24 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <button 
           onClick={() => {
             // Basic back for story view if accessed directly, though usually via tab
             setView(AppView.NOTEBOOK); 
           }}
           className="p-2 rounded-full bg-white shadow-sm text-gray-500"
        >
          <ArrowRight className="rotate-180" size={20} />
        </button>
        <h2 className="text-2xl font-bold font-display text-brand-dark">AI Storyteller</h2>
      </div>
      
      {!generatedStory && !isStoryLoading && (
        <div className="text-center mt-10">
          <p className="text-gray-500 mb-6">Combine your notebook words into a unique story to help you memorize context!</p>
          <button 
            onClick={handleGenerateStory}
            className="bg-brand-dark text-white px-8 py-4 rounded-full font-bold shadow-xl hover:scale-105 transition"
          >
            Generate Story
          </button>
        </div>
      )}

      {isStoryLoading && (
         <div className="flex-1 flex flex-col items-center justify-center">
            <Sparkles className="animate-bounce-slow text-brand-yellow mb-4" size={48} />
            <p className="text-brand-dark font-medium animate-pulse">Weaving your words into magic...</p>
         </div>
      )}

      {generatedStory && (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 animate-flip-in overflow-y-auto">
          <h3 className="text-xl font-bold text-brand-pink mb-4">{generatedStory.title}</h3>
          <div className="text-lg leading-relaxed text-brand-dark mb-6">
            <ClickableText 
              text={generatedStory.content} 
              lang={targetLang.code} 
              onWordClick={handleDeepDive} 
            />
          </div>
          <div className="border-t pt-4">
             <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Translation</h4>
             <p className="text-gray-500 text-sm">{generatedStory.translation}</p>
          </div>
          <button 
             onClick={() => setGeneratedStory(null)} 
             className="mt-8 w-full py-3 text-brand-blue font-bold hover:bg-blue-50 rounded-xl"
          >
            Create Another
          </button>
        </div>
      )}
    </div>
  );

  const renderFlashcards = () => {
    if (notebook.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center">
          <Brain size={64} className="text-brand-green/30 mb-6" />
          <h2 className="text-2xl font-bold text-brand-dark mb-2">Study Mode</h2>
          <p className="text-gray-400 mb-6">Add words to your notebook to unlock flashcards.</p>
          <button onClick={() => setView(AppView.HOME)} className="bg-brand-green text-white px-6 py-3 rounded-xl font-bold">Start Searching</button>
        </div>
      );
    }
    
    const entry = notebook[flashcardIndex % notebook.length];

    return (
      <div className="flex flex-col h-full py-8 pb-24">
        <div className="px-6 mb-4">
          <h2 className="text-2xl font-bold font-display text-brand-dark">Flashcards</h2>
          <p className="text-gray-400 text-sm">Card {flashcardIndex + 1} of {notebook.length}</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
           <Flashcard 
             entry={entry} 
             onNext={() => setFlashcardIndex((prev) => (prev + 1) % notebook.length)}
             onDeepDive={handleDeepDive}
           />
        </div>
      </div>
    );
  };

  // --- Main Layout ---
  return (
    <div className="w-full min-h-screen bg-brand-light font-sans text-brand-dark flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Main Content Area */}
        <div 
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto no-scrollbar bg-[#F7F9FC]"
        >
          {view === AppView.HOME && renderHome()}
          {view === AppView.RESULT && currentResult && (
            <ResultView 
              result={currentResult} 
              onSave={saveToNotebook} 
              isSaved={!!notebook.find(n => n.originalText === currentResult.originalText)}
              onBack={handleBack}
              showBack={resultStack.length > 1 || navHistory.length > 0}
              onDeepDive={handleDeepDive}
            />
          )}
          {view === AppView.NOTEBOOK && renderNotebook()}
          {view === AppView.STORY && renderStory()}
          {view === AppView.FLASHCARDS && renderFlashcards()}
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-100 py-3 px-6 flex justify-between items-center pb-8 z-40 sticky bottom-0">
          <button 
            onClick={() => { setView(AppView.HOME); setResultStack([]); setNavHistory([]); }}
            className={`flex flex-col items-center gap-1 ${view === AppView.HOME || view === AppView.RESULT ? 'text-brand-dark' : 'text-gray-300'}`}
          >
            <Search size={24} strokeWidth={3} />
            <span className="text-[10px] font-bold">Search</span>
          </button>

          <button 
            onClick={() => { setView(AppView.NOTEBOOK); setNavHistory([]); }}
            className={`flex flex-col items-center gap-1 ${view === AppView.NOTEBOOK || view === AppView.STORY ? 'text-brand-pink' : 'text-gray-300'}`}
          >
            <Book size={24} strokeWidth={3} />
            <span className="text-[10px] font-bold">Notebook</span>
          </button>

          <button 
             onClick={() => { setView(AppView.FLASHCARDS); setNavHistory([]); }}
             className={`flex flex-col items-center gap-1 ${view === AppView.FLASHCARDS ? 'text-brand-green' : 'text-gray-300'}`}
          >
            <Brain size={24} strokeWidth={3} />
            <span className="text-[10px] font-bold">Study</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default App;