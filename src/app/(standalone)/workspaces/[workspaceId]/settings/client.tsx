'use client';

import Link from 'next/link';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { useCurrent } from '@/features/auth/api/use-current';
import { useGetMembers } from '@/features/members/api/use-get-members';
import { MemberRole } from '@/features/members/types';
import { useGetWorkspace } from '@/features/workspaces/api/use-get-workspace';
import { EditWorkspaceForm } from '@/features/workspaces/components/edit-workspace-form';
import { useWorkspaceId } from '@/features/workspaces/hooks/use-workspace-id';

export const WorkspaceIdSettingsClient = () => {
  const workspaceId = useWorkspaceId();

  const { data: initialValues, isLoading } = useGetWorkspace({ workspaceId });
  const { data: currentUser, isLoading: isLoadingUser } = useCurrent();
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

  const isLoadingPage = isLoading || isLoadingUser || isLoadingMembers;

  if (isLoadingPage) return <PageLoader />;

  if (!initialValues) return <PageError message="Workspace not found." />;

  const currentMember = members?.documents.find((member) => member.userId === currentUser?.$id);
  const isOwner = currentUser?.$id === initialValues.userId;
  const isAdmin = currentMember?.role === MemberRole.ADMIN;

  if (!isOwner && !isAdmin) {
    return (
      <div className="w-full lg:max-w-xl">
        <div className="mb-4">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/workspaces/${workspaceId}`}>Back</Link>
          </Button>
        </div>
        <PageError message="You do not have permission to view this page." />
      </div>
    );
  }

  return (
    <div className="w-full lg:max-w-xl">
      <EditWorkspaceForm initialValues={initialValues} />
    </div>
  );
};
