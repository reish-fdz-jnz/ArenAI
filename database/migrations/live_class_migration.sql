-- Migration for "Live Class Session" feature

-- 1. Add description and status to the existing class table
ALTER TABLE class 
ADD COLUMN description VARCHAR(500) NULL,
ADD COLUMN status VARCHAR(50) DEFAULT 'scheduled' NULL;

-- 2. Modify constraint to ensure name_class doesn't collide improperly, 
-- or we can leave constraints as is if unique(id_subject, id_section, name_class) works for them.
-- (Currently: constraint id_subject unique (id_subject, id_section, name_class))

-- 3. (Optional) If you want to track exactly when it went live
ALTER TABLE class 
ADD COLUMN started_at TIMESTAMP NULL,
ADD COLUMN ended_at TIMESTAMP NULL;
