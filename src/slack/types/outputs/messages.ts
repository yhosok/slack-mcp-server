/**
 * Message service output types following TypeSafeAPI + ts-pattern TypeScript best practices
 * All types extend ServiceOutput (Record<string, any>) for TypeSafeAPI compliance
 */

import type { ServiceOutput, ServiceResult } from '../typesafe-api-patterns';

export interface SendMessageOutput extends ServiceOutput {
  success: boolean;
  channel: string;
  ts: string;
  message: string;
  [key: string]: unknown;
}

export interface MessageSearchOutput extends ServiceOutput {
  messages: Array<{
    text: string;
    user: string;
    ts: string;
    channel: string;
    permalink: string;
  }>;
  total: number;
  query: string;
  hasMore: boolean;
  [key: string]: unknown;
}

export interface ChannelHistoryOutput extends ServiceOutput {
  messages: Array<{
    type: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    reply_count?: number;
  }>;
  hasMore: boolean;
  responseMetadata?: {
    nextCursor?: string;
  };
  channel: string;
  [key: string]: unknown;
}

export interface ListChannelsOutput extends ServiceOutput {
  channels: Array<{
    id: string;
    name: string;
    isPrivate: boolean;
    isMember: boolean;
    isArchived: boolean;
    memberCount?: number;
    topic?: string;
    purpose?: string;
  }>;
  total: number;
  [key: string]: unknown;
}

export interface UserInfoOutput extends ServiceOutput {
  id: string;
  name: string;
  displayName: string;
  realName?: string;
  email?: string;
  isBot?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
  deleted?: boolean;
  profile: {
    image24?: string;
    image32?: string;
    image48?: string;
    image72?: string;
    image192?: string;
    image512?: string;
    statusText?: string;
    statusEmoji?: string;
    title?: string;
  };
  [key: string]: unknown;
}

export interface ChannelInfoOutput extends ServiceOutput {
  id: string;
  name: string;
  isChannel?: boolean;
  isGroup?: boolean;
  isPrivate?: boolean;
  isArchived?: boolean;
  created?: number;
  creator?: string;
  topic?: { value?: string; creator?: string; last_set?: number };
  purpose?: { value?: string; creator?: string; last_set?: number };
  memberCount?: number;
  members?: string[];
  [key: string]: unknown;
}

/**
 * TypeSafeAPI + ts-pattern discriminated union types for type-safe service results
 */
export type SendMessageResult = ServiceResult<SendMessageOutput>;
export type MessageSearchResult = ServiceResult<MessageSearchOutput>;
export type ChannelHistoryResult = ServiceResult<ChannelHistoryOutput>;
export type ListChannelsResult = ServiceResult<ListChannelsOutput>;
export type UserInfoResult = ServiceResult<UserInfoOutput>;
export type ChannelInfoResult = ServiceResult<ChannelInfoOutput>;