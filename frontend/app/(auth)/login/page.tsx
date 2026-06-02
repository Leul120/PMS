"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getDashboardByRole } from "@/components/require-role";
import { mapLoginToUser, sessionMetaFromLogin } from "@/lib/login-response";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authApi.login(email, password, tenantDomain.trim() || undefined);
      const user = mapLoginToUser(response);
      const meta = sessionMetaFromLogin(response);
      setAuth(user, response.accessToken, meta.tenant, {
        organizationType: meta.organizationType,
        operatingContext: meta.operatingContext,
        availableContexts: meta.availableContexts,
        supplierRole: meta.supplierRole,
      });
      // Store remember-me preference so the session persists across browser restarts
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberMe");
        // For non-remember-me, also store a session flag so ProtectedRoute can
        // clear auth on next cold load if the tab was fully closed
        sessionStorage.setItem("sessionActive", "true");
      }
      if (response.mustChangePassword) {
        toast({
          title: "Welcome! Please change your password",
          description: "Your administrator requires you to set a new password before continuing.",
        });
        router.push("/settings?tab=security&changePassword=1");
      } else {
        toast({
          title: "Welcome back!",
          description: `Signed in as ${user.firstName} ${user.lastName}`,
        });
        const dashboardPath = getDashboardByRole(user.role);
        router.push(dashboardPath);
      }
    } catch (error) {
      toast({
        title: "Authentication failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary">
        <div className="flex flex-col justify-between p-10 text-primary-foreground w-full">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold">ProcurePro</span>
          </Link>

          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl font-semibold leading-tight">
              Streamline Your Procurement
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Connect with verified vendors, manage RFQs, and track deliveries in one platform.
            </p>
            <div className="flex gap-3 pt-2 text-xs">
              <span className="px-2.5 py-1 bg-white/20 rounded">Enterprise Security</span>
              <span className="px-2.5 py-1 bg-white/20 rounded">Real-time Analytics</span>
            </div>
          </div>

          <p className="text-xs text-primary-foreground/60">
            Trusted by 500+ enterprise clients
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">ProcurePro</span>
          </div>

          <div className="border border-gray-200 rounded bg-white">
            <div className="px-6 pt-5 pb-4 text-center space-y-1">
              <h2 className="text-base font-semibold text-gray-900">Sign in</h2>
              <p className="text-xs text-gray-500">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 pb-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9 text-xs border-gray-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-9 text-xs border-gray-200 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenantDomain" className="text-xs font-medium">
                    Organization domain
                  </Label>
                  <Input
                    id="tenantDomain"
                    type="text"
                    placeholder="e.g. acme.com"
                    value={tenantDomain}
                    onChange={(e) => setTenantDomain(e.target.value)}
                    className="h-9 text-xs border-gray-200"
                  />
                  <p className="text-[10px] text-gray-400">
                    Required for organization accounts. Leave empty only if signing into the default workspace.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(!!v)}
                      className="h-3.5 w-3.5 border-gray-300"
                    />
                    <Label htmlFor="remember" className="text-xs font-normal text-gray-500">
                      Remember me
                    </Label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary font-medium hover:text-primary/80"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full h-9 text-xs font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-2 text-gray-400">SSO coming soon</span>
                  </div>
                </div>
              </div>
            </form>

            <div className="px-6 pb-5 space-y-2">
              <p className="text-center text-xs text-gray-500">
                No account?{" "}
                <span className="text-gray-400">Contact your organization administrator.</span>
              </p>
              <p className="text-center text-xs text-gray-500">
                Are you a vendor?{" "}
                <Link href="/vendor-register" className="text-primary font-medium hover:text-primary/80">
                  Register your company
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[10px] text-gray-400">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-600">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
