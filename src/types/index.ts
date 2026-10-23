export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  profile?: Profile;
}

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice_note';

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: MessageType;
  media_url: string | null;
  media_size: number | null;
  media_name: string | null;
  reply_to_id: string | null;
  is_deleted_sender: boolean;
  is_deleted_receiver: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  reply_to?: Message | null;
  reactions?: Reaction[];
}

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reported_message_id: string | null;
  reason: string;
  note: string | null;
  status: ReportStatus;
  moderation_verdict: string | null;
  moderation_confidence: number | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter?: Profile;
  reported_user?: Profile;
  reported_message?: Message;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  viewed_user_id: string;
  conversation_partner_id: string | null;
  action: string;
  created_at: string;
  admin?: Profile;
  viewed_user?: Profile;
  partner?: Profile;
}

export type AiFeatureKey =
  | 'smart_reply'
  | 'translate'
  | 'summarize'
  | 'smart_search'
  | 'moderate'
  | 'transcribe'
  | 'emoji_suggest';

export interface AiUsageLog {
  id: string;
  user_id: string | null;
  feature: AiFeatureKey;
  model_id: string | null;
  estimated_neurons: number;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'active_7d';
  dismissible: boolean;
  sent_by: string;
  created_at: string;
}

export interface BroadcastDismissal {
  broadcast_id: string;
  user_id: string;
  dismissed_at: string;
}

export interface ConversationItem {
  partner: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}
