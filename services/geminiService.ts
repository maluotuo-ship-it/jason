import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { AnalysisResult, Story } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

// --- Initialization ---
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key is missing. Please ensure process.env.API_KEY is set.");
    throw new Error("An API Key must be set in process.env.API_KEY to use LingoPop.");
  }
  return new GoogleGenAI({ apiKey });
};

// Global Audio Context & Cache
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null; // Track current playing source
const audioCache = new Map<string, Uint8Array>();
const pendingRequests = new Map<string, Promise<void>>();

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

// --- Text Analysis ---
export const analyzeText = async (
  text: string,
  nativeLang: string,
  targetLang: string
): Promise<AnalysisResult> => {
  const ai = getAI();
  
  const prompt = `
    Analyze the following text: "${text}".
    Source/Target Language: The text is likely in ${targetLang} (or user wants to learn it). The user's native language is ${nativeLang}.
    
    If the text is in ${nativeLang}, treat it as a lookup for the equivalent in ${targetLang}.
    
    Return the result in JSON.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      isSentence: { type: Type.BOOLEAN },
      originalText: { type: Type.STRING },
      translation: { type: Type.STRING },
      definition: { type: Type.STRING, description: `Explanation in ${nativeLang}` },
      etymology: { type: Type.STRING, description: `Brief origin/etymology explained in ${nativeLang}` },
      casualExplanation: { type: Type.STRING, description: `Fun, chatty explanation for words/phrases in ${nativeLang}` },
      synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
      
      // Structure the grammar analysis
      grammarStructure: { 
        type: Type.ARRAY, 
        description: `Breakdown of sentence structure (Subject, Verb, Object, etc.) in ${nativeLang}`,
        items: {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING, description: "Grammar role (e.g. Subject, Verb)" },
                text: { type: Type.STRING, description: "The specific text segment" },
                explanation: { type: Type.STRING, description: "Brief explanation of function" }
            }
        }
      },
      
      advancedWords: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            translation: { type: Type.STRING },
            etymology: { type: Type.STRING, description: `Etymology in ${nativeLang}` },
          }
        }
      },
      examples: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING },
            translated: { type: Type.STRING },
          }
        }
      },
      imagePrompt: { type: Type.STRING, description: "A creative prompt to visualize this concept, in English." }
    },
    required: ["isSentence", "originalText", "translation", "definition", "examples", "imagePrompt"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const textResponse = response.text;
  if (!textResponse) throw new Error("No response from AI");
  
  return JSON.parse(textResponse) as AnalysisResult;
};

// --- Image Generation ---
export const generateImage = async (imagePrompt: string): Promise<string> => {
  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: imagePrompt,
      config: {
        // Nano banana models do not support responseMimeType or specific imageConfig schemas like Imagen
      }
    });

    // Check parts for inline data
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return ''; 
  } catch (e) {
    console.error("Image generation failed", e);
    return ''; // Return empty string on failure
  }
};

// --- Text to Speech ---
// Helper to decode base64
const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to convert raw PCM to AudioBuffer
const pcmToAudioBuffer = (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number
): AudioBuffer => {
  // Convert Uint8Array to Int16Array (16-bit PCM)
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length;
  // Create buffer: 1 channel (mono)
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < frameCount; i++) {
    // Normalize 16-bit integer to float [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
};

// Fetch audio data without playing (for caching)
export const prefetchTTS = async (text: string, voiceName: 'Kore' | 'Puck' | 'Charon' = 'Kore') => {
  if (audioCache.has(text)) return Promise.resolve();
  
  // Return existing promise if already fetching
  if (pendingRequests.has(text)) {
    return pendingRequests.get(text);
  }

  const fetchPromise = (async () => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const pcmBytes = decodeBase64(base64Audio);
        audioCache.set(text, pcmBytes);
      }
    } catch (error) {
      console.error("TTS Prefetch Error:", error);
    } finally {
      pendingRequests.delete(text);
    }
  })();

  pendingRequests.set(text, fetchPromise);
  return fetchPromise;
};

// Stop currently playing audio
export const stopAudio = () => {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (e) {
      // Ignore errors if already stopped
    }
    currentSource = null;
  }
};

export const playTTS = async (
  text: string, 
  onEnded?: () => void,
  voiceName: 'Kore' | 'Puck' | 'Charon' = 'Kore'
) => {
  const ctx = getAudioContext();
  
  // Stop any existing audio immediately
  stopAudio();

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  let pcmBytes = audioCache.get(text);

  if (!pcmBytes) {
    // Check if there is a pending request
    if (pendingRequests.has(text)) {
      await pendingRequests.get(text);
      pcmBytes = audioCache.get(text);
    } else {
      // Fetch immediately if not pending and not in cache
      await prefetchTTS(text, voiceName);
      pcmBytes = audioCache.get(text);
    }
  }

  if (pcmBytes) {
    const audioBuffer = pcmToAudioBuffer(pcmBytes, ctx, 24000);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    // Assign to global currentSource to allow stopping
    currentSource = source;

    source.onended = () => {
      if (currentSource === source) {
        currentSource = null;
      }
      if (onEnded) onEnded();
    };

    source.start(0);
  } else {
    // If failed to load, callback immediately
    if (onEnded) onEnded();
  }
};

// --- Chat ---
export const sendChatMessage = async (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  context: string
) => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: [
      {
        role: 'user',
        parts: [{ text: `Context: We are discussing the word/phrase: "${context}". Keep answers concise and helpful.` }],
      },
      {
        role: 'model',
        parts: [{ text: "Understood. I will help you with questions about this specific term." }],
      },
      ...history
    ],
  });

  const result = await chat.sendMessage({ message: newMessage });
  return result.text;
};

// --- Story Generation ---
export const generateStoryFromWords = async (
  words: string[],
  targetLang: string,
  nativeLang: string
): Promise<Story> => {
  const ai = getAI();
  const prompt = `
    Create a short, funny story (max 150 words) using these words: ${words.join(', ')}.
    Language: ${targetLang}.
    Also provide a translation in ${nativeLang}.
    Return JSON.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      content: { type: Type.STRING },
      translation: { type: Type.STRING },
    },
    required: ["title", "content", "translation"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  
  const text = response.text;
  if (!text) throw new Error("Story generation failed");
  
  const result = JSON.parse(text);
  return {
    ...result,
    createdAt: Date.now()
  };
};