export interface INotice {
  id: number;
  school_id: number;
  created_by_role: 'admin' | 'faculty';
  created_by_id: number;
  created_by_name: string;
  title: string;
  content: string;
  target_type: 'section' | null;
  target_section_id: number | null;
  is_pinned: boolean;
  expires_at: string | null;   // date as text (::text cast)
  status: 'active' | 'archived';
  created_at: Date;
  updated_at: Date;
  // joined fields
  section_name?: string | null;
  class_name?: string | null;
}

export interface ICreateNotice {
  title: string;
  content: string;
  target_type?: 'section' | null;
  target_section_id?: number | null;
  is_pinned?: boolean;
  expires_at?: string | null;
}

export interface IUpdateNotice {
  title?: string;
  content?: string;
  target_type?: 'section' | null;
  target_section_id?: number | null;
  is_pinned?: boolean;
  expires_at?: string | null;
  status?: 'active' | 'archived';
}
