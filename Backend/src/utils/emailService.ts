import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Lazy transporter factory: created on each call so SMTP credentials
 * are always read from process.env AFTER dotenv has loaded.
 * This prevents the "Missing credentials for PLAIN" error that occurred
 * when the module was imported before dotenv.config() ran in server.ts.
 */
const getTransporter = () => {
  console.log('[SMTP Debug] Creating transporter with SMTP_USER:', process.env.SMTP_USER || 'MISSING!');
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export type OTPEmailType = 'forgot_password' | 'two_fa' | 'registration' | 'revoke_finance';

const FONT_FAMILY = `'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const GOOGLE_FONTS_HEAD = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
    body, table, td, p, div, span, h1, h2, h3 {
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    }
  </style>
`;

export const sendOTPEmail = async (
  to: string,
  otp: string,
  type: OTPEmailType
): Promise<void> => {
  const isForgot       = type === 'forgot_password';
  const isRegistration = type === 'registration';
  const isRevoke       = type === 'revoke_finance';

  const subject = isForgot
    ? 'Your password reset code — Skoolio'
    : isRegistration
      ? 'Confirm your email address — Skoolio'
      : isRevoke
        ? 'Authorization code to revoke Finance Manager access — Skoolio'
        : 'Your login verification code — Skoolio';

  const heading = isForgot
    ? 'Reset your password'
    : isRegistration
      ? 'Confirm your email address'
      : isRevoke
        ? 'Authorize Finance Manager Revocation'
        : 'Verify your login';

  const bodyText = isForgot
    ? 'We received a request to reset the password for your Skoolio account. Use the code below to continue. It is valid for 10 minutes.'
    : isRegistration
      ? 'Thank you for signing up. Please use the code below to confirm your email address and complete your school registration. It is valid for 10 minutes.'
      : isRevoke
        ? 'A request was initiated by your School Administrator to revoke login access for this Finance Manager account. Please provide the 6-digit authorization code below to the administrator to confirm revocation. It is valid for 10 minutes.'
        : 'A login attempt was made to your Skoolio account. Enter the code below to verify it was you. It is valid for 5 minutes.';

  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  ${GOOGLE_FONTS_HEAD}
</head>
<body style="margin:0;padding:28px 20px;font-family:${FONT_FAMILY};color:#1e293b;background:#ffffff;line-height:1.6;">
  <div style="max-width:540px;margin:0 auto;">
    <div style="font-size:26px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;margin-bottom:28px;">
      Skoolio
    </div>

    <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;">
      ${heading}
    </h2>

    <p style="margin:0 0 20px 0;font-size:15px;color:#334155;line-height:1.6;">
      ${bodyText}
    </p>

    <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8;margin:28px 0;font-family:monospace;">
      ${otp}
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.6;">
      Do not share this code with anyone. Skoolio staff will never ask for your verification code.
    </p>
    <p style="margin:0 0 28px 0;font-size:13px;color:#64748b;line-height:1.6;">
      If you did not request this, you can safely ignore this email.
    </p>

    <div style="font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;">
      © ${year} Skoolio. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const text = `${heading}\n\n${bodyText}\n\nYour code: ${otp}\n\nDo not share this code with anyone. Skoolio staff will never ask for your code.\nIf you did not request this, you can safely ignore this email.\n\n© ${year} Skoolio`;

  await getTransporter().sendMail({
    from: `"Skoolio" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

export const sendContactEmail = async (data: {
  name:        string;
  email:       string;
  school_name?: string;
  phone?:       string;
  subject:     string;
  message:     string;
}): Promise<void> => {
  const { name, email, school_name, phone, subject, message } = data;
  const year = new Date().getFullYear();

  const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${GOOGLE_FONTS_HEAD}
</head>
<body style="margin:0;padding:28px 20px;font-family:${FONT_FAMILY};color:#0f172a;background:#ffffff;line-height:1.6;">
  <div style="max-width:540px;margin:0 auto;">
    <div style="font-family:${FONT_FAMILY};font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px;">
      Skoolio
    </div>
    <h3 style="margin:0 0 14px 0;font-family:${FONT_FAMILY};font-size:18px;font-weight:700;color:#0f172a;">
      New Contact Form: ${subject}
    </h3>
    <p style="margin:0 0 6px 0;font-size:14px;color:#334155;"><strong>Name:</strong> ${name}</p>
    <p style="margin:0 0 6px 0;font-size:14px;color:#334155;"><strong>Email:</strong> ${email}</p>
    ${school_name ? `<p style="margin:0 0 6px 0;font-size:14px;color:#334155;"><strong>School:</strong> ${school_name}</p>` : ''}
    ${phone ? `<p style="margin:0 0 6px 0;font-size:14px;color:#334155;"><strong>Phone:</strong> ${phone}</p>` : ''}
    <div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;white-space:pre-wrap;line-height:1.6;color:#0f172a;">${message}</div>
    <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;font-size:12px;color:#94a3b8;">© ${year} Skoolio</div>
  </div>
</body>
</html>`;

  await getTransporter().sendMail({
    from:    `"Skoolio" <${process.env.SMTP_USER}>`,
    to:      process.env.SMTP_USER!,
    replyTo: email,
    subject: `Contact: ${subject} — from ${name}`,
    text:    `New contact message from ${name} (${email}):\n\nSubject: ${subject}\nSchool: ${school_name || 'N/A'}\nPhone: ${phone || 'N/A'}\n\nMessage:\n${message}`,
    html:    adminHtml,
  });

  const confirmHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${GOOGLE_FONTS_HEAD}
</head>
<body style="margin:0;padding:28px 20px;font-family:${FONT_FAMILY};color:#0f172a;background:#ffffff;line-height:1.6;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="font-family:${FONT_FAMILY};font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px;">
      Skoolio
    </div>
    <h3 style="margin:0 0 12px 0;font-family:${FONT_FAMILY};font-size:18px;font-weight:700;color:#0f172a;">We received your message</h3>
    <p style="margin:0 0 14px 0;font-size:14px;color:#334155;line-height:1.6;">
      Hi ${name}, thank you for reaching out. We received your message regarding <strong>${subject}</strong> and our team will get back to you within 24 hours.
    </p>
    <div style="border-top:1px solid #e2e8f0;margin-top:28px;padding-top:16px;font-size:12px;color:#94a3b8;">© ${year} Skoolio</div>
  </div>
</body>
</html>`;

  await getTransporter().sendMail({
    from:    `"Skoolio" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `We received your message — Skoolio`,
    text:    `Hi ${name},\n\nThanks for reaching out to Skoolio. We received your message about "${subject}" and our team will get back to you within 24 hours.\n\n© ${year} Skoolio`,
    html:    confirmHtml,
  });
};

export const send2FAEnabledEmail = async (to: string, schoolName: string): Promise<void> => {
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${GOOGLE_FONTS_HEAD}
</head>
<body style="margin:0;padding:28px 20px;font-family:${FONT_FAMILY};color:#0f172a;background:#ffffff;line-height:1.6;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="font-family:${FONT_FAMILY};font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px;">
      Skoolio
    </div>
    <h3 style="margin:0 0 12px 0;font-family:${FONT_FAMILY};font-size:18px;font-weight:700;color:#0f172a;">Two-Factor Authentication Enabled</h3>
    <p style="margin:0 0 10px 0;font-size:14px;color:#334155;line-height:1.6;">
      Two-factor authentication (2FA) has been enabled for your school account <strong>${schoolName}</strong>.
    </p>
    <p style="margin:0 0 14px 0;font-size:14px;color:#334155;line-height:1.6;">
      From your next login, you will receive a verification code on this email address each time you log in.
    </p>
    <p style="margin:0 0 24px 0;font-size:13px;color:#64748b;">
      If you did not make this change, please contact Skoolio support immediately.
    </p>
    <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;color:#94a3b8;">© ${year} Skoolio</div>
  </div>
</body>
</html>`;

  await getTransporter().sendMail({
    from:    `"Skoolio" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Two-factor authentication has been enabled — Skoolio',
    text:    `Two-factor authentication (2FA) has been enabled for your school account "${schoolName}".\nFrom your next login, you will receive a verification code on this email address each time you log in.\n\n© ${year} Skoolio`,
    html,
  });
};





