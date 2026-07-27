import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export type OTPEmailType = 'forgot_password' | 'two_fa';

export const sendOTPEmail = async (
  to: string,
  otp: string,
  type: OTPEmailType
): Promise<void> => {
  const isForgot = type === 'forgot_password';

  const title = isForgot ? 'Reset Your Password' : 'Login Verification Code';
  const desc = isForgot
    ? 'You requested a password reset for your CampusPOS account. Use the OTP below to proceed. It expires in <strong>10 minutes</strong>.'
    : 'A login attempt was made to your CampusPOS account. Enter the code below to verify your identity. It expires in <strong>5 minutes</strong>.';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:40px 20px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(37,52,63,0.13);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#25343F,#314653);padding:28px 36px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:46px;height:46px;background:linear-gradient(135deg,#FF9B51,#e87a2f);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;">🎓</div>
        <div>
          <div style="color:#EAEFEF;font-size:19px;font-weight:800;letter-spacing:-0.4px;">CampusPOS</div>
          <div style="color:#7a96a6;font-size:11.5px;font-weight:600;margin-top:2px;">School Management Suite</div>
        </div>
      </div>
    </div>
    
    <!-- Body -->
    <div style="padding:38px 36px;">
      <div style="display:inline-block;padding:5px 13px;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;font-size:11.5px;font-weight:700;color:#c2410c;margin-bottom:18px;">
        ${isForgot ? '🔐 Password Reset' : '🛡️ Two-Factor Auth'}
      </div>
      <h2 style="margin:0 0 14px;color:#1e293b;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${title}</h2>
      <p style="margin:0 0 32px;color:#64748b;font-size:14px;line-height:1.7;">${desc}</p>
      
      <!-- OTP Box -->
      <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:16px;padding:32px;text-align:center;margin-bottom:30px;">
        <div style="font-size:40px;font-weight:900;letter-spacing:16px;color:#25343F;font-family:monospace;">${otp}</div>
        <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-top:12px;text-transform:uppercase;letter-spacing:0.5px;">One-Time Password · Do Not Share</div>
      </div>
      
      <div style="padding:14px 18px;background:#fff1f2;border:1px solid #fecdd3;border-left:3px solid #ef4444;border-radius:10px;margin-bottom:24px;">
        <p style="margin:0;color:#be123c;font-size:13px;font-weight:600;">⚠️ Never share this code with anyone. CampusPOS support will never ask for your OTP.</p>
      </div>
      
      <p style="margin:0;color:#94a3b8;font-size:12.5px;line-height:1.65;">If you didn't make this request, you can safely ignore this email. No changes will be made to your account.</p>
    </div>
    
    <!-- Footer -->
    <div style="background:#f8fafc;padding:18px 36px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <p style="margin:0;color:#94a3b8;font-size:11.5px;">© 2026 CampusPOS</p>
      <a href="https://zenosoft.in" style="color:#94a3b8;font-size:11.5px;text-decoration:none;">ZenoSoft.in</a>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"CampusPOS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: isForgot
      ? 'Password Reset OTP — CampusPOS'
      : 'Your Login Verification Code — CampusPOS',
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

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:40px 20px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(37,52,63,0.13);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#25343F,#314653);padding:28px 36px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:46px;height:46px;background:linear-gradient(135deg,#FF9B51,#e87a2f);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;">🎓</div>
        <div>
          <div style="color:#EAEFEF;font-size:19px;font-weight:800;letter-spacing:-0.4px;">Skoolio</div>
          <div style="color:#7a96a6;font-size:11.5px;font-weight:600;margin-top:2px;">New Contact Form Submission</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:36px;">
      <div style="display:inline-block;padding:5px 13px;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;font-size:11.5px;font-weight:700;color:#c2410c;margin-bottom:20px;">
        📩 Contact Form
      </div>
      <h2 style="margin:0 0 6px;color:#1e293b;font-size:20px;font-weight:800;">${subject}</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:13px;">Received from the Skoolio contact page</p>

      <!-- Sender details -->
      <div style="background:#f8fafc;border-radius:14px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:7px 0;color:#94a3b8;font-size:12px;font-weight:700;width:120px;">NAME</td>
            <td style="padding:7px 0;color:#1e293b;font-size:14px;font-weight:800;">${name}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#94a3b8;font-size:12px;font-weight:700;">EMAIL</td>
            <td style="padding:7px 0;"><a href="mailto:${email}" style="color:#FF9B51;font-size:14px;font-weight:700;text-decoration:none;">${email}</a></td>
          </tr>
          ${school_name ? `<tr>
            <td style="padding:7px 0;color:#94a3b8;font-size:12px;font-weight:700;">SCHOOL</td>
            <td style="padding:7px 0;color:#1e293b;font-size:14px;font-weight:700;">${school_name}</td>
          </tr>` : ''}
          ${phone ? `<tr>
            <td style="padding:7px 0;color:#94a3b8;font-size:12px;font-weight:700;">PHONE</td>
            <td style="padding:7px 0;color:#1e293b;font-size:14px;font-weight:700;">${phone}</td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Message -->
      <div style="margin-bottom:24px;">
        <div style="color:#94a3b8;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Message</div>
        <div style="background:#f8fafc;border-left:3px solid #FF9B51;border-radius:0 12px 12px 0;padding:18px 20px;color:#334155;font-size:14px;line-height:1.75;white-space:pre-wrap;">${message}</div>
      </div>

      <!-- Reply button -->
      <a href="mailto:${email}?subject=Re: ${subject}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#FF9B51,#e87a2f);color:#fff;font-size:14px;font-weight:800;border-radius:12px;text-decoration:none;">
        Reply to ${name} →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11.5px;">© 2026 Skoolio · This message was sent via the Skoolio contact form</p>
    </div>
  </div>
</body>
</html>`;

  // Send notification to Skoolio team
  await transporter.sendMail({
    from:    `"Skoolio Contact" <${process.env.SMTP_USER}>`,
    to:      process.env.SMTP_USER!,   // sends to yourself
    replyTo: email,
    subject: `📩 Contact: ${subject} — ${name}`,
    html,
  });

  // Send confirmation to the sender
  const confirmHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:40px 20px;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(37,52,63,0.13);">
    <div style="background:linear-gradient(135deg,#25343F,#314653);padding:28px 36px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:46px;height:46px;background:linear-gradient(135deg,#FF9B51,#e87a2f);border-radius:13px;font-size:21px;display:flex;align-items:center;justify-content:center;">🎓</div>
        <div style="color:#EAEFEF;font-size:19px;font-weight:800;">Skoolio</div>
      </div>
    </div>
    <div style="padding:36px;">
      <h2 style="margin:0 0 14px;color:#1e293b;font-size:20px;font-weight:800;">We got your message, ${name}! 👋</h2>
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 20px;">
        Thanks for reaching out to Skoolio. We've received your message about <strong>"${subject}"</strong> and our team will get back to you within <strong>24 hours</strong>.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;color:#15803d;font-size:13px;font-weight:700;">✅ Your message has been received successfully.</p>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.65;margin:0;">
        In the meantime, feel free to explore Skoolio or reach us directly at
        <a href="mailto:${process.env.SMTP_USER}" style="color:#FF9B51;font-weight:700;text-decoration:none;">${process.env.SMTP_USER}</a>.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11.5px;">© 2026 Skoolio · School Management Suite</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"Skoolio" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `We received your message — Skoolio`,
    html:    confirmHtml,
  });
};

export const send2FAEnabledEmail = async (to: string, schoolName: string): Promise<void> => {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:40px 20px;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(37,52,63,0.13);">
    <div style="background:linear-gradient(135deg,#25343F,#314653);padding:28px 36px;">
      <div style="color:#EAEFEF;font-size:19px;font-weight:800;">🎓 CampusPOS</div>
    </div>
    <div style="padding:36px;">
      <h2 style="color:#1e293b;font-size:20px;font-weight:800;margin:0 0 14px;">Two-Factor Authentication Enabled</h2>
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 20px;">
        Two-factor authentication (2FA) has been <strong>enabled</strong> for your school account <strong>${schoolName}</strong> by the platform administrator.
      </p>
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">
        From your next login, you will receive a verification code on this email address each time you log in. This adds an extra layer of security to your account.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11.5px;">© 2026 CampusPOS · ZenoSoft.in</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"CampusPOS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: '2FA Enabled for Your Account — CampusPOS',
    html,
  });
};
