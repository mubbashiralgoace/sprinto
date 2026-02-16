'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGetNotifications } from '@/features/notifications/api/use-get-notifications';
import { useMarkAllNotificationsRead } from '@/features/notifications/api/use-mark-all-notifications-read';
import { useMarkNotificationRead } from '@/features/notifications/api/use-mark-notification-read';
import { useWorkspaceId } from '@/features/workspaces/hooks/use-workspace-id';

export const NotificationsMenu = () => {
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetNotifications(workspaceId);
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

  const notifications = data?.data.documents ?? [];
  const unreadCount = data?.data.unreadCount ?? 0;

  const hasNotifications = notifications.length > 0;
  const canMarkAll = unreadCount > 0 && !isMarkingAll;

  const items = useMemo(() => notifications.slice(0, 20), [notifications]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <Badge className="absolute -right-1 -top-1 px-1.5 py-0 text-[10px]" variant="destructive">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!canMarkAll}
            onClick={() => markAllRead({ json: { workspaceId } })}
          >
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading...</div>
        ) : !hasNotifications ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications yet.</div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="py-1">
              {items.map((notification) => {
                const isUnread = !notification.read_at;
                const content = (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">{notification.title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">{notification.body}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(notification.$createdAt).toLocaleString()}
                    </span>
                  </div>
                );

                return (
                  <DropdownMenuItem
                    key={notification.$id}
                    className={isUnread ? 'bg-muted/40' : undefined}
                    onClick={() =>
                      markRead({
                        notificationId: notification.$id,
                        workspaceId,
                      })
                    }
                  >
                    {notification.link ? (
                      <Link href={notification.link} className="w-full">
                        {content}
                      </Link>
                    ) : (
                      <div className="w-full">{content}</div>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
