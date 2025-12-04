export enum AppView {
  HOME = 'HOME',
  RESULT = 'RESULT',
  NOTEBOOK = 'NOTEBOOK',
  STORY = 'STORY',
  FLASHCARDS = 'FLASHCARDS'
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface ExampleSentence {
  original: string;
  translated: string;
}

export interface AdvancedWord {
  word: string;
  translation: string;
  etymology: string;
}

export interface GrammarBlock {
  label: string; // e.g., "Subject", "Verb", "Object", "Modifier"
  text: string;  // The specific part of the sentence
  explanation: string; // Explanation in native language
  color?: string; // Optional UI hint
}

export interface AnalysisResult {
  isSentence: boolean;
  originalText: string;
  translation: string;
  definition: string; // Native language explanation
  etymology?: string;
  
  // Word specific
  casualExplanation?: string; // The "friend-like" chatty explanation
  synonyms?: string[];
  
  // Sentence specific
  grammarStructure?: GrammarBlock[]; // Changed from simple string to structured blocks
  advancedWords?: AdvancedWord[];
  
  examples: ExampleSentence[];
  imagePrompt?: string; // Used internally to generate the image
}

export interface DictionaryEntry extends AnalysisResult {
  id: string;
  timestamp: number;
  imageUrl?: string;
  nativeLang: string;
  targetLang: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface Story {
  title: string;
  content: string; // Target language story
  translation: string; // Native language translation
  createdAt: number;
}