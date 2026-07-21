"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Global not-found page — shown for routes that don't match any layout group.
 * Renders without sidebar/footer since we don't know what role the user is.
 * The (admin) layout has its own not-found.tsx which inherits the full shell.
 */
export default function GlobalNotFound() {
  const router = useRouter();
  const [count, setCount] = useState(8);

  useEffect(() => {
    if (count <= 0) { router.push("/"); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#f4f6f7",
      padding: "2rem",
      fontFamily: "inherit",
    }}>
      {/* Logo */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 40,
      }}>
        <div style={{
          width: 38, height: 38,
          borderRadius: 10,
          background: "#ff9b51",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="fa-solid fa-graduation-cap" style={{ color: "#fff", fontSize: 18 }} />
        </div>
        <strong style={{ fontSize: 20, fontWeight: 900, color: "#1e293b" }}>Skoolio</strong>
      </div>

      <div style={{
        width: "100%",
        maxWidth: 500,
        background: "#fff",
        borderRadius: 20,
        padding: "48px 36px",
        boxShadow: "0 4px 32px rgba(37,52,63,0.09)",
        textAlign: "center",
      }}>
        {/* 404 */}
        <div style={{
          fontSize: 96,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -4,
          background: "linear-gradient(135deg, #ff9b51 0%, #f97316 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 12,
          userSelect: "none",
        }}>
          404
        </div>

        <div style={{
          width: 58, height: 58,
          borderRadius: 16,
          background: "#fff7ed",
          border: "1.5px solid #fed7aa",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px",
        }}>
          <i className="fa-solid fa-compass" style={{ fontSize: 24, color: "#f97316" }} />
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", margin: "0 0 8px" }}>
          Page Not Found
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.6, margin: "0 0 28px" }}>
          This page doesn't exist or you may not have access to it.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => router.back()}
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              background: "#f8fafc",
              color: "#1e293b",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <i className="fa-solid fa-arrow-left" /> Go Back
          </button>
          <Link
            href="/"
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: 10,
              border: "none",
              background: "#1e293b",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              textDecoration: "none",
            }}
          >
            <i className="fa-solid fa-house" /> Home
          </Link>
        </div>

        {/* Countdown */}
        <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, marginBottom: 8 }}>
          Returning home in <span style={{ color: "#f97316", fontWeight: 900 }}>{count}s</span>
        </p>
        <div style={{ height: 4, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${(count / 8) * 100}%`,
            background: "linear-gradient(90deg, #ff9b51, #f97316)",
            borderRadius: 999,
            transition: "width 1s linear",
          }} />
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
        © {new Date().getFullYear()} Skoolio · Smart School Management
      </p>
    </div>
  );
}
