import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        
        <section className="space-y-4 text-gray-700">
          <h2 className="text-xl font-semibold mt-6">1. Acceptance of Terms</h2>
          <p>By accessing or using ProcurePro, you agree to be bound by these Terms of Service.</p>
          
          <h2 className="text-xl font-semibold mt-6">2. Use of Service</h2>
          <p>You agree to use the service only for lawful purposes and in accordance with these terms.</p>
          
          <h2 className="text-xl font-semibold mt-6">3. Account Security</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
          
          <h2 className="text-xl font-semibold mt-6">4. Limitation of Liability</h2>
          <p>ProcurePro shall not be liable for any indirect, incidental, or consequential damages.</p>
        </section>
        
        <div className="mt-8 pt-6 border-t">
          <Link href="/login" className="text-primary hover:underline">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
