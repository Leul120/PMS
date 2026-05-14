import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-gray-900">ProcurePro</span>
        </Link>
        <Link href="/login" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Login
        </Link>
      </header>

      <div className="max-w-2xl mx-auto py-10 px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy</h1>
          <p className="text-xs text-gray-400 mt-1">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including your name, email address, company information, and how you use ProcurePro. We also collect usage data to improve the service.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
            <p>We use collected information to provide, maintain, and improve our services, send important notices, respond to support requests, and communicate product updates to you.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">3. Data Sharing</h2>
            <p>We do not sell, trade, or otherwise transfer your personally identifiable information to third parties without your consent, except as required to operate the service or comply with the law.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">4. Data Security</h2>
            <p>We implement appropriate technical and organisational security measures to protect your personal information from unauthorised access, alteration, disclosure, or destruction.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">5. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or how we handle your data, please contact us at <span className="text-primary">support@procurepro.com</span>.</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100">
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
