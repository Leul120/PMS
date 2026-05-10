"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid link",
        description: "This password reset link is invalid or has expired.",
        variant: "destructive",
      });
    }
  }, [token]);

  const passwordsMatch = password === confirm;
  const isValid = password.length >= 8 && passwordsMatch && !!token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setIsSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      toast({
        title: "Reset failed",
        description: err instanceof Error ? err.message : "The link may have expired. Request a new one.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">ProcurePro</span>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-center">
              {isSuccess ? "Password Reset!" : "Set New Password"}
            </CardTitle>
            <CardDescription className="text-center text-xs text-gray-500">
              {isSuccess
                ? "Your password has been updated. Redirecting to login..."
                : "Enter your new password below."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="text-xs text-gray-500 text-center">
                  You can now sign in with your new password.
                </p>
                <Button size="sm" className="text-xs h-8 w-full" onClick={() => router.push("/login")}>
                  Go to Login
                </Button>
              </div>
            ) : !token ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <p className="text-xs text-gray-500 text-center">
                  This reset link is invalid or has expired.
                </p>
                <Button size="sm" variant="outline" className="text-xs h-8 w-full" asChild>
                  <Link href="/forgot-password">Request New Link</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="h-8 text-xs border-gray-200 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5 text-gray-400" /> : <Eye className="h-3.5 w-3.5 text-gray-400" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-xs">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat new password"
                      required
                      className={`h-8 text-xs border-gray-200 pr-10 ${confirm && !passwordsMatch ? "border-red-300" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff className="h-3.5 w-3.5 text-gray-400" /> : <Eye className="h-3.5 w-3.5 text-gray-400" />}
                    </Button>
                  </div>
                  {confirm && !passwordsMatch && (
                    <p className="text-[10px] text-red-500">Passwords do not match</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-8 text-xs font-medium" disabled={isLoading || !isValid}>
                  {isLoading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : "Reset Password"}
                </Button>

                <p className="text-center text-xs text-gray-500">
                  <Link href="/login" className="font-medium text-primary hover:text-primary/80">
                    Back to login
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
