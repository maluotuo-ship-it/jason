import React, { useState, useEffect } from 'react';
import { AnalysisResult, ChatMessage, DictionaryEntry, AdvancedWord } from '../types';
import { Volume2, Square, MessageCircle, Save, Check, Send, BookOpen, ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react';
import { playTTS, prefetchTTS, sendChatMessage, stopAudio } from '../services/geminiService';
import ClickableText from './ClickableText';

interface ResultViewProps {
  result: DictionaryEntry;
  onSave: (entry: AnalysisResult) => void;
  isSaved: boolean;
  onBack?: () => void;
  showBack?: boolean;
  onDeepDive?: (text: string) => void;
}

const ResultView: React.FC<ResultViewProps> = ({ 
  result, 
  onSave, 
  isSaved, 
  onBack, 
  showBack,
  onDeepDive 
}) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Track which text is currently playing to show stop icon
  const [playingText, setPlayingText] = useState<string | null>(null);

  // Prefetch audio when result loads
  useEffect(() => {
    prefetchTTS(result.originalText);
    result.examples.forEach(ex => prefetchTTS(ex.original));
    
    // Cleanup audio when component unmounts or result changes
    return () => stopAudio();
  }, [result]);

  const handleTTS = (text: string) => {
    if (playingText === text) {
      stopAudio();
      setPlayingText(null);
    } else {
      setPlayingText(text);
      playTTS(text, () => {
        setPlayingText(null);
      });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const responseText = await sendChatMessage(history, userMsg.text, result.originalText);
      
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleWordClick = (word: string) => {
    if (onDeepDive) onDeepDive(word);
  };

  return (
    <div className="flex flex-col h-full animate-flip-in pb-20 relative bg-[#F7F9FC]">
      
      {/* Header Image Section */}
      <div className="relative w-full h-64 bg-gray-200 group flex-shrink-0">
        {result.imageUrl ? (
          <img src={result.imageUrl} alt="Concept" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100 gap-2">
            <Loader2 className="animate-spin text-brand-blue" size={32} />
            <span className="text-sm font-medium">Painting the concept...</span>
          </div>
        )}
        
        {/* Back Button */}
        {showBack && (
          <button 
            onClick={() => { stopAudio(); onBack && onBack(); }}
            className="absolute top-4 left-4 p-2 pl-3 pr-4 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-black/60 transition z-20 flex items-center gap-1 shadow-lg border border-white/10"
          >
            <ArrowLeft size={20} strokeWidth={3} />
            <span className="font-bold text-sm">Back</span>
          </button>
        )}
      </div>

      {/* Overlapping Content Container */}
      <div className="relative px-6 -mt-10 z-10 flex-1">
        
        {/* Title/Header Card */}
        <div className="bg-white p-5 rounded-2xl shadow-lg flex items-center justify-between mb-8 transition-all">
          <div className="flex-1 mr-4 min-w-0">
            <div className={`${result.originalText.length > 20 ? 'text-xl' : 'text-2xl'} font-bold text-brand-dark font-display leading-tight break-words`}>
              <ClickableText 
                text={result.originalText} 
                lang={result.targetLang} 
                onWordClick={handleWordClick} 
              />
            </div>
            <p className="text-gray-500 mt-1 break-words">{result.translation}</p>
          </div>
          <button onClick={() => handleTTS(result.originalText)} className="p-3 bg-brand-yellow rounded-full text-brand-dark hover:bg-yellow-400 transition shadow-sm flex-shrink-0">
            {playingText === result.originalText ? <Square fill="currentColor" size={24} /> : <Volume2 size={24} />}
          </button>
        </div>

        <div className="space-y-6">
          {/* Definition Section */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Definition</h3>
            <p className="text-brand-dark leading-relaxed text-lg">{result.definition}</p>

            {/* Etymology Block */}
            {result.etymology && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex gap-3">
                 <div className="text-yellow-500 pt-1 flex-shrink-0">
                   <BookOpen size={18} />
                 </div>
                 <div>
                    <span className="text-xs font-bold text-yellow-600 uppercase block mb-1">Origin & Etymology</span>
                    <p className="text-brand-dark/80 text-sm italic leading-relaxed">{result.etymology}</p>
                 </div>
              </div>
            )}
          </section>

          {/* Casual / Grammar Section */}
          <section>
            {result.isSentence ? (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="bg-brand-light p-3 border-b border-gray-100">
                   <h3 className="text-brand-blue font-bold flex items-center gap-2">
                     Structure Map
                   </h3>
                </div>
                {/* Visual Grammar Stream - Horizontal Scroll */}
                <div className="p-4 overflow-x-auto no-scrollbar">
                  <div className="flex gap-4 min-w-max">
                    {result.grammarStructure && result.grammarStructure.length > 0 ? (
                      result.grammarStructure.map((block, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-40 bg-gray-50 rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                          <div className={`
                            self-start px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider
                            ${['subject', 'topic'].some(k => block.label.toLowerCase().includes(k)) ? 'bg-brand-blue' : 
                              ['verb', 'action', 'predicate'].some(k => block.label.toLowerCase().includes(k)) ? 'bg-brand-pink' : 
                              ['object'].some(k => block.label.toLowerCase().includes(k)) ? 'bg-brand-green' : 'bg-gray-400'}
                          `}>
                            {block.label}
                          </div>
                          <p className="font-bold text-brand-dark text-lg leading-tight break-words">
                            <ClickableText 
                              text={block.text} 
                              lang={result.targetLang} 
                              onWordClick={handleWordClick} 
                            />
                          </p>
                          <p className="text-xs text-gray-500 leading-snug">{block.explanation}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">Parsing structure...</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-brand-light p-5 rounded-xl border border-blue-100 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                   <MessageCircle size={64} className="text-brand-blue" />
                 </div>
                <h3 className="text-brand-pink font-bold mb-2 flex items-center gap-2">
                   Quick Chat
                </h3>
                <p className="text-gray-700 text-sm italic relative z-10">"{result.casualExplanation}"</p>
              </div>
            )}
          </section>

          {/* Examples */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Examples</h3>
            <div className="space-y-3">
              {result.examples.map((ex, idx) => (
                <div key={idx} className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <p className="text-brand-dark font-medium text-lg leading-snug break-words pr-2">
                      <ClickableText 
                        text={ex.original} 
                        lang={result.targetLang} 
                        onWordClick={handleWordClick} 
                      />
                    </p>
                    <button onClick={() => handleTTS(ex.original)} className="text-brand-blue opacity-50 hover:opacity-100 p-2 -mr-2 flex-shrink-0">
                       {playingText === ex.original ? <Square fill="currentColor" size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">{ex.translated}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Advanced Words (If Sentence) - Horizontal Scroll */}
          {result.isSentence && result.advancedWords && result.advancedWords.length > 0 && (
            <section>
               <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Key Vocabulary</h3>
               <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                 {result.advancedWords.map((word, i) => (
                   <button 
                     key={i} 
                     onClick={() => onDeepDive && onDeepDive(word.word)}
                     className="flex-shrink-0 w-40 bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-brand-blue/50 hover:shadow-md transition active:scale-95 group flex flex-col"
                   >
                     <div className="flex justify-between items-start mb-2 w-full">
                        <p className="font-bold text-brand-dark group-hover:text-brand-blue text-lg break-words leading-tight line-clamp-2">{word.word}</p>
                        <ImageIcon size={14} className="text-gray-300 group-hover:text-brand-blue flex-shrink-0 ml-1 mt-1" />
                     </div>
                     <div className="mt-auto">
                        <p className="text-xs text-gray-500 font-medium line-clamp-2">{word.translation}</p>
                        {word.etymology && <p className="text-[10px] text-gray-400 mt-1 italic line-clamp-1">{word.etymology}</p>}
                     </div>
                   </button>
                 ))}
               </div>
            </section>
          )}
        </div>
        
        <div className="h-10"></div> {/* Spacer */}
      </div>

      {/* Floating Actions */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur border-t p-4 flex gap-3 max-w-md mx-auto right-0 z-30">
        <button 
          onClick={() => setChatOpen(true)}
          className="flex-1 bg-brand-light text-brand-dark font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-gray-200"
        >
          <MessageCircle size={20} />
          Ask AI
        </button>
        <button 
          onClick={() => onSave(result)}
          disabled={isSaved}
          className={`flex-1 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
            isSaved ? 'bg-green-100 text-green-600' : 'bg-brand-dark text-white'
          }`}
        >
          {isSaved ? <><Check size={20} /> Saved</> : <><Save size={20} /> Save</>}
        </button>
      </div>

      {/* Chat Overlay */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end">
          <div className="bg-white w-full h-[80vh] rounded-t-3xl flex flex-col animate-slide-up shadow-2xl max-w-md mx-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Chat about "{result.originalText}"</h3>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-10">
                  <p>Ask anything! Nuance, pronunciation, usage?</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' ? 'bg-brand-blue text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                 <div className="flex justify-start">
                   <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-none flex gap-1">
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                   </div>
                 </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask a question..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-brand-blue text-white p-3 rounded-full disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultView;