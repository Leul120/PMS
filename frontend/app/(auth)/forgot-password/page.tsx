"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitted(true);
    setIsLoading(false);
    toast({
      title: "Reset link sent",
      description: "Check your email for password reset instructions.",
    });
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Visual */}
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
              Password Recovery
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Enter your email and we&apos;ll send you reset instructions.
            </p>
            
            <div className="flex flex-col gap-2 pt-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-medium">1</div>
                <span className="text-primary-foreground/90">Enter your email</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-medium">2</div>
                <span className="text-primary-foreground/90">Check your inbox</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-medium">3</div>
                <span className="text-primary-foreground/90">Create new password</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-primary-foreground/60">
            Need help? Contact support
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

          <Card className="border-0 shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg font-semibold text-center">
                Reset password
              </CardTitle>
              <CardDescription className="text-center text-xs text-gray-500">
                Enter your email for reset instructions
              </CardDescription>
            </CardHeader>

            <CardContent>
              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">
                      Email address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-8 text-xs border-gray-200 pl-8"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-8 text-xs font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Reset password
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>

                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to login
                  </Link>
                </form>
              ) : (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Check your email</h3>
                    <p className="text-xs text-gray-500">
                      We&apos;ve sent a reset link to{" "}
                      <span className="font-medium text-gray-700">{email}</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => setIsSubmitted(false)}
                    >
                      Didn&apos;t receive it? Resend
                    </Button>
                    <Link
                      href="/login"
                      className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to login
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-[10px] text-gray-400">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
