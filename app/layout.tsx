import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"; // <-- 1. TAMBAHAN IMPORT

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Laboratorium UNISA Palembang',
  description: 'Sistem peminjaman laboratorium Universitas Aisyiyah Palembang',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: any) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}>
        <Navbar /> {/* <-- 2. TAMBAHAN NAVBAR */}
        {children}
      </body>
    </html>
  );
}