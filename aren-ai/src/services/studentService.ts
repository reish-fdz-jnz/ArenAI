import { getApiUrl } from "../config/api";
import { StudentStats, TopicProgress, SubjectData, WeekData } from "../types/student";

// Helper to get userId from token/storage
function getUserId(): number | null {
    const userStr = localStorage.getItem("userData") || localStorage.getItem("user");
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            return user.id ? Number(user.id) : null;
        } catch (e) {
            return null;
        }
    }
    return null;
}

class StudentService {
    // Keep local fallback just in case backend has no data for this subject yet
    private getFallbackTopics(subjectName: string): TopicProgress[] {
        const fallbacks: Record<string, TopicProgress[]> = {
            Math: [
                { name: "Algebra", nameKey: "mainStudent.topics.Algebra", percentage: 0, icon: "∑" },
                { name: "Geometry", nameKey: "mainStudent.topics.Geometry", percentage: 0, icon: "📐" },
                { name: "Calculus", nameKey: "mainStudent.topics.Calculus", percentage: 0, icon: "∫" },
            ],
            Science: [
                { name: "Biology", nameKey: "mainStudent.topics.Biology", percentage: 0, icon: "🧬" },
                { name: "Chemistry", nameKey: "mainStudent.topics.Chemistry", percentage: 0, icon: "🧪" },
            ]
        };
        return fallbacks[subjectName] || [];
    }

    async getStudentStats(studentId?: string): Promise<StudentStats> {
        try {
            const userId = studentId || getUserId();
            if (!userId) throw new Error("No user ID");

            const token = localStorage.getItem("authToken") || localStorage.getItem("token");
            const res = await fetch(getApiUrl(`/api/students/${userId}/stats`), {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                return {
                    winRate: data.totalBattles > 0 ? Math.round((data.battlesWon / data.totalBattles) * 100) : 0,
                    streak: 0,
                    happiness: 0.8,
                    overallPerformance: data.quizAvgScore || 0,
                    level: Math.floor(((data.quizzesCompleted || 0) * 50) / 100) + 1,
                    points: (data.quizzesCompleted || 0) * 50
                };
            }
        } catch (e) {
            console.error("Failed to fetch student stats, using defaults", e);
        }

        return {
            winRate: 0,
            streak: 0,
            happiness: 0.8,
            overallPerformance: 0,
            level: 1,
            points: 0
        };
    }

    async getWeeks(studentId?: string): Promise<WeekData[]> {
        return Array.from({ length: 12 }, (_, i) => ({
            number: i + 1,
            nameKey: `mainStudent.weeks.week${i + 1}`,
        }));
    }

    async getSubjectDetails(subjectName: string, studentId?: string): Promise<SubjectData> {
        try {
            const userId = studentId || getUserId();
            if (!userId) throw new Error("No user ID");

            const token = localStorage.getItem("authToken") || localStorage.getItem("token");
            const res = await fetch(getApiUrl(`/api/students/${userId}/progress`), {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data: any[] = await res.json();
                
                const filtered = data.filter(d => 
                    d.subject_name.toLowerCase() === subjectName.toLowerCase() ||
                    d.subject_name.toLowerCase().replace(/\s+/g, '') === subjectName.toLowerCase().replace(/\s+/g, '')
                );

                if (filtered.length > 0) {
                    const topics: TopicProgress[] = filtered.map(t => ({
                        name: t.topic_name,
                        nameKey: t.topic_name, 
                        percentage: Number(t.score) || 0,
                        icon: this.getIconForTopic(t.topic_name)
                    }));

                    return {
                        name: subjectName,
                        key: subjectName.replace(/\s+/g, ''),
                        topics
                    };
                }
            }
        } catch (e) {
            console.error(`Failed to fetch topic details for subject ${subjectName}`, e);
        }

        return {
            name: subjectName,
            key: subjectName.replace(/\s+/g, ''),
            topics: this.getFallbackTopics(subjectName)
        };
    }

    private getIconForTopic(topicName: string): string {
        const t = topicName.toLowerCase();
        if (t.includes("algeb")) return "∑";
        if (t.includes("geom")) return "📐";
        if (t.includes("calc")) return "∫";
        if (t.includes("stat")) return "📊";
        if (t.includes("bio")) return "🧬";
        if (t.includes("chem")) return "🧪";
        if (t.includes("phys")) return "⚛️";
        if (t.includes("hist")) return "📜";
        if (t.includes("geo")) return "🗺️";
        if (t.includes("voc")) return "🗣️";
        if (t.includes("gram")) return "📝";
        return "🎓";
    }
}

export const studentService = new StudentService();
