"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Sparkles, Building2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";

const EMPTY_FORM = {
  companyName: "",
  contactPerson: "",
  email: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
  orgDomain: "",
};

function VendorRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [form, setForm] = useState({ ...EMPTY_FORM, orgDomain: searchParams.get("org") || "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (!form.orgDomain.trim()) {
      toast({ title: "Organisation domain is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({
        fullName: `${form.contactPerson}`.trim() || form.companyName,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber || undefined,
        roleName: "VENDOR_ADMIN",
        tenantDomain: form.orgDomain.trim(),
        companyName: form.companyName.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      toast({
        title: "Registration failed",
        description: err instanceof Error ? err.message : "Could not complete registration",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="border border-gray-200 rounded bg-white px-6 py-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-amber-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Registration submitted</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your vendor application for{" "}
            <span className="font-medium text-gray-700">{form.companyName || form.orgDomain}</span>{" "}
            has been received and is awaiting approval from the super admin.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded p-3 text-left space-y-1">
          <p className="text-[11px] font-medium text-amber-800">What happens next?</p>
          <ol className="text-[10px] text-amber-700 space-y-1 list-decimal list-inside">
            <li>The super admin will review your application</li>
            <li>You will be notified once your account is approved</li>
            <li>Sign in as <strong>Vendor Admin</strong> and complete your company profile</li>
            <li>Invite your sales and finance team members from settings</li>
          </ol>
        </div>
        <p className="text-[10px] text-gray-400">You cannot sign in until your account is approved.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded bg-white">
      <div className="px-6 pt-5 pb-4 text-center space-y-1">
        <h2 className="text-base font-semibold text-gray-900">Vendor registration</h2>
        <p className="text-xs text-gray-500">Register your company to participate in procurement</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="px-6 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="orgDomain" className="text-xs font-medium">
              Your organisation domain <span className="text-red-500">*</span>
            </Label>
            <Input
              id="orgDomain"
              type="text"
              placeholder="e.g. acme-supplies"
              value={form.orgDomain}
              onChange={set("orgDomain")}
              required
              className="h-9 text-xs border-gray-200"
            />
            <p className="text-[10px] text-gray-400">
              A unique identifier for your company (e.g. <strong>acme-supplies</strong>). If your organisation is not yet registered, it will be created and pending approval.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-xs font-medium">
              Company name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyName"
              placeholder="Acme Supplies Ltd."
              value={form.companyName}
              onChange={set("companyName")}
              required
              className="h-9 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactPerson" className="text-xs font-medium">
              Contact person <span className="text-red-500">*</span>
            </Label>
            <Input
              id="contactPerson"
              placeholder="Jane Smith"
              value={form.contactPerson}
              onChange={set("contactPerson")}
              required
              className="h-9 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">
              Work email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@yourcompany.com"
              value={form.email}
              onChange={set("email")}
              required
              className="h-9 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber" className="text-xs font-medium">Phone</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+1 234 567 890"
              value={form.phoneNumber}
              onChange={set("phoneNumber")}
              className="h-9 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={set("password")}
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
            <Label htmlFor="confirmPassword" className="text-xs font-medium">
              Confirm password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                required
                className="h-9 text-xs border-gray-200 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? (
                  <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-9 text-xs font-medium"
            disabled={submitting}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Register as vendor
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="px-6 pb-5">
        <p className="text-center text-xs text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:text-primary/80">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VendorRegisterPage() {
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
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-2">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-semibold leading-tight">
              Join as a Vendor
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Register your company to receive RFQs, submit quotations, and grow your business through verified procurement channels.
            </p>
            <div className="space-y-2 pt-2">
              {[
                "Receive targeted RFQs matching your categories",
                "Submit competitive quotations digitally",
                "Track order status in real time",
                "Get paid faster with transparent invoicing",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-primary-foreground/80">
                  <span className="mt-0.5 flex-shrink-0">✓</span>
                  <span>{item}</span>
                </div>
              ))}
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

          <Suspense fallback={null}>
            <VendorRegisterForm />
          </Suspense>

          <p className="mt-6 text-center text-[10px] text-gray-400">
            By registering, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-600">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
