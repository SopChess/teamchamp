import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team ALMA",
  description: "Διαχείριση ομαδικών σκακιστικών πρωταθλημάτων",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
