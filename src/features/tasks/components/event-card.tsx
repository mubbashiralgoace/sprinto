import { useRouter } from 'next/navigation';

import { MemberAvatar } from '@/features/members/components/member-avatar';
import type { Member } from '@/features/members/types';
import { ProjectAvatar } from '@/features/projects/components/project-avatar';
import type { Project } from '@/features/projects/types';
import { TaskStatus } from '@/features/tasks/types';
import { useWorkspaceId } from '@/features/workspaces/hooks/use-workspace-id';
import { cn } from '@/lib/utils';

interface EventCardProps {
  title: string;
  assignee: Member | null | undefined;
  project: Project | null | undefined;
  status: TaskStatus;
  id: string;
}

const statusColorMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'border-l-red-500',
  [TaskStatus.IN_PROGRESS]: 'border-l-yellow-500',
  [TaskStatus.TESTING]: 'border-l-blue-500',
  [TaskStatus.BACKED_TODO]: 'border-l-slate-500',
  [TaskStatus.WAITING_FOR_BUILD]: 'border-l-violet-500',
  [TaskStatus.IMPROVEMENT]: 'border-l-emerald-500',
  [TaskStatus.SUGGESTION]: 'border-l-sky-500',
  [TaskStatus.INVALID]: 'border-l-neutral-500',
  [TaskStatus.UNABLE_TO_CHANGE]: 'border-l-orange-500',
  [TaskStatus.UNABLE_TO_REPLICATE]: 'border-l-zinc-500',
  [TaskStatus.NOT_MENTIONED_BY_PM]: 'border-l-fuchsia-500',
  [TaskStatus.DONE]: 'border-l-green-500',
};

export const EventCard = ({ title, assignee, project, status, id }: EventCardProps) => {
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    router.push(`/workspaces/${workspaceId}/tasks/${id}`);
  };

  return (
    <div className="px-2">
      <button
        onClick={onClick}
        className={cn(
          'flex cursor-pointer flex-col gap-y-1.5 rounded-md border border-l-4 bg-white p-1.5 text-xs text-primary transition hover:opacity-75',
          statusColorMap[status],
        )}
      >
        <p>{title}</p>

        <div className="flex items-center gap-x-1">
          <MemberAvatar name={assignee?.name ?? 'User'} />

          <div aria-hidden className="size-1 rounded-full bg-neutral-300" />
          <ProjectAvatar name={project?.name ?? 'Project'} image={project?.imageUrl} />
        </div>
      </button>
    </div>
  );
};
