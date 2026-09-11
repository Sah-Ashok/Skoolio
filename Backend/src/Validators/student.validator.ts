import { z } from 'zod';

const dateNotFuture = (val: string | undefined | null) => {
  if (!val) return true;
  const d = new Date(val);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d <= today;
};

const dateInPast = (val: string | undefined | null) => {
  if (!val) return true;
  const d = new Date(val);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return d < today;
};

export const createStudentSchema = z
  .object({
    admission_number: z.string().trim().min(1, { message: 'Admission number is required.' }),
    full_name: z.string().trim().min(2, { message: 'Full name must be at least 2 characters.' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
    gender: z.enum(['male', 'female', 'other'], { message: 'Gender must be male, female, or other.' }),
    date_of_birth: z
      .string({ message: 'Date of birth is required.' })
      .refine(dateInPast, { message: 'Date of birth cannot be in the future.' }),
    admission_date: z
      .string({ message: 'Admission date is required.' })
      .refine(dateNotFuture, { message: 'Admission date cannot be in the future.' }),
    guardian_name: z.string().trim().min(1, { message: 'Guardian name is required.' }),
    guardian_phone: z.string().trim().min(5, { message: 'Valid guardian phone number is required.' }),
    guardian_relation: z.string().trim().min(1, { message: 'Guardian relation is required.' }),
    status: z.enum(['active', 'inactive', 'graduated', 'expelled', 'transferred']).default('active'),
    email: z.string().email({ message: 'Invalid email address.' }).or(z.literal('')).optional().nullable(),
    phone: z.string().or(z.literal('')).optional().nullable(),
    blood_group: z.string().or(z.literal('')).optional().nullable(),
    photo: z.string().or(z.literal('')).optional().nullable(),
    nationality: z.string().or(z.literal('')).optional().nullable(),
    religion: z.string().or(z.literal('')).optional().nullable(),
    ethnicity: z.string().or(z.literal('')).optional().nullable(),
    city: z.string().or(z.literal('')).optional().nullable(),
    state: z.string().or(z.literal('')).optional().nullable(),
    country: z.string().or(z.literal('')).optional().nullable(),
    previous_school: z.string().or(z.literal('')).optional().nullable(),
    disability: z.boolean().optional(),
    disability_description: z.string().or(z.literal('')).optional().nullable(),
    scholarship_type: z.enum(['merit', 'need_based', 'sports', 'staff_child', 'government', 'custom']).optional().nullable(),
    scholarship_percent: z.number().min(0, { message: 'Scholarship cannot be negative' }).max(100, { message: 'Scholarship cannot exceed 100%' }).optional().nullable(),
    scholarship_remarks: z.string().or(z.literal('')).optional().nullable(),
    guardian_email: z.string().email({ message: 'Invalid guardian email address.' }).or(z.literal('')).optional().nullable(),
    guardian_occupation: z.string().or(z.literal('')).optional().nullable(),
    guardian_address: z.string().or(z.literal('')).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.date_of_birth && data.admission_date) {
        const dob = new Date(data.date_of_birth);
        const adm = new Date(data.admission_date);
        return dob < adm;
      }
      return true;
    },
    {
      message: 'Date of birth must be before the admission date.',
      path: ['date_of_birth'],
    }
  );

export const updateStudentSchema = z
  .object({
    admission_number: z.string().trim().min(1, { message: 'Admission number is required.' }).optional(),
    full_name: z.string().trim().min(2, { message: 'Full name must be at least 2 characters.' }).optional(),
    password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    date_of_birth: z
      .string()
      .refine(dateInPast, { message: 'Date of birth cannot be in the future.' })
      .optional(),
    admission_date: z
      .string()
      .refine(dateNotFuture, { message: 'Admission date cannot be in the future.' })
      .optional(),
    guardian_name: z.string().trim().min(1, { message: 'Guardian name is required.' }).optional(),
    guardian_phone: z.string().trim().min(5, { message: 'Valid guardian phone number is required.' }).optional(),
    guardian_relation: z.string().trim().min(1, { message: 'Guardian relation is required.' }).optional(),
    status: z.enum(['active', 'inactive', 'graduated', 'expelled', 'transferred']).optional(),
    email: z.string().email({ message: 'Invalid email address.' }).or(z.literal('')).optional().nullable(),
    phone: z.string().or(z.literal('')).optional().nullable(),
    blood_group: z.string().or(z.literal('')).optional().nullable(),
    photo: z.string().or(z.literal('')).optional().nullable(),
    nationality: z.string().or(z.literal('')).optional().nullable(),
    religion: z.string().or(z.literal('')).optional().nullable(),
    ethnicity: z.string().or(z.literal('')).optional().nullable(),
    city: z.string().or(z.literal('')).optional().nullable(),
    state: z.string().or(z.literal('')).optional().nullable(),
    country: z.string().or(z.literal('')).optional().nullable(),
    previous_school: z.string().or(z.literal('')).optional().nullable(),
    disability: z.boolean().optional(),
    disability_description: z.string().or(z.literal('')).optional().nullable(),
    scholarship_type: z.enum(['merit', 'need_based', 'sports', 'staff_child', 'government', 'custom']).optional().nullable(),
    scholarship_percent: z.number().min(0, { message: 'Scholarship cannot be negative' }).max(100, { message: 'Scholarship cannot exceed 100%' }).optional().nullable(),
    scholarship_remarks: z.string().or(z.literal('')).optional().nullable(),
    guardian_email: z.string().email({ message: 'Invalid guardian email address.' }).or(z.literal('')).optional().nullable(),
    guardian_occupation: z.string().or(z.literal('')).optional().nullable(),
    guardian_address: z.string().or(z.literal('')).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.date_of_birth && data.admission_date) {
        const dob = new Date(data.date_of_birth);
        const adm = new Date(data.admission_date);
        return dob < adm;
      }
      return true;
    },
    {
      message: 'Date of birth must be before the admission date.',
      path: ['date_of_birth'],
    }
  );
