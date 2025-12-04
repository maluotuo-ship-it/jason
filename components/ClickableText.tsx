import React, { useMemo } from 'react';

interface ClickableTextProps {
  text: string;
  lang: string;
  onWordClick: (word: string) => void;
  className?: string;
}

const ClickableText: React.FC<ClickableTextProps> = ({ text, lang, onWordClick, className = '' }) => {
  const segments = useMemo(() => {
    try {
      // @ts-ignore - Intl.Segmenter is supported in modern browsers but types might be missing in older TS configs
      const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
      return Array.from(segmenter.segment(text));
    } catch (e) {
      // Fallback: Split by spaces and punctuation for languages where words are space-separated
      // This regex captures words and delimiters separately
      const parts = text.split(/([^\w\u00C0-\u00FF]+)/g);
      return parts.map(s => ({
        segment: s,
        // precise isWordLike check is hard without segmenter, but generally check if it contains letters
        isWordLike: /[\w\u00C0-\u00FF]/.test(s)
      }));
    }
  }, [text, lang]);

  return (
    <span className={className}>
      {segments.map((seg: any, i) => {
        // Use segmenter's isWordLike or fallback logic
        const isClickable = seg.isWordLike;
        
        return (
          <span
            key={i}
            onClick={(e) => {
              if (isClickable) {
                e.stopPropagation();
                onWordClick(seg.segment);
              }
            }}
            className={isClickable ? "cursor-pointer hover:text-brand-blue hover:underline decoration-brand-yellow decoration-2 underline-offset-2 transition-colors active:text-brand-pink" : ""}
          >
            {seg.segment}
          </span>
        );
      })}
    </span>
  );
};

export default ClickableText;
