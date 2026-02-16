import { useQuery } from '@tanstack/react-query';
import { InferResponseType } from 'hono';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.notifications)['$get'], 200>;

export const useGetNotifications = (workspaceId?: string) => {
  return useQuery<ResponseType>({
    queryKey: ['notifications', workspaceId ?? 'all'],
    queryFn: async () => {
      const response = await client.api.notifications.$get({
        query: workspaceId ? { workspaceId } : {},
      });

      if (!response.ok) throw new Error('Failed to load notifications.');

      return await response.json();
    },
  });
};
