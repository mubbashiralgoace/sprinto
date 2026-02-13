import { useQuery } from '@tanstack/react-query';

import type { TaskStatus } from '@/features/tasks/types';
import { client } from '@/lib/hono';

interface useGetTasksProps {
  workspaceId: string;
  projectId?: string | null;
  status?: TaskStatus | null;
  search?: string | null;
  assigneeId?: string | null;
}

export const useGetTasks = ({ workspaceId, projectId, status, search, assigneeId }: useGetTasksProps) => {
  const query = useQuery({
    queryKey: ['tasks', workspaceId, projectId, status, search, assigneeId],
    queryFn: async () => {
      const queryParams: {
        workspaceId: string;
        projectId?: string;
        status?: TaskStatus;
        search?: string;
        assigneeId?: string;
      } = { workspaceId };

      if (projectId) queryParams.projectId = projectId;
      if (status) queryParams.status = status;
      if (search) queryParams.search = search;
      if (assigneeId) queryParams.assigneeId = assigneeId;

      const response = await client.api.tasks.$get({
        query: queryParams,
      });

      if (!response.ok) throw new Error('Failed to fetch tasks.');

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
