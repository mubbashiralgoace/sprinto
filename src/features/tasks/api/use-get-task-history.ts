import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

interface UseGetTaskHistoryProps {
  taskId: string;
}

export const useGetTaskHistory = ({ taskId }: UseGetTaskHistoryProps) => {
  return useQuery({
    queryKey: ['task-history', taskId],
    queryFn: async () => {
      const response = await client.api.tasks[':taskId'].history.$get({
        param: { taskId },
      });

      if (!response.ok) throw new Error('Failed to fetch task history.');

      const { data } = await response.json();

      return data;
    },
  });
};
