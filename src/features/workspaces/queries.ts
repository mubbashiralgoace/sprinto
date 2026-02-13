'use server';

import { IMAGES_BUCKET, MEMBERS_TABLE, WORKSPACES_TABLE } from '@/config/db';
import { createSessionClient, toDocuments } from '@/lib/supabase';

export const getWorkspaces = async () => {
  try {
    const { supabase, storage, user } = await createSessionClient();

    const { data: members } = await supabase.from(MEMBERS_TABLE).select('*').eq('userId', user.$id);

    if (!members || members.length === 0) return { documents: [], total: 0 };

    const workspaceIds = members.map((member) => member.workspaceId);

    const { data: workspaces, count } = await supabase
      .from(WORKSPACES_TABLE)
      .select('*', { count: 'exact' })
      .in('id', workspaceIds)
      .order('created_at', { ascending: false });

    const workspacesWithImages = toDocuments(workspaces ?? []).map((workspace) => ({
      ...workspace,
      imageUrl: workspace.imageId ? storage.from(IMAGES_BUCKET).getPublicUrl(workspace.imageId).data.publicUrl : undefined,
    }));

    return {
      documents: workspacesWithImages,
      total: count ?? 0,
    };
  } catch {
    return { documents: [], total: 0 };
  }
};
