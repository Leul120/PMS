import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        
        <section className="space-y-4 text-gray-700">
          <h2 className="text-xl font-semibold mt-6">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, including name, email, company information, and usage data.</p>
          
          <h2 className="text-xl font-semibold mt-6">2. How We Use Your Information</h2>
          <p>We use the information to provide, maintain, and improve our services, and to communicate with you.</p>
          
          <h2 className="text-xl font-semibold mt-6">3. Data Security</h2>
          <p>We implement appropriate security measures to protect your personal information.</p>
          
          <h2 className="text-xl font-semibold mt-6">4. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at support@procurepro.com.</p>
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
