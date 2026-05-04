import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/components/protected-route";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ProcurePro - Enterprise Procurement Management",
  description: "Streamline your procurement process with RFQ management, vendor onboarding, purchase orders, and real-time analytics.",
  keywords: ["procurement", "RFQ", "vendor management", "purchase orders", "analytics"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={montserrat.variable}>
      <body className="font-sans antialiased text-[13px]">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
