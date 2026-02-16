import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferResponseType } from 'hono';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.notifications)[':notificationId']['read']['$patch'], 200>;

type Params = {
  notificationId: string;
  workspaceId?: string;
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, Params>({
    mutationFn: async ({ notificationId }) => {
      const response = await client.api.notifications[':notificationId'].read.$patch({
        param: { notificationId },
      });

      if (!response.ok) throw new Error('Failed to mark notification as read.');

      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', variables.workspaceId ?? 'all'],
        exact: true,
      });
    },
  });
};
