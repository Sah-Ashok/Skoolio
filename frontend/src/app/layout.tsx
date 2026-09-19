import type { Metadata } from "next";
import "./globals.css";
import StoreProvider from "@/store/StoreProvider";
import ToastNotification from "@/components/shared/ToastNotification";
import HeartbeatTracker from "@/components/shared/HeartbeatTracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://skoolio.app"),
  title: {
    default: "Skoolio — Modern All-in-One Cloud School Management System",
    template: "%s | Skoolio",
  },
  description:
    "Skoolio is a global cloud-based school management platform. Manage attendance, fees, exams, timetable, notices, staff salary, and more — all from one intuitive system.",
  keywords: [
    "school management system",
    "school management software",
    "cloud school ERP",
    "attendance management",
    "fee management software",
    "school ERP",
    "student information system",
    "Skoolio",
    "education management system",
    "school administration software",
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
    title: "Skoolio — Modern All-in-One Cloud School Management System",
    description:
      "The modern all-in-one cloud school management platform. Attendance, fees, exams, timetable, notices, and staff — connected in one unified system.",
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
    title: "Skoolio — Modern All-in-One Cloud School Management System",
    description:
      "The modern all-in-one cloud school management platform. Attendance, fees, exams, timetable, notices, and staff in one system.",
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
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#25343F" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <StoreProvider>
          <HeartbeatTracker />
          {children}
          <ToastNotification />
        </StoreProvider>
      </body>
    </html>
  );
}
