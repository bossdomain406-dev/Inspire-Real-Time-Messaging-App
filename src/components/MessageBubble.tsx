import React, { useState, useEffect } from 'react';
import { Message } from '../types';
import { isMessageDeletedForViewer, formatMessageTime } from '../utils/helpers';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { ReactionPicker } from './ReactionPicker';
import { workerApi } from '../lib/workerApi';
import { useAI } from '../hooks/useAI';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onReply: (message: Message) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onReport?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId,
  onReply,
  onDelete,
  onReact,
  onReport,
}) => {
  const isMe = message.sender_id === currentUserId;
  const isDeleted = isMessageDeletedForViewer(message, currentUserId);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string>(message.media_url || '');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const { translateMessage, transcribeAudio } = useAI();

  useEffect(() => {
    let isMounted = true;
    if (message.media_url && !message.media_url.startsWith('http') && !message.media_url.startsWith('data:')) {
      workerApi.getDownloadUrl(message.media_url).then((url) => {
        if (isMounted) setResolvedMediaUrl(url);
      });
    } else if (message.media_url) {
      setResolvedMediaUrl(message.media_url);
    }
    return () => {
      isMounted = false;
    };
  }, [message.media_url]);

  const handleTranslate = async () => {
    if (translation) {
      setTranslation(null); // toggle off
      return;
    }
    if (!message.content) return;
    setIsTranslating(true);
    const result = await translateMessage(message.content, 'en');
    setTranslation(result);
    setIsTranslating(false);
    setShowActionsMenu(false);
  };

  const handleTranscribe = async () => {
    if (transcript) {
      setTranscript(null);
      return;
    }
    setIsTranscribing(true);
    const text = await transcribeAudio(message.media_url || 'voice_note.webm');
    setTranscript(text);
    setIsTranscribing(false);
  };

  // If deleted for this viewer, show ghost bubble
  if (isDeleted) {
    return (
      <div className={`flex w-full my-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[75%] px-3.5 py-2 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 text-xs italic text-gray-500 dark:text-gray-400 select-none ${
            isMe ? 'rounded-br-sm' : 'rounded-bl-sm'
          }`}
        >
          🚫 Message deleted
          <span className="ml-2 text-[10px] text-gray-400">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    );
  }

  // Group reactions by emoji
  const reactionCounts: Record<string, number> = {};
  (message.reactions || []).forEach((r) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  return (
    <div className={`group relative flex w-full my-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[85%] sm:max-w-[75%] flex flex-col">
        {/* Reply Quote Preview if this message replied to an earlier message */}
        {message.reply_to && (
          <div
            className={`text-xs p-2 mb-1 rounded-lg border-l-4 border-[#FFD700] bg-black/5 dark:bg-white/10 ${
              isMe ? 'text-white/90' : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            <div className="font-bold text-[11px] text-[#FFD700]">
              {message.reply_to.sender_id === currentUserId ? 'You' : 'Replied message'}
            </div>
            <div className="truncate text-xs opacity-90">
              {message.reply_to.content || `[${message.reply_to.message_type}]`}
            </div>
          </div>
        )}

        {/* Message Bubble Container */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl shadow-sm text-sm transition-shadow select-text ${
            isMe
              ? 'bg-[#0E2A6E] dark:bg-[#254BA8] text-white rounded-br-sm'
              : 'bg-white dark:bg-[#161B2B] text-black dark:text-[#F5F7FA] border border-[#E5E7EB] dark:border-[#2A3348] rounded-bl-sm'
          }`}
        >
          {/* Media Content */}
          {message.message_type === 'image' && resolvedMediaUrl && (
            <div className="mb-2 overflow-hidden rounded-xl bg-black/10">
              <img
                src={resolvedMediaUrl}
                alt={message.media_name || 'Shared image'}
                className="max-h-72 w-full object-cover rounded-xl hover:opacity-95 transition-opacity cursor-pointer"
                onClick={() => window.open(resolvedMediaUrl, '_blank')}
              />
            </div>
          )}

          {message.message_type === 'video' && resolvedMediaUrl && (
            <div className="mb-2 overflow-hidden rounded-xl bg-black">
              <video
                src={resolvedMediaUrl}
                controls
                className="max-h-72 w-full rounded-xl"
              />
            </div>
          )}

          {message.message_type === 'voice_note' && (
            <div className="mb-1">
              <VoiceNotePlayer audioUrl={resolvedMediaUrl} isSentByMe={isMe} />
              
              {/* Voice Note Transcription Button */}
              <button
                type="button"
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className={`mt-1 inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                  isMe
                    ? 'bg-white/15 hover:bg-white/25 text-white'
                    : 'bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#1A1A2E] dark:text-[#FFD700]'
                }`}
              >
                <span>✨</span>
                <span>{isTranscribing ? 'Transcribing…' : transcript ? 'Hide transcript' : 'View transcript'}</span>
              </button>

              {transcript && (
                <div
                  className={`mt-1.5 p-2 rounded-lg text-xs leading-relaxed border ${
                    isMe
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <span className="font-bold text-[10px] block opacity-75">TRANSCRIPT</span>
                  {transcript}
                </div>
              )}
            </div>
          )}

          {message.message_type === 'audio' && resolvedMediaUrl && (
            <div className="mb-2">
              <audio src={resolvedMediaUrl} controls className="w-full h-10" />
            </div>
          )}

          {/* Text Content */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words leading-relaxed font-normal">
              {message.content}
            </p>
          )}

          {/* Inline Translation Display */}
          {translation && (
            <div
              className={`mt-2 pt-2 border-t text-xs leading-relaxed ${
                isMe ? 'border-white/20 text-white/95' : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-1 text-[10px] font-bold text-[#FFD700] mb-0.5">
                <span>✨</span>
                <span>TRANSLATED</span>
              </div>
              <p>{translation}</p>
            </div>
          )}

          {/* Footer Metadata: Timestamp + Read Receipts */}
          <div
            className={`flex items-center justify-end space-x-1.5 mt-1 select-none text-[10px] ${
              isMe ? 'text-white/80' : 'text-[#4B5563] dark:text-[#9CA3AF]'
            }`}
          >
            <span>{formatMessageTime(message.created_at)}</span>

            {/* Read Receipt ticks for sent messages */}
            {isMe && (
              <span className="inline-flex items-center ml-0.5">
                {message.is_read ? (
                  // Double check accent-colored Yellow
                  <span className="text-[#FFD700] font-black tracking-tighter" title="Read">✓✓</span>
                ) : (
                  // Single/Double delivered check
                  <span className="text-white/70 font-bold tracking-tighter" title="Sent">✓✓</span>
                )}
              </span>
            )}
          </div>

          {/* Quick Reaction Pill Badge */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className="absolute -bottom-2.5 right-2 flex items-center space-x-1 z-10">
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(message.id, emoji)}
                  className="px-2 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-xs font-bold shadow-md flex items-center space-x-1 border border-[#FFD700]/40 hover:scale-110 active:scale-95 transition-transform"
                  aria-label={`${count} reactions with ${emoji}`}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[10px] font-black">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover / Long-press Action Bar */}
        <div
          className={`absolute -top-7 ${
            isMe ? 'right-2' : 'left-2'
          } hidden group-hover:flex items-center space-x-1 bg-white/95 dark:bg-[#161B2B]/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5 shadow-lg z-20 animate-fade-in`}
        >
          <button
            type="button"
            onClick={() => setShowReactionsPicker((prev) => !prev)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs"
            title="React"
            aria-label="React to message"
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs font-bold"
            title="Reply"
            aria-label="Reply to message"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={() => setShowActionsMenu((prev) => !prev)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs"
            title="More actions"
            aria-label="More message actions"
          >
            ⋯
          </button>
        </div>

        {/* Reaction Picker Popover */}
        {showReactionsPicker && (
          <ReactionPicker
            onSelectEmoji={(emoji) => {
              onReact(message.id, emoji);
              setShowReactionsPicker(false);
            }}
            onClose={() => setShowReactionsPicker(false)}
          />
        )}

        {/* More Actions Menu */}
        {showActionsMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowActionsMenu(false)}
            />
            <div
              className={`absolute z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-gray-200 dark:border-gray-700 rounded-xl py-1 w-44 text-xs font-semibold ${
                isMe ? 'right-0 top-8' : 'left-0 top-8'
              }`}
            >
              {message.content && !isMe && (
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-800 dark:text-gray-200"
                >
                  <span className="text-sm">✨</span>
                  <span>{isTranslating ? 'Translating…' : translation ? 'Hide translation' : 'Translate message'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onReply(message);
                  setShowActionsMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-800 dark:text-gray-200"
              >
                <span>↩</span>
                <span>Reply</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onDelete(message.id, false);
                  setShowActionsMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-800 dark:text-gray-200"
              >
                <span>🗑</span>
                <span>Delete for me</span>
              </button>

              {isMe && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(message.id, true);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2 font-bold"
                >
                  <span>🗑</span>
                  <span>Delete for everyone</span>
                </button>
              )}

              {!isMe && onReport && (
                <button
                  type="button"
                  onClick={() => {
                    onReport(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
                >
                  <span>🚩</span>
                  <span>Report message</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
