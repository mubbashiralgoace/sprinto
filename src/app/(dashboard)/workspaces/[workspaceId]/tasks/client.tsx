'use client';

import { useEffect } from 'react';
import { useQueryState } from 'nuqs';

import { useCurrent } from '@/features/auth/api/use-current';
import { useGetMembers } from '@/features/members/api/use-get-members';
import { TaskViewSwitcher } from '@/features/tasks/components/task-view-switcher';

interface TasksPageClientProps {
  workspaceId: string;
}

export const TasksPageClient = ({ workspaceId }: TasksPageClientProps) => {
  const { data: currentUser } = useCurrent();
  const { data: members } = useGetMembers({ workspaceId });
  const [assigneeId, setAssigneeId] = useQueryState('assigneeId');

  // Find current user's member ID
  const currentMember = members?.documents.find((member) => member.userId === currentUser?.$id);
  const currentMemberId = currentMember?.$id;

  // Set assigneeId to current user if not already set
  useEffect(() => {
    if (currentMemberId && !assigneeId) {
      setAssigneeId(currentMemberId);
    }
  }, [currentMemberId, assigneeId, setAssigneeId]);

  return (
    <div className="flex h-full flex-col">
      <TaskViewSwitcher />
    </div>
  );
};
