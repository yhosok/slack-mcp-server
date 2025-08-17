/**
 * User service output types following TypeSafeAPI + ts-pattern TypeScript best practices
 * All types extend ServiceOutput (Record<string, any>) for TypeSafeAPI compliance
 */

import type { ServiceOutput, ServiceResult } from '../typesafe-api-patterns';

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

/**
 * TypeSafeAPI + ts-pattern discriminated union types for type-safe service results
 */
export type UserInfoResult = ServiceResult<UserInfoOutput>;