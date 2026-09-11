import { z } from "zod";

export const getTodayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

export const addStudentFormSchema = z
  .object({
    admission_number: z.string().trim().min(1, { message: "Admission number is required." }),
    full_name: z.string().trim().min(2, { message: "Full name must be at least 2 characters." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    gender: z.enum(["male", "female", "other"], { message: "Please select gender." }),
    date_of_birth: z
      .string()
      .min(1, { message: "Date of birth is required." })
      .refine(dateInPast, { message: "Date of birth cannot be in the future." }),
    admission_date: z
      .string()
      .min(1, { message: "Admission date is required." })
      .refine(dateNotFuture, { message: "Admission date cannot be in the future." }),
    guardian_name: z.string().trim().min(1, { message: "Guardian name is required." }),
    guardian_phone: z.string().trim().min(5, { message: "Valid guardian phone number is required." }),
    guardian_relation: z.string().trim().min(1, { message: "Guardian relation is required." }),
    email: z.string().email({ message: "Invalid student email." }).or(z.literal("")).optional(),
    guardian_email: z.string().email({ message: "Invalid guardian email." }).or(z.literal("")).optional(),
  })
  .refine(
    (data) => {
      if (data.date_of_birth && data.admission_date) {
        return new Date(data.date_of_birth) < new Date(data.admission_date);
      }
      return true;
    },
    {
      message: "Date of birth must be before the admission date.",
      path: ["date_of_birth"],
    }
  );

export const editStudentFormSchema = z
  .object({
    admission_number: z.string().trim().min(1, { message: "Admission number is required." }),
    full_name: z.string().trim().min(2, { message: "Full name must be at least 2 characters." }),
    date_of_birth: z
      .string()
      .min(1, { message: "Date of birth is required." })
      .refine(dateInPast, { message: "Date of birth cannot be in the future." }),
    admission_date: z
      .string()
      .min(1, { message: "Admission date is required." })
      .refine(dateNotFuture, { message: "Admission date cannot be in the future." }),
    guardian_name: z.string().trim().min(1, { message: "Guardian name is required." }),
    guardian_phone: z.string().trim().min(5, { message: "Valid guardian phone number is required." }),
    guardian_relation: z.string().trim().min(1, { message: "Guardian relation is required." }),
    email: z.string().email({ message: "Invalid student email." }).or(z.literal("")).optional(),
    guardian_email: z.string().email({ message: "Invalid guardian email." }).or(z.literal("")).optional(),
  })
  .refine(
    (data) => {
      if (data.date_of_birth && data.admission_date) {
        return new Date(data.date_of_birth) < new Date(data.admission_date);
      }
      return true;
    },
    {
      message: "Date of birth must be before the admission date.",
      path: ["date_of_birth"],
    }
  );
