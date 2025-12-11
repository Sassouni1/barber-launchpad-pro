import { User, TodoItem, Course, Member, InviteCode, Quiz } from '@/types';

export const currentUser: User = {
  id: '1',
  name: 'Marcus Johnson',
  email: 'marcus@example.com',
  role: 'member',
  joinedAt: '2024-01-15',
};

export const dailyTodos: TodoItem[] = [
  { id: '1', title: 'Watch Module 2: Lesson 3 - Base Application', completed: true, type: 'course' },
  { id: '2', title: 'Complete quiz for Lesson 3', completed: false, type: 'course' },
  { id: '3', title: 'Practice hair system measurement', completed: false, type: 'course' },
  { id: '4', title: 'Review client consultation notes', completed: false, type: 'personal' },
  { id: '5', title: 'Post progress on community', completed: false, type: 'personal' },
];

export const weeklyTodos: TodoItem[] = [
  { id: '6', title: 'Complete Module 2: Hair System Basics', completed: false, type: 'course' },
  { id: '7', title: 'Submit homework: First application photos', completed: false, type: 'course' },
  { id: '8', title: 'Watch all bonus content for Part 1', completed: true, type: 'course' },
  { id: '9', title: 'Set up Instagram business profile', completed: true, type: 'personal' },
  { id: '10', title: 'Create 3 practice content posts', completed: false, type: 'personal' },
  { id: '11', title: 'Research local competition', completed: false, type: 'personal' },
];

