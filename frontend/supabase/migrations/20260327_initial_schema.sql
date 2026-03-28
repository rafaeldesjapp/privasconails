-- Initial schema for CRM application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  status TEXT DEFAULT 'Lead' CHECK (status IN ('Key Account', 'Follow-up Pendente', 'Lead', 'Customer')),
  health_score INTEGER DEFAULT 100,
  open_value DECIMAL(12, 2) DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email TEXT,
  phone TEXT,
  location TEXT,
  photo_url TEXT,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type TEXT DEFAULT 'Call' CHECK (type IN ('Google Meet', 'Presencial', 'Call')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  value DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'QUALIFICAÇÃO' CHECK (status IN ('NEGOCIAÇÃO', 'QUALIFICAÇÃO', 'FECHADO')),
  pipeline TEXT DEFAULT 'Sales',
  closing_date DATE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timeline Table
CREATE TABLE IF NOT EXISTS timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('call', 'mail', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  color TEXT DEFAULT 'amber' CHECK (color IN ('amber', 'blue', 'green')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Policies for contacts
CREATE POLICY "Users can manage their own contacts" ON contacts
  FOR ALL USING (auth.uid() = uid);

-- Policies for appointments
CREATE POLICY "Users can manage their own appointments" ON appointments
  FOR ALL USING (auth.uid() = uid);

-- Policies for opportunities
CREATE POLICY "Users can manage their own opportunities" ON opportunities
  FOR ALL USING (auth.uid() = uid);

-- Policies for timeline
CREATE POLICY "Users can manage their own timeline events" ON timeline
  FOR ALL USING (auth.uid() = uid);

-- Policies for notes
CREATE POLICY "Users can manage their own notes" ON notes
  FOR ALL USING (auth.uid() = uid);
