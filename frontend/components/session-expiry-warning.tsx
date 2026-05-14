"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

function getTokenExpiryMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function SessionExpiryWarning() {
  const { token, isAuthenticated } = useAuthStore();
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setMinutesLeft(null);
      return;
    }

    const expiryMs = getTokenExpiryMs(token);
    if (!expiryMs) return;

    function check() {
      const remaining = expiryMs! - Date.now();
      if (remaining <= 0) {
        setMinutesLeft(0);
      } else if (remaining <= WARNING_THRESHOLD_MS) {
        setMinutesLeft(Math.ceil(remaining / 60_000));
        setDismissed(false); // re-show if time keeps ticking down
      } else {
        setMinutesLeft(null);
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [token, isAuthenticated]);

  if (minutesLeft === null || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full shadow-lg rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          {minutesLeft <= 1 ? "Session expiring now" : `Session expires in ${minutesLeft} min`}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Save your work and sign in again to continue.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-amber-700 hover:bg-amber-100 shrink-0"
        onClick={() => setDismissed(true)}
      >
        ✕
      </Button>
    </div>
  );
}
