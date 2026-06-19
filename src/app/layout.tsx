import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Position Tracker",
  description: "Track your job applications from wishlist to offer.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
