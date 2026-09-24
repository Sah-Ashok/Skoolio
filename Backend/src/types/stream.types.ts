export interface IStream {
  id: number;
  school_id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface ICreateStream {
  name: string;
  code?: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface IUpdateStream {
  name?: string;
  code?: string;
  description?: string;
  status?: 'active' | 'inactive';
}
