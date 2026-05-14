import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function TermsPage() {
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
          <h1 className="text-2xl font-semibold text-gray-900">Terms of Service</h1>
          <p className="text-xs text-gray-400 mt-1">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using ProcurePro, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">2. Use of Service</h2>
            <p>You agree to use the service only for lawful purposes and in accordance with these terms. You must not use ProcurePro to transmit any material that is unlawful, harmful, or otherwise objectionable.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">3. Account Security</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorised use of your account.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">4. Limitation of Liability</h2>
            <p>ProcurePro shall not be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of the service, even if advised of the possibility of such damages.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">5. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
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
