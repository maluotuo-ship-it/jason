import React, { useState, useEffect } from 'react';
import { DictionaryEntry } from '../types';
import { Volume2, RefreshCw, Square } from 'lucide-react';
import { playTTS, prefetchTTS, stopAudio } from '../services/geminiService';
import ClickableText from './ClickableText';

interface FlashcardProps {
  entry: DictionaryEntry;
  onNext: () => void;
  onDeepDive?: (text: string) => void;
}

const Flashcard: React.FC<FlashcardProps> = ({ entry, onNext, onDeepDive }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Prefetch audio when entry changes
  useEffect(() => {
    prefetchTTS(entry.originalText);
    return () => stopAudio();
  }, [entry]);

  const handleFlip = () => setIsFlipped(!isFlipped);
  
  const handleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playTTS(entry.originalText, () => setIsPlaying(false));
    }
  };

  const handleWordClick = (word: string) => {
    if (onDeepDive) onDeepDive(word);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-[500px] max-w-sm mx-auto perspective-1000">
      <div 
        className={`relative w-full h-full cursor-pointer transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        onClick={handleFlip}
      >
        {/* Front */}
        <div className="absolute w-full h-full bg-white rounded-3xl shadow-xl flex flex-col items-center justify-between p-6 backface-hidden" style={{ backfaceVisibility: 'hidden' }}>
          <div className="w-full text-right text-sm text-gray-400 font-medium">Click to flip</div>
          
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {entry.imageUrl && (
              <img 
                src={entry.imageUrl} 
                alt={entry.originalText} 
                className="w-48 h-48 object-cover rounded-2xl shadow-md"
              />
            )}
            <h2 className="text-4xl font-bold text-brand-dark text-center font-display leading-tight">
               {/* Clickable text on flashcard front needs z-index handling or stopProp within component */}
               <ClickableText 
                 text={entry.originalText} 
                 lang={entry.targetLang} 
                 onWordClick={handleWordClick}
               />
            </h2>
            <button 
              onClick={handleAudio}
              className="p-3 bg-brand-blue/10 text-brand-blue rounded-full hover:bg-brand-blue/20 transition-colors"
            >
              {isPlaying ? <Square fill="currentColor" size={28} /> : <Volume2 size={28} />}
            </button>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-yellow w-1/2"></div>
          </div>
        </div>

        {/* Back */}
        <div 
          className="absolute w-full h-full bg-brand-dark text-white rounded-3xl shadow-xl flex flex-col p-8 backface-hidden rotate-y-180"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex-1 flex flex-col justify-center text-center">
            <h3 className="text-2xl font-bold text-brand-yellow mb-2">{entry.translation}</h3>
            <p className="text-gray-300 text-lg mb-6">{entry.definition}</p>
            
            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
              <p className="text-brand-pink text-sm font-bold mb-1">Example</p>
              <p className="text-white italic text-lg leading-snug">
                "<ClickableText 
                   text={entry.examples[0]?.original || ''} 
                   lang={entry.targetLang} 
                   onWordClick={handleWordClick}
                   className="hover:text-white"
                />"
              </p>
              <p className="text-gray-400 text-sm mt-1">{entry.examples[0]?.translated}</p>
            </div>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onNext(); setIsFlipped(false); }}
            className="mt-6 w-full py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            Next Card
          </button>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
