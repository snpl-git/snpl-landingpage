import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule Now, Pay Later – Holiday Edition",
  description: "Lock in holiday gifts now. Pay when you’re ready.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream text-gray-900">{children}</body>
    </html>
  );
}
