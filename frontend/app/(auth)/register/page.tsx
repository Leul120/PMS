"use client";

import Link from "next/link";
import { Sparkles, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side */}
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
              Secure, Invite-Only Access
            </h1>
            <p className="text-sm text-primary-foreground/80">
              ProcurePro accounts are managed by your organization. Your administrator will set up your account and send you credentials to get started.
            </p>
            <div className="flex gap-3 pt-2 text-xs">
              <span className="px-2.5 py-1 bg-white/20 rounded">Enterprise Security</span>
              <span className="px-2.5 py-1 bg-white/20 rounded">Tenant Isolation</span>
            </div>
          </div>

          <p className="text-xs text-primary-foreground/60">
            Trusted by 500+ enterprise clients
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">ProcurePro</span>
          </div>

          <div className="border border-gray-200 rounded bg-white px-6 py-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">Access is by invitation only</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Accounts on ProcurePro are created by your organization&apos;s administrator.
                Self-registration is not available.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded p-3 text-left space-y-1.5">
              <p className="text-[11px] font-medium text-blue-800">How to get access</p>
              <ol className="text-[10px] text-blue-700 space-y-1 list-decimal list-inside">
                <li>Contact your organization&apos;s IT or procurement admin</li>
                <li>They will create your account and share your credentials</li>
                <li>Sign in using your email, password, and organization domain</li>
                <li>Change your password after your first login</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded p-2.5">
              <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-[10px] text-gray-500">
                If you&apos;re unsure who your admin is, check with your IT or HR department.
              </p>
            </div>

            <Button asChild className="w-full h-9 text-xs">
              <Link href="/login">Go to Sign In</Link>
            </Button>
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
