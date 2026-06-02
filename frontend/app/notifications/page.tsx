"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { notificationApi } from "@/lib/api";
import { resolveNotificationRoute, isNotificationUnread } from "@/lib/notification-routes";
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
  ChevronRight,
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
  relatedEntityId?: string | null;
  actionUrl?: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const userId = user?.userId || user?.id;
    if (!userId) {
      setNotifications([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadError(null);
      const data = await notificationApi.getUserNotifications(userId);
      setNotifications(
        (data || []).map((n: Record<string, unknown>) => ({
          notificationId: String(n.notificationId ?? n.id ?? ""),
          title: String(n.title ?? ""),
          message: String(n.message ?? ""),
          status: String(n.status ?? ""),
          category: String(n.category ?? ""),
          relatedEntityId: n.relatedEntityId != null ? String(n.relatedEntityId) : null,
          actionUrl: n.actionUrl != null ? String(n.actionUrl) : null,
          createdAt: String(n.createdAt ?? new Date().toISOString()),
        }))
      );
    } catch (err) {
      setNotifications([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user, loadNotifications]);

  async function handleNotificationClick(notification: Notification) {
    const route = resolveNotificationRoute(notification);
    if (!route) {
      toast({
        title: "No linked page",
        description: "This notification does not have a destination.",
        variant: "destructive",
      });
      return;
    }

    setNavigatingId(notification.notificationId);
    try {
      if (isNotificationUnread(notification.status)) {
        await notificationApi.markAsRead(notification.notificationId).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) =>
            n.notificationId === notification.notificationId ? { ...n, status: "READ" } : n
          )
        );
      }
      router.push(route);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not open notification",
        variant: "destructive",
      });
    } finally {
      setNavigatingId(null);
    }
  }

  async function handleMarkAsRead(notificationId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
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
      case "BID_DEADLINE":
      case "RFQ":
      case "BID":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "APPROVAL_PENDING":
      case "PURCHASE_ORDER":
      case "APPROVAL":
        return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case "DELIVERY":
      case "DELIVERY_UPDATE":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const unreadCount = notifications.filter((n) => isNotificationUnread(n.status)).length;

  async function handleMarkAllAsRead() {
    const unread = notifications.filter((n) => isNotificationUnread(n.status));
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => notificationApi.markAsRead(n.notificationId)));
      toast({ title: "All marked as read", description: `${unread.length} notifications marked as read` });
      loadNotifications();
    } catch {
      toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" });
    }
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "VENDOR_LOGISTICS", "SUPER_ADMIN"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-xs text-gray-500 mt-0.5">Tap a notification to jump to the related page</p>
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

        {loadError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {loadError}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={loadNotifications}>
              Retry
            </Button>
          </div>
        )}

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

          {!loading && notifications.map((notification) => {
            const route = resolveNotificationRoute(notification);
            const unread = isNotificationUnread(notification.status);
            const isNavigating = navigatingId === notification.notificationId;

            return (
              <button
                key={notification.notificationId}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                disabled={!route || isNavigating}
                className={`w-full text-left border border-gray-200 rounded p-4 transition-colors ${
                  unread
                    ? "border-l-4 border-l-primary bg-primary/[0.02] hover:bg-primary/[0.04]"
                    : "opacity-75 hover:bg-gray-50"
                } ${route ? "cursor-pointer" : "cursor-default"} ${isNavigating ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {getCategoryIcon(notification.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`text-xs font-medium ${unread ? "text-gray-900" : "text-gray-600"}`}>
                          {notification.title}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {timeAgo(notification.createdAt)}
                          {route && (
                            <span className="ml-2 text-primary/70">Tap to open</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {unread && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-gray-200"
                            onClick={(e) => handleMarkAsRead(notification.notificationId, e)}
                          >
                            Mark Read
                          </Button>
                        )}
                        {route && (
                          isNavigating
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        )}
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          unread ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {unread ? "Unread" : "Read"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
