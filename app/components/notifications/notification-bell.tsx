'use client';

// Notification bell icon with badge and popover dropdown

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from './use-notifications';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const { data } = useNotifications();

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs bg-purple-500 text-white hover:bg-purple-600 border-purple-500"
              data-testid="notification-badge"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-16px)] max-w-[380px] p-0 max-h-[calc(100vh-80px)]"
        sideOffset={8}
      >
        <NotificationDropdown />
      </PopoverContent>
    </Popover>
  );
}
