-- Migration: Create Streams table for dynamic class stream management
CREATE TABLE IF NOT EXISTS public.streams (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_school_stream_name UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_streams_school_id ON public.streams (school_id);
