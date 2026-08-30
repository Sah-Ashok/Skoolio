export type DayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface ITimetableSlot {
  id: number;
  school_id: number;
  academic_year_id: number;
  class_id: number;
  section_id: number;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: number | null;
  teacher_id: number | null;
  is_break: boolean;
  title: string | null;
  room_no: string | null;
  created_by_teacher_id: number | null;
  created_at?: string;
  updated_at?: string;

  // Joined fields for display
  subject_name?: string | null;
  subject_code?: string | null;
  teacher_name?: string | null;
  class_name?: string | null;
  section_name?: string | null;
}

export interface ICreateTimetableSlot {
  class_id?: number;
  section_id?: number;
  academic_year_id?: number;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id?: number | null;
  teacher_id?: number | null;
  is_break?: boolean;
  title?: string | null;
  room_no?: string | null;
}

export interface IBulkSaveTimetable {
  class_id: number;
  section_id: number;
  academic_year_id?: number;
  slots: ICreateTimetableSlot[];
}

export interface ITimetableConflict {
  has_conflict: boolean;
  conflict_slot?: ITimetableSlot | null;
  message?: string;
}
