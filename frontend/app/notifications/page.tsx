"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { notificationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { RequireRole } from "@/components/require-role";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Loader2,
} from "lucide-react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

interface Notification {
  notificationId: string;
  title: string;
  message: string;
  status: string;
  category: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);

  async function loadNotifications() {
    try {
      setLoading(true);
      const userId = user?.userId || user?.id;
      if (userId) {
        const data = await notificationApi.getUserNotifications(userId).catch(() => []);
        setNotifications(data || []);
      }
    } catch {
      // silently ignore — show empty state
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  async function handleMarkAsRead(notificationId: string) {
    try {
      await notificationApi.markAsRead(notificationId);
      toast({ title: "Success", description: "Notification marked as read" });
      loadNotifications();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark as read",
        variant: "destructive",
      });
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "BID_DEADLINE": return <Clock className="h-4 w-4 text-amber-500" />;
      case "APPROVAL_PENDING": return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case "DELIVERY_UPDATE": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'PENDING').length;

  async function handleMarkAllAsRead() {
    const unread = notifications.filter(n => n.status === 'PENDING');
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map(n => notificationApi.markAsRead(n.notificationId)));
      toast({ title: "All marked as read", description: `${unread.length} notifications marked as read` });
      loadNotifications();
    } catch (err) {
      toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" });
    }
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-xs text-gray-500 mt-0.5">Stay up to date on approvals, deliveries, and deadlines</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleMarkAllAsRead}>
                Mark all as read
              </Button>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-600">
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              {unreadCount} unread
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="border border-gray-200 rounded p-12 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="border border-gray-200 rounded p-12 text-center">
              <Bell className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">You're all caught up</p>
              <p className="text-xs text-gray-400 mt-1">No notifications at this time.</p>
            </div>
          ) : null}

          {!loading && notifications.map((notification) => (
            <div
              key={notification.notificationId}
              className={`border border-gray-200 rounded p-4 transition-colors ${
                notification.status === "PENDING"
                  ? "border-l-4 border-l-primary bg-primary/[0.02]"
                  : "opacity-75"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {getCategoryIcon(notification.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={`text-xs font-medium ${notification.status === "PENDING" ? "text-gray-900" : "text-gray-600"}`}>
                        {notification.title}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{notification.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {notification.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-gray-200"
                          onClick={() => handleMarkAsRead(notification.notificationId)}
                        >
                          Mark Read
                        </Button>
                      )}
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        notification.status === "PENDING" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {notification.status === "PENDING" ? "Unread" : "Read"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
