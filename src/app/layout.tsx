import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://clawjin-prism.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Clawjin Prism — Real-Time E-Commerce Unit Economics",
  description:
    "Clawjin Prism unifies Shopify orders and paid media spend into one automated pipeline: blended CAC, ROAS, contribution margin, cohort retention and a daily executive briefing.",
  keywords: [
    "unit economics",
    "blended CAC",
    "ROAS",
    "contribution margin",
    "e-commerce analytics",
    "cohort retention",
    "Shopify analytics",
    "executive dashboard",
  ],
  openGraph: {
    title: "Clawjin Prism — Real-Time E-Commerce Unit Economics",
    description:
      "Automated blended CAC, ROAS, contribution margin, cohort retention and a daily executive briefing for e-commerce brands.",
    url: siteUrl,
    siteName: "Clawjin Prism",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clawjin Prism — Real-Time E-Commerce Unit Economics",
    description:
      "Automated unit-economics analytics and executive briefing for e-commerce brands.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0d] text-zinc-200 antialiased">{children}</body>
    </html>
  );
}
