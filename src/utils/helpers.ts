import { Message, MessageType } from '../types';

/**
 * Validates a username according to Inspire specifications:
 * 3-20 characters, lowercase letters, numbers, and underscores only.
 */
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  const regex = /^[a-z0-9_]{3,20}$/;
  return regex.test(username);
}

/**
 * Checks whether a message is marked deleted from a specific viewer's perspective.
 * PRD/Schema rule:
 * (viewer = sender AND is_deleted_sender) OR (viewer = receiver AND is_deleted_receiver)
 */
export function isMessageDeletedForViewer(message: Pick<Message, 'sender_id' | 'receiver_id' | 'is_deleted_sender' | 'is_deleted_receiver'>, viewerId: string): boolean {
  if (viewerId === message.sender_id && message.is_deleted_sender) {
    return true;
  }
  if (viewerId === message.receiver_id && message.is_deleted_receiver) {
    return true;
  }
  return false;
}

/**
 * File size limits according to 02_TRD.md Section 6
 */
export const MEDIA_LIMITS_BYTES: Record<MessageType | 'avatar', number> = {
  text: 64 * 1024,              // 64KB
  image: 10 * 1024 * 1024,      // 10MB
  video: 50 * 1024 * 1024,      // 50MB
  audio: 20 * 1024 * 1024,      // 20MB
  voice_note: 10 * 1024 * 1024, // 10MB
  avatar: 5 * 1024 * 1024,      // 5MB
};

export function validateMediaUpload(type: MessageType | 'avatar', sizeInBytes: number): { valid: boolean; error?: string } {
  const max = MEDIA_LIMITS_BYTES[type];
  if (!max) return { valid: false, error: 'Unknown media type' };
  if (sizeInBytes > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { valid: false, error: `File exceeds maximum allowed size of ${mb}MB` };
  }
  return { valid: true };
}

/**
 * Formats "last seen" timestamp into:
 * Just now / X minutes ago / Today at HH:MM / Yesterday at HH:MM / DD Mon at HH:MM
 */
export function formatLastSeen(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';

  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return `Today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Format message timestamps (e.g. 10:42 AM)
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format duration in mm:ss for voice notes
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper to generate deterministic avatar colors
 */
export function getAvatarColor(nameOrId: string): { bg: string; text: string } {
  const palette = [
    { bg: '#0E2A6E', text: '#FFFFFF' }, // Dark Royal Blue
    { bg: '#1A4FBA', text: '#FFFFFF' },
    { bg: '#FFD700', text: '#1A1A2E' }, // Yellow
    { bg: '#081B47', text: '#FFFFFF' },
    { bg: '#254BA8', text: '#FFFFFF' },
    { bg: '#E5A900', text: '#1A1A2E' },
  ];
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = nameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}
