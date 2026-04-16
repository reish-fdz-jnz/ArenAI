import * as quizRepo from '../repositories/quizRepository.js';
import * as classRepo from '../repositories/classRepository.js';
import * as studentRepo from '../repositories/studentRepository.js';
import * as assignmentRepo from '../repositories/assignmentRepository.js';

import * as topicRepo from '../repositories/topicRepository.js';

export const quizService = {
    // Create a new quiz with questions
    async createFullQuiz(payload: {
        professorId: number;
        subjectId: number;
        name: string;
        description?: string;
        level: string;
        language?: string;
        questions: Array<{
            topicId?: number | null;
            topicName?: string | null;
            questionText: string;
            points?: number;
            allowMultiple?: boolean;
            option1: string;
            option2: string;
            option3?: string | null;
            option4?: string | null;
            correctOptions: string;
        }>;
    }) {
        // Create the quiz header
        const quizId = await quizRepo.createQuiz({
            professorId: payload.professorId,
            subjectId: payload.subjectId,
            name: payload.name,
            description: payload.description,
            level: payload.level,
            language: payload.language,
        });

        // Add all questions
        for (const q of payload.questions) {
            let finalTopicId = q.topicId;
            if (!finalTopicId && q.topicName) {
                // STRICT LOOKUP: No new topics created
                console.log(`[QuizService] Mapping topic name: "${q.topicName}"`);
                finalTopicId = (await topicRepo.findTopicIdByName(q.topicName, payload.subjectId)) || undefined;
                if (finalTopicId) {
                    console.log(`[QuizService] Successfully mapped to ID: ${finalTopicId}`);
                } else {
                    console.warn(`[QuizService] Mapping FAILED for: "${q.topicName}" - defaulting to General`);
                }
            }

            await quizRepo.addQuestionToQuiz({
                quizId,
                topicId: finalTopicId,
                questionText: q.questionText,
                points: q.points,
                allowMultiple: q.allowMultiple,
                option1: q.option1,
                option2: q.option2,
                option3: q.option3,
                option4: q.option4,
                correctOptions: q.correctOptions,
            });
        }

        return quizId;
    },

    // Get quiz by ID
    getQuizById: quizRepo.getQuizById,

    // Get full quiz with questions
    getFullQuiz: quizRepo.getFullQuiz,

    // List quizzes by professor
    listQuizzesByProfessor: quizRepo.listQuizzesByProfessor,

    // List public quizzes for community/popular section
    listPublicQuizzes: quizRepo.listPublicQuizzes,

    // List quizzes by subject
    listQuizzesBySubject: quizRepo.listQuizzesBySubject,

    // Get quiz questions
    getQuestions: quizRepo.getQuizQuestions,

    // Delete quiz
    deleteQuiz: quizRepo.deleteQuiz,

    // Get quiz count
    getQuizCount: quizRepo.getQuizCountByProfessor,

    // Rate a quiz
    rateQuiz: quizRepo.rateQuiz,

    // Increment downloads
    incrementDownloads: quizRepo.incrementDownloads,

    // Copy quiz to library (with credit to original creator)
    copyQuizToLibrary: quizRepo.copyQuizToLibrary,

    // Get quiz results (all student attempts)
    getQuizResults: quizRepo.getQuizResults,

    // Get student quiz detail (individual responses)
    getStudentQuizDetail: quizRepo.getStudentQuizDetail,

    // NEW: Submit a quiz and update all related scores
    async submitQuizResult(payload: {
        studentId: number;
        quizId: number;
        classId?: number;
        assignmentId?: number;
        startedAt: string;
        finishedAt: string;
        focusLostCount?: number;
        responses: Array<{
            questionId: number;
            selectedOptions: any; // Could be stringified indices e.g. "[1, 2]"
            timeTaken: number;
        }>;
    }) {
        const { studentId, quizId, responses, startedAt, finishedAt, focusLostCount } = payload;

        const startedAtFmt = new Date(startedAt).toISOString().slice(0, 19).replace('T', ' ');
        const finishedAtFmt = new Date(finishedAt).toISOString().slice(0, 19).replace('T', ' ');

        // 1. Fetch detailed question info to verify answers
        const questionData = await quizRepo.getDetailedAnswers(quizId);
        const questionMap = new Map(questionData.map(q => [q.id_question, q]));

        // 2. Create the attempt
        const attemptId = await quizRepo.createQuizAttempt({
            quizId,
            studentId,
            startedAt: startedAtFmt
        });

        let totalScore = 0;
        const topicScores: Record<number, { name: string; points: number; maxPoints: number }> = {};

        // 3. Process each response
        for (const resp of responses) {
            const q = questionMap.get(resp.questionId);
            if (!q) continue;

            const correctOptions = q.correct_options;
            const selectedStr = typeof resp.selectedOptions === 'string' 
                ? resp.selectedOptions 
                : JSON.stringify(resp.selectedOptions);
            
            let isCorrect = false;
            try {
                // Safely parse both options to arrays for structural comparison
                const correctArr = typeof correctOptions === 'string' ? JSON.parse(correctOptions) : correctOptions;
                const selectedArr = typeof resp.selectedOptions === 'string' ? JSON.parse(resp.selectedOptions) : resp.selectedOptions;

                if (Array.isArray(correctArr) && Array.isArray(selectedArr)) {
                    isCorrect = correctArr.length === selectedArr.length && 
                                correctArr.every((v, i) => String(v).trim() === String(selectedArr[i]).trim());
                } else {
                    isCorrect = String(correctArr).trim() === String(selectedArr).trim();
                }
            } catch (e) {
                // Fallback to basic string comparison if parsing fails
                isCorrect = (String(selectedStr).trim() === String(correctOptions).trim());
            }

            const pointsAwarded = isCorrect ? Number(q.points) : 0;
            totalScore += pointsAwarded;

            await quizRepo.saveQuizResponse({
                attemptId,
                questionId: resp.questionId,
                selectedOptions: selectedStr,
                isCorrect,
                pointsAwarded,
                timeTakenSeconds: resp.timeTaken
            });

            // Track points by topic for analytics
            const topicName = q.topic_name || "General";
            if (q.id_topic || topicName === "General") {
                const effectiveTopicId = q.id_topic || 0;
                if (!topicScores[effectiveTopicId]) {
                    topicScores[effectiveTopicId] = { 
                        name: topicName,
                        points: 0, 
                        maxPoints: 0 
                    };
                }
                topicScores[effectiveTopicId].points += pointsAwarded;
                topicScores[effectiveTopicId].maxPoints += Number(q.points);
            }
        }

        // 4. Finalize attempt record
        await quizRepo.updateQuizAttemptScore(attemptId, totalScore, finishedAtFmt, focusLostCount || 0);

        // 5. AUTO-LINK TO ACTIVE CLASS (Per User Request)
        let finalClassId = payload.classId;
        if (!finalClassId) {
            finalClassId = (await classRepo.findActiveClassForStudent(studentId)) || undefined;
        }

        // 6. UPDATE PERFORMANCE TABLES
        const maxQuizScore = questionData.reduce((sum, q) => sum + Number(q.points), 0) || 100;
        const scorePercentage = (totalScore / maxQuizScore) * 100;

        // A) Update Class-specific analytics
        if (finalClassId) {
            // Update individual topic scores for this student in this class
            for (const [topicId, stats] of Object.entries(topicScores)) {
                if (Number(topicId) === 0) continue; // General topic has no DB entry
                await classRepo.recordClassStudentTopics(finalClassId, [{
                    userId: studentId,
                    topicId: Number(topicId),
                    score: (stats.points / stats.maxPoints) * 100
                }]);
            }

            // Update student's overall class average score only
            // NOTE: attendance is teacher-managed and must NOT be set here.
            await classRepo.updateClassStudentScore(finalClassId, studentId, scorePercentage);
        }

        // B) Update Global Student Topic Mastery
        for (const [topicId, stats] of Object.entries(topicScores)) {
            if (Number(topicId) === 0) continue; // General topic has no DB entry
            await studentRepo.upsertStudentTopicScore({
                userId: studentId,
                topicId: Number(topicId),
                score: (stats.points / stats.maxPoints) * 100
            });
        }

        // C) Mark Assignment Submission as SUBMITTED with score
        if (payload.assignmentId) {
            try {
                await assignmentRepo.markSubmissionComplete(payload.assignmentId, studentId, scorePercentage);
            } catch (e) {
                console.error('[quizService] Failed to mark assignment complete:', e);
            }
        }

        // 6. PREPARE TOPIC BREAKDOWN FOR FRONTEND
        const topicBreakdown = Object.entries(topicScores).map(([id, stats]) => ({
            topicId: Number(id),
            topicName: stats.name,
            points: stats.points,
            maxPoints: stats.maxPoints,
            percentage: stats.maxPoints > 0 ? (stats.points / stats.maxPoints) * 100 : 0
        }));

        return {
            success: true,
            attemptId,
            totalScore,
            maxQuizScore,
            scorePercentage,
            classLinked: !!finalClassId,
            topicBreakdown
        };
    }
};
