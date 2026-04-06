import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SNPL",
  description: "Buy now. Pay on your schedule.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black antialiased">{children}</body>
    </html>
  );
}
