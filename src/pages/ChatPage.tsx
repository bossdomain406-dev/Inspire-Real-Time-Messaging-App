import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { usePresence } from '../hooks/usePresence';
import { useTyping } from '../hooks/useTyping';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAI } from '../hooks/useAI';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { Profile, Message, MessageType } from '../types';
import { formatLastSeen, formatDuration } from '../utils/helpers';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const ChatPage: React.FC = () => {
  const { userId: partnerId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  // Messaging hooks
  const {
    messages,
    isLoading: messagesLoading,
    sendMessage,
    deleteMessage,
    addReaction,
    markAsRead,
    addLocalMessage,
  } = useMessages(partnerId || '');

  const { isOnline } = usePresence();
  const { isPartnerTyping, notifyTyping } = useTyping(partnerId || '');
  const { uploadMedia, isUploading, uploadProgress, error: uploadError } = useMediaUpload();
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    permissionError,
  } = useVoiceRecorder();

  // AI Hook
  const {
    getSmartReplies,
    summarizeChat,
    smartSearchChat,
    suggestEmojis,
    moderateContent,
  } = useAI();

  // Local UI states
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [suggestedEmojis, setSuggestedEmojis] = useState<string[]>([]);

  // Search & Summary Modal States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingMessageIds, setMatchingMessageIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Report & Block Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Spam or harmful behavior');
  const [reportNote, setReportNote] = useState('');
  const [reportedMessageTarget, setReportedMessageTarget] = useState<Message | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MessageType>('image');

  // Fetch partner profile & check block status
  useEffect(() => {
    if (!partnerId) return;

    const fetchPartner = async () => {
      setPartnerLoading(true);

      if (!isConfigured) {
        // Mock partner profile
        setPartnerProfile({
          id: partnerId,
          username: partnerId === 'usr_jordan' ? 'jordan_ai' : 'partner_user',
          display_name: partnerId === 'usr_jordan' ? 'Jordan Lee' : 'Partner User',
          bio: 'Inspire conversationalist ✨',
          avatar_url: null,
          role: 'user',
          status: 'active',
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        setPartnerLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', partnerId)
          .maybeSingle();

        if (data) {
          setPartnerProfile(data as Profile);
        }

        // Check if either party blocked the other
        if (user) {
          const { data: blockData } = await supabase
            .from('blocked_users')
            .select('*')
            .or(
              `and(blocker_id.eq.${user.id},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${user.id})`
            )
            .maybeSingle();

          setIsBlocked(Boolean(blockData));
        }
      } catch (err) {
        console.warn('Error loading partner:', err);
      } finally {
        setPartnerLoading(false);
      }
    };

    fetchPartner();
  }, [partnerId, user]);

  // Mark incoming messages as read upon view
  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages.length, markAsRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Smart reply trigger: on receiving a new message while chat is open
  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageContent = lastMessage?.content;
  const lastMessageSender = lastMessage?.sender_id;

  useEffect(() => {
    if (lastMessageContent && lastMessageSender && lastMessageSender !== user?.id) {
      getSmartReplies(lastMessageContent).then((replies) => {
        setSmartReplies(replies);
      });
    } else {
      setSmartReplies([]);
    }
  }, [lastMessageId, lastMessageContent, lastMessageSender, user?.id, getSmartReplies]);

  // Debounced emoji suggestions while composing
  useEffect(() => {
    if (!inputText.trim() || inputText.length < 3) {
      setSuggestedEmojis([]);
      return;
    }

    const timer = setTimeout(() => {
      suggestEmojis(inputText).then((emojis) => {
        setSuggestedEmojis(emojis);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [inputText]);

  // Handle typing notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    notifyTyping();
  };

  // Send regular text message
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isBlocked) return;

    setInputText('');
    setSmartReplies([]);
    setSuggestedEmojis([]);
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    await sendMessage(text, 'text', undefined, replyId);
  };

  // Open file picker for specific media type
  const triggerMediaPicker = (type: MessageType) => {
    setSelectedMediaType(type);
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        type === 'image'
          ? 'image/*'
          : type === 'video'
          ? 'video/*'
          : 'audio/*';
      fileInputRef.current.click();
    }
  };

  // Handle media file upload
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isBlocked || !user || !partnerId) return;

    toast(`Uploading ${file.name}…`, 'info');
    const result = await uploadMedia(file, selectedMediaType, file.name);

    if (result) {
      // Immediate optimistic append so user sees their media without waiting
      const localMsg: Message = {
        id: `local_media_${Date.now()}`,
        sender_id: user.id,
        receiver_id: partnerId,
        content: null,
        message_type: selectedMediaType,
        media_url: result.url || result.object_key,
        media_size: result.size || file.size,
        media_name: file.name,
        reply_to_id: replyingTo?.id || null,
        is_deleted_sender: false,
        is_deleted_receiver: false,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        reactions: [],
      };
      addLocalMessage(localMsg);
      setReplyingTo(null);

      // Persist to database if configured
      if (isConfigured) {
        await sendMessage(
          '',
          selectedMediaType,
          {
            url: result.object_key,
            size: result.size || file.size,
            name: file.name,
          },
          replyingTo?.id
        );
      }
      toast('Media sent!', 'success');
    } else if (uploadError) {
      toast(uploadError, 'error');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle voice note recording finish
  const handleStopVoiceNote = async () => {
    const blob = await stopRecording();
    if (!blob || isBlocked || !user || !partnerId) return;

    toast('Uploading voice note…', 'info');
    const result = await uploadMedia(blob, 'voice_note', 'voice_note.webm');

    if (result) {
      const localMsg: Message = {
        id: `local_voice_${Date.now()}`,
        sender_id: user.id,
        receiver_id: partnerId,
        content: null,
        message_type: 'voice_note',
        media_url: result.url || result.object_key,
        media_size: blob.size,
        media_name: 'voice_note.webm',
        reply_to_id: null,
        is_deleted_sender: false,
        is_deleted_receiver: false,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        reactions: [],
      };
      addLocalMessage(localMsg);

      if (isConfigured) {
        await sendMessage('', 'voice_note', {
          url: result.object_key,
          size: blob.size,
          name: 'voice_note.webm',
        });
      }
      toast('Voice note sent!', 'success');
    }
  };

  // Chat Summarizer Trigger
  const handleSummarize = async () => {
    setShowOverflowMenu(false);
    setIsSummarizing(true);
    const validMessages = messages
      .filter((m) => m.content)
      .slice(-30)
      .map((m) => ({
        sender: m.sender_id === user?.id ? 'You' : partnerProfile?.display_name || 'Partner',
        content: m.content || '',
      }));

    const result = await summarizeChat(validMessages);
    setSummaryResult(result);
    setIsSummarizing(false);
  };

  // Smart Search Trigger
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setMatchingMessageIds([]);
      return;
    }
    setIsSearching(true);
    const searchable = messages
      .filter((m) => m.content)
      .map((m) => ({ id: m.id, content: m.content || '' }));

    const ids = await smartSearchChat(searchQuery, searchable);
    setMatchingMessageIds(ids);
    setIsSearching(false);
  };

  // Block user
  const handleBlockUser = async () => {
    if (!user || !partnerId) return;
    setShowBlockConfirm(false);

    if (isConfigured) {
      try {
        await supabase.from('blocked_users').insert({
          blocker_id: user.id,
          blocked_id: partnerId,
        });
      } catch (e) {
        console.warn('Block user error:', e);
      }
    }

    setIsBlocked(true);
    toast(`Blocked @${partnerProfile?.username}`, 'info');
  };

  // Submit report
  const handleSubmitReport = async () => {
    if (!user || !partnerId) return;
    setIsSubmittingReport(true);

    // Run AI content moderation if reported a specific message
    let verdict: string | null = null;
    let confidence: number | null = null;
    if (reportedMessageTarget?.content) {
      const modResult = await moderateContent('text', reportedMessageTarget.content);
      verdict = modResult.verdict;
      confidence = modResult.confidence;
    }

    if (isConfigured) {
      try {
        await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: partnerId,
          reported_message_id: reportedMessageTarget?.id || null,
          reason: reportReason,
          note: reportNote || null,
          moderation_verdict: verdict,
          moderation_confidence: confidence,
        });
      } catch (e) {
        console.warn('Report submit error:', e);
      }
    }

    setIsSubmittingReport(false);
    setShowReportModal(false);
    setReportNote('');
    setReportedMessageTarget(null);
    toast('Report submitted for Admin review. Thank you for keeping Inspire safe.', 'success');
  };

  const partnerIsOnline = partnerId ? isOnline(partnerId) : false;

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-white dark:bg-[#0B0F1A] text-black dark:text-white overflow-hidden">
      {/* Hidden file input for media picker */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Chat Top Header */}
      <header className="flex-shrink-0 z-30 bg-white dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#2A3348] px-3 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            onClick={() => navigate('/chats')}
            className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white transition-colors"
            aria-label="Back to conversations"
          >
            ←
          </button>

          <Avatar
            name={partnerProfile?.display_name || 'User'}
            avatarUrl={partnerProfile?.avatar_url}
            size="sm"
            showOnlineStatus={true}
            isOnline={partnerIsOnline}
          />

          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="font-extrabold text-sm text-black dark:text-white truncate leading-tight">
              {partnerLoading ? 'Loading…' : partnerProfile?.display_name}
            </h2>
            <div className="text-[11px] font-semibold truncate leading-none mt-0.5">
              {isPartnerTyping ? (
                <TypingIndicator className="text-[11px]" />
              ) : partnerIsOnline ? (
                <span className="text-[#16A34A] dark:text-[#22C55E]">Online</span>
              ) : partnerProfile?.last_seen ? (
                <span className="text-[#4B5563] dark:text-[#9CA3AF]">
                  {formatLastSeen(partnerProfile.last_seen)}
                </span>
              ) : (
                <span className="text-gray-400">Offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center space-x-1 relative">
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            title="Search conversation"
            aria-label="Search conversation"
          >
            🔍
          </button>

          <button
            onClick={() => setShowOverflowMenu((prev) => !prev)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold"
            title="Options"
            aria-label="More conversation options"
          >
            ⋮
          </button>

          {/* Header Overflow Dropdown Menu */}
          {showOverflowMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowOverflowMenu(false)}
              />
              <div className="absolute right-0 top-10 z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-2xl py-1.5 w-52 text-xs font-semibold animate-slide-up">
                <button
                  type="button"
                  onClick={handleSummarize}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span className="text-base text-[#FFD700]">✨</span>
                  <span>Summarize this chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>🔍</span>
                  <span>Smart Search</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
                >
                  <span>🚩</span>
                  <span>Report @{partnerProfile?.username}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBlockConfirm(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
                >
                  <span>🚫</span>
                  <span>Block contact</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* In-Chat Search Bar Toggle */}
      {isSearchOpen && (
        <div className="bg-[#F5F7FA] dark:bg-[#161B2B] px-4 py-2.5 border-b border-[#E5E7EB] dark:border-[#2A3348] flex items-center space-x-2 animate-slide-up">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Natural search or keywords… (e.g. 'when is the trip?')"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
            />
            <span className="absolute left-2.5 top-2 text-xs">✨</span>
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-3 py-1.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
          >
            {isSearching ? '…' : 'Find'}
          </button>
          <button
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
              setMatchingMessageIds([]);
            }}
            className="text-gray-400 hover:text-black dark:hover:text-white text-xs font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Message List Canvas */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-white dark:bg-[#0B0F1A]">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-400">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#4B5563] dark:text-[#9CA3AF]">
            <div className="w-16 h-16 rounded-full bg-[#0E2A6E]/10 dark:bg-[#3D6FE0]/10 flex items-center justify-center text-3xl mb-3">
              👋
            </div>
            <h4 className="font-extrabold text-sm text-black dark:text-white">
              Say hello to {partnerProfile?.display_name}!
            </h4>
            <p className="text-xs max-w-xs mt-1">
              Messages and media sent here are delivered instantly in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isHighlighted = matchingMessageIds.includes(msg.id);
            return (
              <div
                key={msg.id}
                className={isHighlighted ? 'ring-2 ring-[#FFD700] rounded-2xl p-0.5' : ''}
              >
                <MessageBubble
                  message={msg}
                  currentUserId={user?.id || ''}
                  onReply={(m) => setReplyingTo(m)}
                  onDelete={deleteMessage}
                  onReact={addReaction}
                  onReport={(m) => {
                    setReportedMessageTarget(m);
                    setShowReportModal(true);
                  }}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Smart Reply Suggestions Bar */}
      {smartReplies.length > 0 && !isBlocked && (
        <div className="flex items-center space-x-2 px-4 py-1.5 overflow-x-auto bg-[#F5F7FA] dark:bg-[#161B2B] border-t border-[#E5E7EB] dark:border-[#2A3348] select-none no-scrollbar">
          <span className="text-xs text-[#FFD700] font-bold select-none">✨</span>
          {smartReplies.map((reply, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                sendMessage(reply, 'text');
                setSmartReplies([]);
              }}
              className="flex-shrink-0 px-3.5 py-1 rounded-full bg-white dark:bg-[#1A2234] border border-[#0E2A6E] dark:border-[#3D6FE0] text-black dark:text-white text-xs font-bold hover:bg-[#0E2A6E] hover:text-white dark:hover:bg-[#3D6FE0] transition-colors shadow-xs"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* AI Emoji Suggestions Row */}
      {suggestedEmojis.length > 0 && !isBlocked && (
        <div className="flex items-center space-x-2 px-4 py-1 bg-white dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#2A3348]">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Suggested:
          </span>
          {suggestedEmojis.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInputText((prev) => prev + emoji)}
              className="text-base hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Quoted Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#161B2B] border-t border-[#FFD700]">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-[#0E2A6E] dark:text-[#3D6FE0] font-black text-sm">↩</span>
            <div className="text-xs truncate">
              <span className="font-bold text-black dark:text-white mr-1.5">
                Replying to {replyingTo.sender_id === user?.id ? 'yourself' : partnerProfile?.display_name}:
              </span>
              <span className="text-gray-600 dark:text-gray-300">
                {replyingTo.content || `[${replyingTo.message_type}]`}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-gray-400 hover:text-black dark:hover:text-white text-xs font-bold"
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full bg-gray-200 dark:bg-gray-800 h-1">
          <div
            style={{ width: `${uploadProgress}%` }}
            className="bg-[#0E2A6E] dark:bg-[#FFD700] h-full transition-all duration-300"
          />
        </div>
      )}

      {/* Bottom Composer / Input Bar */}
      {isBlocked ? (
        <div className="p-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500">
          🚫 You cannot message this contact.
        </div>
      ) : isRecording ? (
        // Voice Note Live Recording Bar
        <div className="p-3 bg-[#0E2A6E] text-white flex items-center justify-between animate-slide-up">
          <div className="flex items-center space-x-3">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-sm font-extrabold tracking-wider">
              {formatDuration(recordingDuration)}
            </span>
            <span className="text-xs text-blue-200">Recording voice note…</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1 rounded-xl text-xs font-bold text-blue-200 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStopVoiceNote}
              className="px-4 py-1.5 rounded-xl bg-[#FFD700] text-[#1A1A2E] text-xs font-extrabold shadow-md active:scale-95"
            >
              Send Voice Note
            </button>
          </div>
        </div>
      ) : (
        <footer className="p-3 bg-white dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#2A3348] relative">
          {permissionError && (
            <div className="mb-2 text-xs text-rose-500 font-semibold">
              ⚠️ {permissionError}
            </div>
          )}

          {/* Attachment Menu Popup */}
          {showAttachMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowAttachMenu(false)}
              />
              <div className="absolute bottom-16 left-3 z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-2xl p-2 flex flex-col space-y-1 w-44 animate-slide-up">
                <button
                  type="button"
                  onClick={() => triggerMediaPicker('image')}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">📷</span>
                  <span>Photos & Images</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerMediaPicker('video')}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">🎬</span>
                  <span>Videos (up to 50MB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerMediaPicker('audio')}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">🎵</span>
                  <span>Audio Files</span>
                </button>
              </div>
            </>
          )}

          <form onSubmit={handleSendText} className="flex items-center space-x-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg transition-transform active:scale-95"
              aria-label="Attach photo, video or audio"
            >
              📎
            </button>

            {/* Soft-filled text input */}
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type a message…"
              className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0]"
            />

            {/* Mic Button (when input empty) vs Send Button (when input filled) */}
            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center font-black hover:bg-[#081B47] active:scale-95 transition-transform shadow-md"
                aria-label="Send message"
              >
                ➤
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="w-10 h-10 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center text-lg hover:bg-[#081B47] active:scale-95 transition-transform shadow-md"
                aria-label="Record voice note"
              >
                🎤
              </button>
            )}
          </form>
        </footer>
      )}

      {/* Chat Summary Modal */}
      {(summaryResult || isSummarizing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-xl text-[#FFD700]">✨</span>
              <h3 className="font-extrabold text-base text-black dark:text-white">
                Conversation Summary
              </h3>
            </div>
            {isSummarizing ? (
              <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
                Generating smart summary…
              </div>
            ) : (
              <div className="whitespace-pre-line text-xs leading-relaxed text-black dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4">
                {summaryResult}
              </div>
            )}
            <button
              onClick={() => setSummaryResult(null)}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-rose-600 mb-2">
              Block @{partnerProfile?.username}?
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed mb-6">
              Blocked contacts cannot send you messages or view your online presence. You can unblock them later from settings.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              Report User or Content
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mb-4">
              Inspire Safety: Reports are queued for Admin moderation with AI verification.
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white"
                >
                  <option value="Spam or harmful behavior">Spam or harmful behavior</option>
                  <option value="Harassment or bullying">Harassment or bullying</option>
                  <option value="Inappropriate media">Inappropriate media</option>
                  <option value="Impersonation or fraud">Impersonation or fraud</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
                  Additional Note (Optional)
                </label>
                <textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Provide any details to help admin review…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportedMessageTarget(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 shadow-md"
              >
                {isSubmittingReport ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
