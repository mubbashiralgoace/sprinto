'use client';

import { ArrowLeft, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';

import { DottedSeparator } from '@/components/dotted-separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useDeleteMember } from '@/features/members/api/use-delete-member';
import { useGetMembers } from '@/features/members/api/use-get-members';
import { useUpdateMember } from '@/features/members/api/use-update-member';
import { MemberAvatar } from '@/features/members/components/member-avatar';
import { MemberRole } from '@/features/members/types';
import { useCurrent } from '@/features/auth/api/use-current';
import { useGetWorkspace } from '@/features/workspaces/api/use-get-workspace';
import { useWorkspaceId } from '@/features/workspaces/hooks/use-workspace-id';
import { useConfirm } from '@/hooks/use-confirm';

export const MembersList = () => {
  const workspaceId = useWorkspaceId();
  const [ConfirmDialog, confirm] = useConfirm('Remove member', 'This member will be removed from this workspace.', 'destructive');

  const { data: members } = useGetMembers({ workspaceId });
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { data: currentUser } = useCurrent();
  const { mutate: deleteMember, isPending: isDeletingMember } = useDeleteMember();
  const { mutate: updateMember, isPending: isUpdatingMember } = useUpdateMember();

  const handleDeleteMember = async (memberId: string) => {
    const ok = await confirm();

    if (!ok) return;

    deleteMember(
      { param: { memberId } },
      {
        onSuccess: () => {
          window.location.reload();
        },
      },
    );
  };

  const handleUpdateMember = (memberId: string, role: MemberRole) => {
    updateMember({
      json: { role },
      param: { memberId },
    });
  };

  const currentMember = members?.documents.find((member) => member.userId === currentUser?.$id);
  const isOwner = workspace?.userId === currentUser?.$id;
  const isAdmin = currentMember?.role === MemberRole.ADMIN;
  const isPending = isDeletingMember || isUpdatingMember || members?.documents.length === 1;

  return (
    <Card className="size-full border-none shadow-none">
      <ConfirmDialog />

      <CardHeader className="flex flex-row items-center gap-x-4 space-y-0 p-7">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/workspaces/${workspaceId}`}>
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>

        <CardTitle className="text-xl font-bold">Members list</CardTitle>
      </CardHeader>

      <div className="px-7">
        <DottedSeparator />
      </div>

      <CardContent className="p-7">
        {members?.documents.map((member, i) => {
          const isMemberOwner = workspace?.userId === member.userId;
          const canManageRoles = isOwner && !isMemberOwner;
          const canRemoveAsOwner = isOwner && !isMemberOwner;
          const canRemoveAsAdmin = isAdmin && !isOwner && member.role === MemberRole.MEMBER && !isMemberOwner;
          const canRemove = canRemoveAsOwner || canRemoveAsAdmin;
          const showMenu = canManageRoles || canRemove;

          return (
          <Fragment key={member.$id}>
            <div className="flex items-center gap-2">
              <MemberAvatar name={member.name} className="size-10" fallbackClassName="text-lg" />

              <div className="flex flex-col">
                <p className="text-sm font-medium">{member.name}</p>
                <p className="to-muted-foreground text-xs">{member.email}</p>
              </div>

              {showMenu && (
                <DropdownMenu>
                  <DropdownMenuTrigger disabled={isPending} asChild>
                    <Button title="View options" className="ml-auto" variant="secondary" size="icon">
                      <MoreVertical className="size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent side="bottom" align="end">
                    {canManageRoles && (
                      <DropdownMenuItem
                        className="font-medium"
                        onClick={() => handleUpdateMember(member.$id, MemberRole.ADMIN)}
                        disabled={isPending || member.role === MemberRole.ADMIN}
                      >
                        Set as Administrator
                      </DropdownMenuItem>
                    )}

                    {canManageRoles && (
                      <DropdownMenuItem
                        className="font-medium"
                        onClick={() => handleUpdateMember(member.$id, MemberRole.MEMBER)}
                        disabled={isPending || member.role === MemberRole.MEMBER}
                      >
                        Set as Member
                      </DropdownMenuItem>
                    )}

                    {canRemove && (
                      <DropdownMenuItem
                        className="font-medium text-amber-700"
                        onClick={() => handleDeleteMember(member.$id)}
                        disabled={isPending}
                      >
                        Remove {member.name}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {i < members.documents.length - 1 && <Separator className="my-2.5" />}
          </Fragment>
        );
        })}
      </CardContent>
    </Card>
  );
};
