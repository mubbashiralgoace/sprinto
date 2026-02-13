import type { SupabaseClient } from '@supabase/supabase-js';

import { MEMBERS_TABLE } from '@/config/db';
import { toDocument } from '@/lib/supabase';

interface GetMemberProps {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
}

export const getMember = async ({ supabase, workspaceId, userId }: GetMemberProps) => {
  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .select('*')
    .eq('workspaceId', workspaceId)
    .eq('userId', userId)
    .maybeSingle();

  if (error || !data) return null;

  return toDocument(data);
};
