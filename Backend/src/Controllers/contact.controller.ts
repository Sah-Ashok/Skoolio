import { Request, Response } from 'express';
import catchAsync   from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { sendContactEmail } from '../utils/emailService';

// ── SUBMIT CONTACT FORM ───────────────────────────────────────────────────────
export const submitContact = catchAsync(async (req: Request, res: Response) => {
  const { name, email, school_name, phone, subject, message } = req.body;

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    throw { message: 'Name, email, subject and message are required.', statusCode: 400 };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw { message: 'Please provide a valid email address.', statusCode: 400 };
  }

  if (message.trim().length < 20) {
    throw { message: 'Message must be at least 20 characters.', statusCode: 400 };
  }

  await sendContactEmail({ name, email, school_name, phone, subject, message });

  sendResponse(res, 200, true, "Thanks for reaching out! We'll get back to you within 24 hours.", null);
});
