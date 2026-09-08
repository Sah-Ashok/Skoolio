// Role Types
export type SchoolRole = 'super_admin' | 'admin';
export type UserRole = 'faculty' | 'student' | 'finance';
export type AllRoles = SchoolRole | UserRole;

// School Type
export type SchoolType = 'Primary' | 'Secondary' | 'Higher_Secondary';

// Account Status
export type AccountStatus = 'active' | 'blocked';

// Calendar system: AD = Gregorian (default), BS = Bikram Sambat
export type CalendarSystem = 'AD' | 'BS';

// Base School Interface
export interface ISchool {
  id: number;
  school_name: string;
  school_code: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
  phone: string;
  email: string;
  owner_full_name: string;
  password: string;
  logo?: string;
  established_year?: number;
  school_type: SchoolType;
  role: SchoolRole;
  is_account: AccountStatus;
  is_verified: boolean;
  timezone: string;
  calendar_system: CalendarSystem;
  subscription_id?: number;
  created_at: Date;
  updated_at: Date;
}

// Register Type
export type IRegisterSchool = Pick<
  ISchool,
  | 'school_name'
  | 'city'
  | 'state'
  | 'country'
  | 'phone'
  | 'email'
  | 'owner_full_name'
  | 'password'
  | 'school_type'
  | 'timezone'
> & {
  pincode?: string;
  logo?: string;
  established_year?: number;
  calendar_system?: CalendarSystem;
};

// Login Type
export type ILoginSchool = Pick<ISchool, 'email' | 'password'>;

// JWT Payload - Admin/Super Admin
export type IJwtAdminPayload = {
  id: number;
  email: string;
  role: SchoolRole;
  school_name: string;
  school_code: string;
  logo?: string;
  timezone: string;
  country: string;
  calendar_system: CalendarSystem;
  is_verified: boolean;
  is_account: AccountStatus;
};

// JWT Payload - Faculty/Student
export type IJwtUserPayload = {
  id: number;
  email: string;
  role: UserRole;
  school_id: number;
  school_name: string;
  logo?: string;
  timezone: string;
  calendar_system: CalendarSystem;
  is_account: AccountStatus;
};

// Combined JWT Payload
export type IJwtPayload = IJwtAdminPayload | IJwtUserPayload;
