export interface StudentStats {
    winRate: number;
    streak: number;
    happiness: number; // 0.0 to 1.0
    overallPerformance: number;
    level: number;
    points: number;
}

export interface TopicProgress {
    id?: number; // Database ID for topic
    name: string; // e.g., "Algebra"
    nameKey: string; // Translation key
    percentage: number | null;
    icon: string;
    aiSummary?: string | null;
}

export interface SubjectData {
    name: string;
    key: string; // Translation key prefix, e.g., "Math"
    topics: TopicProgress[];
    overallAverage: number;
}

export interface Achievement {
    id: string;
    category: 'study' | 'combat' | 'social';
    icon: string;
    maxProgress: number;
    currentProgress: number;
    rewardValue: number;
    rewardType: 'XP' | 'Coins' | 'Item';
    titleKey?: string;
    descKey?: string;
    unlocked?: boolean; // Derived optional
    name?: string; // Optional for UI mapping
    rarity?: 'common' | 'rare' | 'epic' | 'legendary'; // For profile badges
}

export interface LeaderboardEntry {
    id: number | string;
    name: string;
    avatar: string;
    stats: {
        arena: number;
        quiz: number;
        utilization: number;
    };
    totalScore: number;
}

export interface WeekData {
    number: number;
    nameKey: string;
}
