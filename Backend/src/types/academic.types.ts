export type AcademicYearStatus = 'upcoming' | 'active' | 'completed';

export interface IAcademicYear {
    id: number;
    school_id: number ; 
    year_name: string;
    start_date: Date;
    end_date: Date;
    status: AcademicYearStatus;
    description?: string;
    created_at: Date;
    updated_at: Date;
}


export type ICreateAcademicYear = Pick<
IAcademicYear,
|'year_name'
|'start_date'
|'end_date'
|'status'
>& {description?: string;};

export type IUpdateAcademicYear = Partial<ICreateAcademicYear>;