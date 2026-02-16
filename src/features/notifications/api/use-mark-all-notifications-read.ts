import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.notifications)['read']['$patch'], 200>;
type RequestType = InferRequestType<(typeof client.api.notifications)['read']['$patch']>;

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.notifications.read.$patch({ json });

      if (!response.ok) throw new Error('Failed to mark notifications as read.');

      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', variables?.json?.workspaceId ?? 'all'],
        exact: true,
      });
    },
  });
};
