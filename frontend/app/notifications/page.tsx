"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notificationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle,
  Info,
  Clock
} from "lucide-react";

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
        const data = await notificationApi.getUserNotifications(userId);
        setNotifications(data || []);
      }
    } catch (err) {
      // Silently handle backend errors - show empty state instead of error toast
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
      case 'BID_DEADLINE': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'APPROVAL_PENDING': return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case 'DELIVERY_UPDATE': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'PENDING').length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-xs text-gray-500 mt-0.5">View and manage notifications</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-600">
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              {unreadCount} unread
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {notifications.length === 0 && !loading && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Bell className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-xs">No notifications yet</p>
              </CardContent>
            </Card>
          )}
          
          {notifications.map((notification) => (
            <Card key={notification.notificationId} className={`border-0 shadow-sm ${notification.status === 'PENDING' ? 'border-l-2 border-l-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getCategoryIcon(notification.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-medium text-gray-900">{notification.title}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{notification.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {notification.status === 'PENDING' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-6 text-[10px] px-2"
                            onClick={() => handleMarkAsRead(notification.notificationId)}
                          >
                            Mark Read
                          </Button>
                        )}
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          notification.status === 'PENDING' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {notification.status === 'PENDING' ? 'Unread' : 'Read'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
