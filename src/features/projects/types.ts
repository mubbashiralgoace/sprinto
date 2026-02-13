import type { BaseDocument } from '@/types/db';

export type Project = BaseDocument & {
  name: string;
  imageId?: string;
  imageUrl?: string;
  workspaceId: string;
};
