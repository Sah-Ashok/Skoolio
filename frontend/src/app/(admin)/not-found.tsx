"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NotFound() {
  const router = useRouter();
  const [count, setCount] = useState(10);

  // auto-redirect countdown
  useEffect(() => {
    if (count <= 0) { router.push("/dashboard"); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, router]);

  return (
    <div style={{
      minHeight: "calc(100vh - 80px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "#f4f6f7",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 560,
        background: "#fff",
        borderRadius: 20,
        padding: "48px 40px",
        boxShadow: "0 4px 32px rgba(37,52,63,0.09)",
        textAlign: "center",
      }}>

        {/* Big 404 number */}
        <div style={{
          fontSize: 100,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -4,
          background: "linear-gradient(135deg, #ff9b51 0%, #f97316 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 8,
          userSelect: "none",
        }}>
          404
        </div>

        {/* Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "#fff7ed",
          border: "1.5px solid #fed7aa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <i className="fa-solid fa-map-location-dot" style={{ fontSize: 26, color: "#f97316" }} />
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 900,
          color: "#1e293b",
          margin: "0 0 10px",
        }}>
          Page Not Found
        </h1>

        <p style={{
          fontSize: 14,
          color: "#64748b",
          fontWeight: 600,
          lineHeight: 1.6,
          margin: "0 0 28px",
        }}>
          The page you're looking for doesn't exist or has been moved.
          <br />
          Check the URL or head back to a familiar place.
        </p>

        {/* Quick links */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 28,
        }}>
          {[
            { href: "/dashboard",  icon: "fa-gauge-high",          label: "Dashboard"    },
            { href: "/students",   icon: "fa-user-graduate",       label: "Students"     },
            { href: "/classes",    icon: "fa-school",              label: "Classes"      },
            { href: "/fees",       icon: "fa-file-invoice-dollar", label: "Fee Manager"  },
          ].map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderRadius: 10,
                border: "1.5px solid #e2e8f0",
                background: "#f8fafc",
                color: "#1e293b",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                transition: "border-color .15s, background .15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#ff9b51";
                (e.currentTarget as HTMLElement).style.background  = "#fff7ed";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
                (e.currentTarget as HTMLElement).style.background  = "#f8fafc";
              }}
            >
              <span style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: "#fff3e8",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <i className={`fa-solid ${icon}`} style={{ fontSize: 12, color: "#f97316" }} />
              </span>
              {label}
            </Link>
          ))}
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 10,
            border: "1.5px solid #1e293b",
            background: "#1e293b",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            marginBottom: 16,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <i className="fa-solid fa-arrow-left" />
          Go Back
        </button>

        {/* Auto redirect */}
        <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
          Redirecting to Dashboard in{" "}
          <span style={{ color: "#f97316", fontWeight: 900 }}>{count}s</span>
        </p>

        {/* Progress bar */}
        <div style={{
          marginTop: 8,
          height: 4,
          borderRadius: 999,
          background: "#f1f5f9",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${(count / 10) * 100}%`,
            background: "linear-gradient(90deg, #ff9b51, #f97316)",
            borderRadius: 999,
            transition: "width 1s linear",
          }} />
        </div>

      </div>
    </div>
  );
}
