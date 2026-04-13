export interface ClassTemplate {
  ClassTemplateID: string;
  Name: string;
  Settings: Record<string, any>;
  Grade: number;
  Topics: Topic[];
  Description: string;
  subjectId?: number; // Added for context
}

export interface Topic {
  id: number;
  name: string;
  description?: string;
}

export interface ClassSession {
  ClassSessionID: string;
  ClassTemplateID: string;
  SectionID: string;
  InstitutionID: string;
  StartTime: string;
  EndTime?: string;
  AverageScore?: number;
  Summary?: string;
  State: 'scheduled' | 'running' | 'finished' | 'paused';
}

export interface ClassSessionTopicScore {
  ClassSessionID: string;
  TopicID: number;
  Score: number;
  Summary: string;
}

export interface ClassSessionIndividual {
  StudentID: string;
  ClassSessionID: string;
  AverageScore: number;
  Summary: string;
}

export interface ClassSessionTopicScoreIndividual {
  StudentID: string;
  ClassSessionID: string;
  TopicID: number;
  AverageScore: number;
  Summary: string;
}
