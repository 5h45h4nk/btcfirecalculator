import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTC Wealth Projection Studio",
  description: "Project bitcoin wealth over the next 50 years using fixed and CAGR-based models."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
