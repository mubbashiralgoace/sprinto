import { redirect } from 'next/navigation';

import { getCurrent } from '@/features/auth/queries';
import { getMember } from '@/features/members/utils';
import { TaskViewSwitcher } from '@/features/tasks/components/task-view-switcher';
import { TasksPageClient } from './client';

interface TasksPageProps {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const TasksPage = async ({ params, searchParams }: TasksPageProps) => {
  const user = await getCurrent();

  if (!user) redirect('/sign-in');

  const { workspaceId } = await params;

  return (
    <TasksPageClient workspaceId={workspaceId} />
  );
};
export default TasksPage;
