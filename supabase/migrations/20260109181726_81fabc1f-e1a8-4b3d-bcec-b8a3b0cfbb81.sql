-- Add is_certification_requirement column to modules table
ALTER TABLE modules 
ADD COLUMN is_certification_requirement boolean DEFAULT false NOT NULL;

-- Create the photo upload lesson module under Hair System Mastery course
INSERT INTO modules (
  course_id,
  title,
  description,
  order_index,
  has_quiz,
  has_download,
  has_homework,
  is_published,
  is_certification_requirement
) VALUES (
  (SELECT id FROM courses WHERE title = 'Hair System Mastery' LIMIT 1),
  'Submit Hair System Template Photo',
  'Upload a photo of your completed hair system template to demonstrate your skills and qualify for certification. This is a required step to earn your Hair System Certification.',
  6,
  false,
  false,
  false,
  true,
  true
);