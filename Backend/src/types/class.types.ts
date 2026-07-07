export type ClassStatus = 'active' | 'inactive';

// ── CLASS ──
export interface IClass {
  id: number;
  school_id: number;
  academic_year_id: number;
  name: string;
  stream?: string;
  room_no?: string;
  status: ClassStatus;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateClass = Pick<IClass, 'academic_year_id' | 'name' | 'status'> & {
  stream?: string;
  room_no?: string;
  description?: string;
  sections?: ICreateSection[];
};

export type IUpdateClass = Partial<Omit<ICreateClass, 'sections'>>;

// ── SECTION ──
export interface ISection {
  id: number;
  school_id: number;
  class_id: number;
  name: string;
  room_no?: string;
  capacity: number;
  coordinator_id?: number;
  coordinator_name?: string;
  status: ClassStatus;
  created_at: Date;
  updated_at: Date;
}

export type ICreateSection = Pick<ISection, 'name' | 'capacity' | 'status'> & {
  room_no?: string;
  coordinator_id?: number;
};

export type IUpdateSection = Partial<ICreateSection>;

// ── SUBJECT ──
export interface ISubject {
  id: number;
  school_id: number;
  name: string;
  code?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateSubject = Pick<ISubject, 'name'> & { code?: string };
export type IUpdateSubject = Partial<ICreateSubject>;

// ── CLASS SUBJECT ──
export interface IClassSubject {
  id: number;
  school_id: number;
  class_id: number;
  subject_id: number;
  created_at: Date;
}

// ── CLASS SUBJECT TEACHER ──
// Maps: teacher → subject → class (per academic year)
// Determines who can enter exam results for a subject
export interface IClassSubjectTeacher {
  id: number;
  school_id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  academic_year_id: number;
  // joined fields
  teacher_name?: string;
  subject_name?: string;
  class_name?: string;
  created_at: Date;
  updated_at: Date;
}

export type IAssignSubjectTeacher = {
  class_id: number;
  subject_id: number;
  teacher_id: number;
  academic_year_id: number;
};
