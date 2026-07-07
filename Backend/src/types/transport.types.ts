export type VehicleType = 'bus' | 'van' | 'minibus' | 'other';
export type VehicleStatus = 'active' | 'inactive' | 'maintenance';
export type TransportAssignmentStatus = 'active' | 'inactive';

export interface ITransportVehicle {
  id: number;
  school_id: number;
  vehicle_number: string;
  vehicle_type: VehicleType;
  capacity: number;
  driver_name: string;
  driver_phone?: string;
  driver_license?: string;
  helper_name?: string;
  helper_phone?: string;
  gps_tracking: boolean;
  status: VehicleStatus;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ITransportRoute {
  id: number;
  school_id: number;
  academic_year_id: number;
  name: string;
  description?: string;
  vehicle_id?: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface ITransportStop {
  id: number;
  school_id: number;
  route_id: number;
  name: string;
  pickup_time?: string;
  drop_time?: string;
  monthly_fee: number;
  stop_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface ITransportAssignment {
  id: number;
  school_id: number;
  student_id: number;
  route_id: number;
  stop_id: number;
  academic_year_id: number;
  start_date: string;
  end_date?: string;
  status: TransportAssignmentStatus;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateVehicle = Omit<ITransportVehicle, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateVehicle = Partial<ICreateVehicle>;
export type ICreateRoute = Omit<ITransportRoute, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateRoute = Partial<ICreateRoute>;
export type ICreateStop = Omit<ITransportStop, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateStop = Partial<ICreateStop>;
export type ICreateAssignment = Omit<ITransportAssignment, 'id' | 'school_id' | 'created_at' | 'updated_at'>;
export type IUpdateAssignment = Partial<Pick<ITransportAssignment, 'end_date' | 'status' | 'notes'>>;