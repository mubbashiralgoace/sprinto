import type { BaseDocument } from '@/types/db';

export enum MemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export type Member = BaseDocument & {
  workspaceId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
};
