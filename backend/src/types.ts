export interface Institution {
  id_institution: number;
  name_institution: string;
  score_average: string | null;
}

export interface Section {
  id_section: number;
  section_number: string;
  grade: string;
  id_institution: number;
}

export interface Subject {
  id_subject: number;
  name_subject: string;
}

export interface Topic {
  id_topic: number;
  name: string;
  id_subject: number;
  description: string | null;
}

export interface ClassRecord {
  id_class: number;
  id_class_template: number | null;
  id_professor: number;
  id_section: number;
  id_institution: number | null;
  start_time: string | null;
  end_time: string | null;
  score_average: string | null;
  ai_summary: string | null;
  status: 'scheduled' | 'running' | 'paused' | 'finished';
}

export interface ClassTemplate {
  id_class_template: number;
  id_professor: number;
  id_subject: number;
  name_template: string;
  grade: string;
  description: string | null;
  settings: any;
  created_at: string;
}

export interface ClassTemplateTopic {
  id_class_template: number;
  id_topic: number;
}

export interface StudentProgressRow {
  id_topic: number;
  topic_name: string;
  subject_name: string;
  score: string | null;
}

export interface Quiz {
  id_quiz: number;
  id_professor: number | null;
  quiz_name: string | null;
  id_subject: number;
  id_section: number;
  id_class: number;
}

export interface QuizQuestion {
  id_quiz_question: number;
  id_quiz: number;
  id_topic: number | null;
  question: string;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  answer4: string | null;
}

export interface QuizStudent {
  id_quiz_student: number;
  id_quiz: number | null;
  id_student: number | null;
  score: number | null;
}

export interface BattleMinigame {
  id_battle_minigame: number;
  id_user_1: number | null;
  id_user_2: number | null;
  id_class: number | null;
  user_1_health: number | null;
  user_2_health: number | null;
  winner: boolean | null;
  id_subject: number | null;
}

export interface BattleMinigameQuestion {
  id_battle_minigame_question: number;
  id_battle_minigame: number | null;
  id_topic: number | null;
  question: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  answer4: string | null;
}

export interface Chat {
  id_chat: number;
  id_user_1: number | null;
  id_user_2: number | null;
  friendship: boolean | null;
}

export interface Message {
  id_message: number;
  id_chat: number | null;
  id_user: number | null;
  date: string | null;
}

export interface Chatbot {
  id_chatbot: number;
  id_subject: number | null;
  id_student: number | null;
}

export interface ChatbotMessage {
  id_chatbot_message: number;
  id_chatbot: number | null;
  date: string | null;
  is_user: boolean | null;
}

export interface Assignment {
  id_assignment: number;
  id_professor: number;
  title: string;
  description: string | null;
  id_section: number | null;
  due_time: string | null;
  id_quiz: number | null;
  win_battle_requirement: number | null;
  min_battle_wins: number | null;
  id_subject: number | null;
  created_at: string | null;
}

export interface AssignmentSubmission {
  id_submission: number;
  id_assignment: number;
  id_student: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  win_streak_achieved: number | null;
  text_response: string | null;
  started_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  grade: string | null;
  feedback: string | null;
}

export interface AssignmentStudentBattle {
  id_assignment_student_battle: number;
  id_assignment_submission: number | null;
  id_battle_minigame: number | null;
}
