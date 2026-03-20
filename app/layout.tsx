import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import { Toaster } from "react-hot-toast"; // <-- 1. Import Toaster

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oracle X",
  description: "Enter the Arena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Navbar />
        {/* 2. Add Toaster here */}
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: { background: '#0f1423', color: '#fff', border: '1px solid #1f2937' },
            success: { iconTheme: { primary: '#06b6d4', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }} 
        />
      </body>
    </html>
  );
}