import type { Metadata } from "next";
import "./globals.css";
import StoreProvider from "@/store/StoreProvider";
import ToastNotification from "@/components/shared/ToastNotification";

export const metadata: Metadata = {
  metadataBase: new URL("https://skoolio.app"),
  title: {
    default: "Skoolio — School Management System for Nepal & India",
    template: "%s | Skoolio",
  },
  description:
    "Skoolio is a cloud-based school management platform built for schools in Nepal and India. Manage attendance, fees, exams, transport, hostel, staff salary, and more — all from one system.",
  keywords: [
    "school management system",
    "school management software Nepal",
    "school management system India",
    "attendance management",
    "fee management software",
    "school ERP Nepal",
    "school ERP India",
    "student information system",
    "Skoolio",
    "BS calendar school",
    "Nepali school software",
  ],
  authors: [{ name: "Skoolio", url: "https://skoolio.app" }],
  creator: "Skoolio",
  publisher: "Skoolio",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://skoolio.app",
    siteName: "Skoolio",
    title: "Skoolio — School Management System for Nepal & India",
    description:
      "The all-in-one school management platform. Attendance, fees, exams, transport, hostel, and staff — connected in one cloud system.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Skoolio School Management System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skoolio — School Management System for Nepal & India",
    description:
      "The all-in-one school management platform for Nepal and India. Attendance, fees, exams, transport, hostel, and staff in one system.",
    images: ["/og-image.png"],
    creator: "@skoolio",
  },
  alternates: {
    canonical: "https://skoolio.app",
  },
  category: "education",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Playfair+Display:wght@600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#25343F" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <StoreProvider>
          {children}
          <ToastNotification />
        </StoreProvider>
      </body>
    </html>
  );
}
