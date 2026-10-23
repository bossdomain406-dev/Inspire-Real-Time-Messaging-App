import React from 'react';

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelectEmoji, onClose }) => {
  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute z-40 bg-white dark:bg-[#161B2B] shadow-xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-full px-2 py-1.5 flex items-center space-x-1 animate-slide-up select-none -top-11 right-0 sm:right-auto"
        role="dialog"
        aria-label="Reaction Picker"
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};
