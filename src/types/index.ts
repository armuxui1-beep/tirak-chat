export type ID = string;

export interface User {
  id: ID;
  name: string;
  username: string;
  phone: string;
  about: string;
  avatarColor: string; // gradient key
  avatarEmoji?: string;
  avatarUrl?: string;
  online: boolean;
  lastSeen?: number;
  isContact: boolean;
  blocked?: boolean;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'voice'
  | 'file'
  | 'poll'
  | 'system'
  | 'call'
  | 'location';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Reaction {
  emoji: string;
  userIds: ID[];
}

export interface PollOption {
  id: ID;
  text: string;
  votes: ID[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  multiple: boolean;
  closed?: boolean;
}

export interface Message {
  id: ID;
  chatId: ID;
  senderId: ID;
  type: MessageType;
  text?: string;
  createdAt: number;
  status: MessageStatus;
  replyToId?: ID;
  edited?: boolean;
  deletedForEveryone?: boolean;
  starred?: boolean;
  reactions: Reaction[];
  mediaUrl?: string;
  url?: string;
  mediaGradient?: string;
  mediaName?: string;
  mediaSize?: string;
  duration?: number;
  waveform?: number[];
  viewOnce?: boolean;
  viewed?: boolean;
  poll?: Poll;
  callType?: 'voice' | 'video';
  callStatus?: 'missed' | 'answered' | 'outgoing' | 'incoming';
  expiresAt?: number;
  forwarded?: boolean;
}

export type ChatType = 'direct' | 'group' | 'self';

export interface Chat {
  id: ID;
  type: ChatType;
  name: string;
  avatarColor: string;
  avatarEmoji?: string;
  memberIds: ID[];
  adminIds?: ID[];
  about?: string;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  locked?: boolean;
  folder?: string;
  disappearingSecs?: number;
  wallpaper?: string;
  unreadCount: number;
  draft?: string;
  pinnedMessageIds: ID[];
  inviteCode?: string;
  lastMessage?: Message;
  createdAt: number;
}

export interface StoryItem {
  id: ID;
  kind: 'text' | 'image' | 'video';
  text?: string;
  mediaUrl?: string;
  gradient: string;
  emoji?: string;
  createdAt: number;
  viewers: ID[];
}

export interface Story {
  id: ID;
  userId: ID;
  items: StoryItem[];
}

export interface CallRecord {
  id: ID;
  chatId: ID;
  userId: ID;
  type: 'voice' | 'video';
  direction: 'in' | 'out';
  status: 'answered' | 'missed' | 'declined';
  startedAt: number;
  durationSecs: number;
  group?: boolean;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: 'th' | 'en';
  readReceipts: boolean;
  typingIndicators: boolean;
  onlineStatus: boolean;
  phonePrivacy: 'everyone' | 'contacts' | 'nobody';
  defaultDisappearing: number;
  notifications: {
    messages: boolean;
    groups: boolean;
    calls: boolean;
    sound: boolean;
    previews: boolean;
  };
  screenLock: boolean;
  lockPin?: string;
  autoLockMins: number;
  bubbleStyle: 'coral' | 'navy' | 'violet' | 'emerald';
  enterToSend: boolean;
  backupEnabled: boolean;
  lastBackupAt?: number;
}

export interface Profile {
  id?: ID;
  name: string;
  username: string;
  phone: string;
  about: string;
  avatarColor: string;
  avatarEmoji?: string;
  avatarUrl?: string;
}

export type FolderKey = 'all' | 'unread' | 'friends' | 'family' | 'work' | 'archived';

export interface ActiveCall {
  chatId: ID;
  type: 'voice' | 'video';
  startedAt: number;
  group?: boolean;
  jitsiRoom?: string;
  id?: string;
  isCaller?: boolean;
}
