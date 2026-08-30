-- ALTER TABLE fee_collections
--   ADD COLUMN IF NOT EXISTS billing_from_month VARCHAR(7),  -- e.g. '2026-04' (Baishakh)
--   ADD COLUMN IF NOT EXISTS billing_to_month   VARCHAR(7),  -- e.g. '2026-06' (Ashadh)
--   ADD COLUMN IF NOT EXISTS months_count       INT DEFAULT 1; -- e.g. 3

-- SELECT *  FROM fee_collections

-- DELETE FROM fee_collections


-- CREATE INDEX idx_unpaid_fees ON fee_collections (school_id, student_id) 
-- WHERE status IN ('unpaid', 'partial');


-- CREATE INDEX idx_fee_period ON fee_collections (school_id, academic_year_id, billing_from_month, billing_to_month);

-- CREATE INDEX idx_fee_dashboard_stats ON fee_collections (school_id, academic_year_id, status, total_amount, paid_amount);

-- SELECT * from feedback

-- Create Timetable table if not exists
CREATE TABLE IF NOT EXISTS section_timetables (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    
    -- Day of week: 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    day_of_week VARCHAR(15) NOT NULL,
    
    -- Period number: 1, 2, 3, 4, 5, 6, 7, 8...
    period_number INT NOT NULL,
    
    -- Flexible Time interval (supports any morning, day, or custom shift)
    start_time TIME NOT NULL, -- e.g. 07:00:00, 10:00:00
    end_time   TIME NOT NULL, -- e.g. 07:45:00, 10:45:00
    
    -- Subject & Assigned Teacher (nullable if break/assembly/recess)
    subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
    
    -- Special slots
    is_break BOOLEAN DEFAULT false,       -- true for Lunch / Tiffin / Recess
    title VARCHAR(100),                   -- Custom title e.g. 'Lunch Break', 'Assembly'
    room_no VARCHAR(50),
    
    -- Audit fields
    created_by_teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: Avoid duplicate period slot for the same section on the same day
    UNIQUE (school_id, academic_year_id, section_id, day_of_week, period_number)
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_timetable_section 
    ON section_timetables (school_id, section_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_timetable_teacher 
    ON section_timetables (school_id, teacher_id, day_of_week);


    -- Ensure document columns exist on staff table


Se