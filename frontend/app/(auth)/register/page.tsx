"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2, Building2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    company: "",
    role: "VENDOR", // Public registration defaults to VENDOR role
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Format data for API - backend expects fullName, not firstName/lastName
      const apiData = {
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        roleName: formData.role, // VENDOR is the only allowed role for public registration
      };
      await authApi.register(apiData);
      toast({
        title: "Account created!",
        description: "Please sign in with your new credentials.",
      });
      router.push("/login");
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    "Unlimited RFQs and bids",
    "Real-time vendor analytics",
    "Advanced reporting tools",
    "24/7 priority support",
  ];

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
              Start Your Procurement Journey
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Join thousands of companies streamlining their procurement process.
            </p>
            <div className="space-y-2 pt-2">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-xs">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <span className="text-primary-foreground/90">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-primary-foreground/60">
            Join 2,000+ companies already using ProcurePro
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
              <h2 className="text-base font-semibold text-gray-900">Create account</h2>
              <p className="text-xs text-gray-500">Start your 14-day free trial</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 pb-4 space-y-3">
                {step === 1 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="firstName" className="text-xs">First name</Label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <Input
                            id="firstName"
                            placeholder="John"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            required
                            className="h-8 text-xs border-gray-200 pl-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lastName" className="text-xs">Last name</Label>
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          required
                          className="h-8 text-xs border-gray-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="h-8 text-xs border-gray-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="company" className="text-xs">Company name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          id="company"
                          placeholder="Acme Inc."
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="h-8 text-xs border-gray-200 pl-8"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full h-8 text-xs font-medium"
                      onClick={() => setStep(2)}
                      disabled={!formData.firstName || !formData.lastName || !formData.email}
                    >
                      Continue
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs">Create password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min 8 characters"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                          minLength={8}
                          maxLength={20}
                          className="h-8 text-xs border-gray-200 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </Button>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        8–20 characters with letters and numbers
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 h-8 text-xs font-medium"
                        disabled={isLoading || formData.password.length < 8 || formData.password.length > 20}
                      >
                        {isLoading ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

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

            <div className="px-6 pb-5">
              <p className="text-center text-xs text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:text-primary/80">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[10px] text-gray-400">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-600">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
