"use client";

import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

interface Props {
  /** Current image URL (shows as preview) */
  currentUrl?:  string | null;
  /** POST endpoint, e.g. "/upload/logo" or "/upload/teacher-photo/7" */
  endpoint:     string;
  /** Called with the new URL after a successful upload */
  onSuccess:    (url: string) => void;
  /** 'circle' for person avatars, 'rounded' for logos */
  shape?:       "circle" | "rounded";
  /** Preview size in px (default 100) */
  size?:        number;
  /** Fallback initials when no photo */
  initials?:    string;
  /** Accent colour for the initials avatar bg */
  accentColor?: string;
  label?:       string;
}

export default function ImageUpload({
  currentUrl,
  endpoint,
  onSuccess,
  shape        = "circle",
  size         = 100,
  initials     = "?",
  accentColor  = "#FF9B51",
  label        = "Change Photo",
}: Props) {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const borderRadius = shape === "circle" ? "50%" : 14;

  const handleClick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG or WebP images allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB.");
      return;
    }

    setError(null);

    // Optimistic preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      // Use fetch directly for multipart (apiRequest uses JSON by default)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}${endpoint}`,
        {
          method:      "POST",
          body:        formData,
          credentials: "include",
        }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Upload failed.");
      }

      const json = await res.json();
      const url: string = json.data?.url;
      if (!url) throw new Error("No URL returned from server.");

      setPreview(url);
      onSuccess(url);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
      // Revert to original on error
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* Preview / Avatar */}
      <div
        onClick={handleClick}
        style={{
          width: size, height: size, borderRadius,
          cursor: uploading ? "default" : "pointer",
          position: "relative", overflow: "hidden", flexShrink: 0,
          background: accentColor,
          border: "3px solid #fff",
          boxShadow: "0 2px 12px rgba(37,52,63,0.18)",
          transition: "box-shadow 0.15s",
        }}
        title={label}
      >
        {/* Photo or initials */}
        {preview ? (
          <img
            src={preview}
            alt="profile"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={() => setPreview(null)}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.34, fontWeight: 900, color: "#fff",
          }}>
            {initials.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Hover overlay */}
        {!uploading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.42)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            opacity: 0, transition: "opacity 0.18s",
            color: "#fff", fontSize: 12, fontWeight: 800, gap: 4,
          }}
            className="img-upload-overlay"
          >
            <i className="fa-solid fa-camera" style={{ fontSize: size * 0.22 }} />
            <span style={{ fontSize: size * 0.12 }}>Upload</span>
          </div>
        )}

        {/* Uploading spinner */}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Spinner size={size * 0.28} />
          </div>
        )}
      </div>

      {/* Label */}
      <span
        onClick={handleClick}
        style={{
          fontSize: 11, fontWeight: 800, color: uploading ? "#94a3b8" : "#FF9B51",
          cursor: uploading ? "default" : "pointer",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <i className="fa-solid fa-arrow-up-from-bracket" style={{ fontSize: 10 }} />
        {uploading ? "Uploading…" : label}
      </span>

      {/* Error */}
      {error && (
        <p style={{ fontSize: 11, color: "#b42318", fontWeight: 700, textAlign: "center", maxWidth: 160 }}>
          {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {/* Hover style injection */}
      <style>{`
        div:hover > .img-upload-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
