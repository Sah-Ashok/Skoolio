export type HostelType = 'boys' | 'girls' | 'mixed';
export type RoomType = 'ac' | 'non_ac' | 'dormitory';
export type HostelAssignmentStatus = 'active' | 'left' | 'transferred';

export interface IHostel {
  id: number;
  school_id: number;
  name: string;
  hostel_type: HostelType;
  total_capacity: number;
  warden_name?: string;
  warden_phone?: string;
  warden_email?: string;
  address?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface IHostelRoom {
  id: number;
  school_id: number;
  hostel_id: number;
  room_number: string;
  floor: number;
  room_type: RoomType;
  capacity: number;
  monthly_fee: number;
  status: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IHostelAssignment {
  id: number;
  school_id: number;
  student_id: number;
  hostel_id: number;
  room_id: number;
  academic_year_id: number;
  joining_date: string;
  leaving_date?: string;
  status: HostelAssignmentStatus;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateHostel = Omit<IHostel, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateHostel = Partial<ICreateHostel>;
export type ICreateRoom = Omit<IHostelRoom, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateRoom = Partial<ICreateRoom>;
export type ICreateAssignment = Omit<IHostelAssignment, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateAssignment = Partial<Pick<IHostelAssignment, 'leaving_date' | 'status' | 'notes'>>;