export const courses: Course[] = [
  {
    id: '1',
    title: 'Part 1: Hair Systems Mastery',
    description: 'Master the art of hair systems from consultation to maintenance',
    progress: 45,
    modules: [
      {
        id: 'm1',
        title: 'Introduction to Hair Systems',
        description: 'Understanding the fundamentals and industry overview',
        progress: 100,
        lessons: [
          { id: 'l1', title: 'Welcome to Barber Launch', description: 'Your journey starts here', duration: '8:24', completed: true, hasQuiz: false, hasDownload: true, hasHomework: false },
          { id: 'l2', title: 'Industry Overview', description: 'Understanding the hair system market', duration: '15:30', completed: true, hasQuiz: true, hasDownload: true, hasHomework: false },
          { id: 'l3', title: 'Tools & Equipment', description: 'Essential tools for success', duration: '22:15', completed: true, hasQuiz: true, hasDownload: true, hasHomework: true },
        ],
      },
      {
        id: 'm2',
        title: 'Hair System Basics',
        description: 'Core techniques and application methods',
        progress: 60,
        lessons: [
          { id: 'l4', title: 'Client Consultation', description: 'Building trust and understanding needs', duration: '18:45', completed: true, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l5', title: 'Measurement & Templating', description: 'Precision measurement techniques', duration: '25:10', completed: true, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l6', title: 'Base Application', description: 'Proper application techniques', duration: '32:00', completed: false, hasQuiz: true, hasDownload: false, hasHomework: true },
          { id: 'l7', title: 'Cutting & Blending', description: 'Creating seamless results', duration: '28:30', completed: false, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l8', title: 'Styling Techniques', description: 'Finishing touches for natural look', duration: '20:15', completed: false, hasQuiz: false, hasDownload: false, hasHomework: false },
        ],
      },
      {
        id: 'm3',
        title: 'Advanced Techniques',
        description: 'Taking your skills to the next level',
        progress: 0,
        lessons: [
          { id: 'l9', title: 'Complex Cases', description: 'Handling difficult situations', duration: '35:20', completed: false, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l10', title: 'Maintenance & Care', description: 'Long-term client relationships', duration: '22:45', completed: false, hasQuiz: true, hasDownload: true, hasHomework: false },
          { id: 'l11', title: 'Troubleshooting', description: 'Common issues and solutions', duration: '28:10', completed: false, hasQuiz: true, hasDownload: true, hasHomework: false },
        ],
      },
    ],
  },
  {
    id: '2',
    title: 'Part 2: Marketing & Business',
    description: 'Build and scale your hair system business',
    progress: 15,
    modules: [
      {
        id: 'm4',
        title: 'Brand Building',
        description: 'Creating your unique identity',
        progress: 50,
        lessons: [
          { id: 'l12', title: 'Finding Your Niche', description: 'Standing out in the market', duration: '16:30', completed: true, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l13', title: 'Logo & Visual Identity', description: 'Professional branding essentials', duration: '20:15', completed: false, hasQuiz: false, hasDownload: true, hasHomework: true },
          { id: 'l14', title: 'Your Story', description: 'Connecting with clients authentically', duration: '14:45', completed: false, hasQuiz: false, hasDownload: false, hasHomework: true },
        ],
      },
      {
        id: 'm5',
        title: 'Social Media Mastery',
        description: 'Dominating Instagram, TikTok & YouTube',
        progress: 0,
        lessons: [
          { id: 'l15', title: 'Content Strategy', description: 'What to post and when', duration: '25:00', completed: false, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l16', title: 'Before & After Content', description: 'Showcasing transformations', duration: '18:30', completed: false, hasQuiz: false, hasDownload: true, hasHomework: true },
          { id: 'l17', title: 'Going Viral', description: 'Creating shareable content', duration: '22:15', completed: false, hasQuiz: true, hasDownload: false, hasHomework: false },
        ],
      },
      {
        id: 'm6',
        title: 'Business Operations',
        description: 'Running a profitable business',
        progress: 0,
        lessons: [
          { id: 'l18', title: 'Pricing Strategy', description: 'Maximizing your value', duration: '20:00', completed: false, hasQuiz: true, hasDownload: true, hasHomework: true },
          { id: 'l19', title: 'Client Management', description: 'Building lasting relationships', duration: '18:45', completed: false, hasQuiz: false, hasDownload: true, hasHomework: false },
          { id: 'l20', title: 'Scaling Your Business', description: 'Growth strategies', duration: '30:00', completed: false, hasQuiz: true, hasDownload: true, hasHomework: true },
        ],
      },
    ],
  },
];

export const members: Member[] = [
  { id: '1', name: 'Marcus Johnson', email: 'marcus@example.com', status: 'active', progress: 45, joinedAt: '2024-01-15', lastActive: '2024-12-10' },
  { id: '2', name: 'James Williams', email: 'james@example.com', status: 'active', progress: 78, joinedAt: '2024-02-01', lastActive: '2024-12-11' },
  { id: '3', name: 'David Brown', email: 'david@example.com', status: 'active', progress: 32, joinedAt: '2024-03-10', lastActive: '2024-12-09' },
  { id: '4', name: 'Michael Davis', email: 'michael@example.com', status: 'inactive', progress: 12, joinedAt: '2024-04-05', lastActive: '2024-11-20' },
  { id: '5', name: 'Chris Taylor', email: 'chris@example.com', status: 'active', progress: 95, joinedAt: '2024-01-20', lastActive: '2024-12-11' },
];

export const inviteCodes: InviteCode[] = [
  { id: '1', code: 'LAUNCH2024', used: true, usedBy: 'Marcus Johnson', createdAt: '2024-01-01' },
  { id: '2', code: 'BARBER-VIP', used: true, usedBy: 'James Williams', createdAt: '2024-01-15' },
  { id: '3', code: 'ELITE-ACCESS', used: false, createdAt: '2024-02-01', expiresAt: '2025-02-01' },
  { id: '4', code: 'TRANSFORM-NOW', used: false, createdAt: '2024-03-01' },
];

export const sampleQuiz: Quiz = {
  id: 'q1',
  lessonId: 'l2',
  title: 'Industry Overview Quiz',
  questions: [
    {
      id: 'qq1',
      question: 'What is the estimated size of the hair replacement industry?',
      options: ['$1 billion', '$3.5 billion', '$7.5 billion', '$15 billion'],
      correctAnswer: 2,
    },
    {
      id: 'qq2',
      question: 'What percentage of men experience noticeable hair loss by age 50?',
      options: ['25%', '40%', '55%', '85%'],
      correctAnswer: 3,
    },
    {
      id: 'qq3',
      question: 'Which factor is MOST important for client retention?',
      options: ['Low prices', 'Fast service', 'Quality and trust', 'Location'],
      correctAnswer: 2,
    },
  ],
};
