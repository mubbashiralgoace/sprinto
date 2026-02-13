import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

interface UseGetTaskCommentsProps {
  taskId: string;
}

export const useGetTaskComments = ({ taskId }: UseGetTaskCommentsProps) => {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const response = await client.api.tasks[':taskId'].comments.$get({
        param: { taskId },
      });

      if (!response.ok) throw new Error('Failed to fetch comments.');

      const { data } = await response.json();
      return data;
    },
  });
};
