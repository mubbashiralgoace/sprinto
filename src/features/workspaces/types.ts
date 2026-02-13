import type { BaseDocument } from '@/types/db';

export type Workspace = BaseDocument & {
  name: string;
  imageId?: string;
  imageUrl?: string;
  userId: string;
  inviteCode: string;
};
