import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.tasks)[':taskId']['comments']['$post'], 200>;
type RequestType = InferRequestType<(typeof client.api.tasks)[':taskId']['comments']['$post']>;

export const useCreateTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json, param }) => {
      const response = await client.api.tasks[':taskId'].comments.$post({ json, param });

      if (!response.ok) throw new Error('Failed to add comment.');

      return await response.json();
    },
    onSuccess: (_data, variables) => {
      toast.success('Comment added.');
      queryClient.invalidateQueries({
        queryKey: ['task-comments', variables.param.taskId],
        exact: true,
      });
    },
    onError: (error) => {
      console.error('[CREATE_TASK_COMMENT]:', error);
      toast.error('Failed to add comment.');
    },
  });
};
