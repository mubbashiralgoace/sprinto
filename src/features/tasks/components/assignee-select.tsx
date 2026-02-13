'use client';

import { useEffect, useMemo, useState } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetMembers } from '@/features/members/api/use-get-members';
import { MemberAvatar } from '@/features/members/components/member-avatar';
import { useUpdateTask } from '@/features/tasks/api/use-update-task';
import { cn } from '@/lib/utils';

interface AssigneeSelectProps {
  taskId: string;
  workspaceId: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  triggerClassName?: string;
}

export const AssigneeSelect = ({ taskId, workspaceId, assigneeId, assigneeName, triggerClassName }: AssigneeSelectProps) => {
  const { data: members } = useGetMembers({ workspaceId });
  const { mutate: updateTask, isPending } = useUpdateTask();
  const [selectedId, setSelectedId] = useState<string | null>(assigneeId ?? null);

  useEffect(() => {
    setSelectedId(assigneeId ?? null);
  }, [assigneeId]);

  const memberOptions = members?.documents ?? [];

  const selectedMember = useMemo(
    () => memberOptions.find((member) => member.$id === selectedId),
    [memberOptions, selectedId],
  );

  const displayName = selectedMember?.name ?? assigneeName ?? 'Unassigned';

  const handleChange = (memberId: string) => {
    setSelectedId(memberId);

    if (memberId === assigneeId) return;

    updateTask({
      param: { taskId },
      json: { assigneeId: memberId },
    });
  };

  return (
    <Select value={selectedId ?? undefined} onValueChange={handleChange} disabled={isPending || memberOptions.length === 0}>
      <SelectTrigger
        className={cn(
          'h-6 min-w-[40px] gap-x-2 border-transparent bg-transparent px-2 text-xs font-medium text-neutral-800 shadow-none hover:bg-muted/70',
          triggerClassName,
        )}
      >
        <div className="flex items-center gap-x-2">
          <MemberAvatar name={displayName} className="size-4" fallbackClassName="text-[9px]" />
          <span className="text-xs">
            <SelectValue placeholder="Unassigned">{displayName}</SelectValue>
          </span>
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-52 w-[180px]" position="popper" side="bottom" align="end" sideOffset={4}>
        {memberOptions.map((member) => (
          <SelectItem
            key={member.$id}
            value={member.$id}
            className="pr-7 py-1 text-xs [&>span:first-child]:right-5 [&>span:first-child]:h-3 [&>span:first-child]:w-3 [&>span:first-child_svg]:h-3 [&>span:first-child_svg]:w-3"
          >
            <div className="flex items-center gap-x-2">
              <MemberAvatar name={member.name} className="size-4" fallbackClassName="text-[9px]" />
              <span className="text-xs">{member.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
