// C:\ArenAI\ArenAI\backend\src\routes\ai.ts
import { checkGeminiConnection, generateContentWithGemini } from '../services/geminiService.js'; 
import { Router } from 'express';
import { ApiError } from '../middleware/errorHandler.js';
import { STUDENT_SYSTEM_PROMPT, PROFESSOR_SYSTEM_PROMPT, QUIZ_GENERATOR_PROMPT } from '../config/prompts.js';
// Using simpler chat_logs table for message storage and analytics
import { 
  logChatMessage, 
  getChatHistory,
  getSubjectIdByName
} from '../repositories/chatLogRepository.js';
import { runInsightGeneration, runClassReportGeneration } from '../services/insightService.js';
import { db } from '../db/pool.js';
import { getStudentTopicProgress } from '../repositories/studentRepository.js';
import { classifyQuestion } from '../utils/questionClassifier.js';
import { logQuestion, getQuestionsByClass } from '../repositories/chatbotQuestionLogRepository.js';
import { findActiveClassForStudent } from '../repositories/classRepository.js';
import { listTopicsBySubject } from '../repositories/topicRepository.js';

const router = Router();

// Default class ID (until class system is fully implemented)
const DEFAULT_CLASS_ID = 1;

// GET /ai/class-insights - Get professor class report for teacher dashboard
router.get('/class-insights', async (req, res, next) => {
  try {
    const classId = parseInt(req.query.classId as string) || DEFAULT_CLASS_ID;
    console.log(`[API] /class-insights called with classId=${classId}`);
    
    // Get the professor's aggregated report for this class
    const query = `
      SELECT 
        pcr.id_report,
        pcr.id_class,
        pcr.general_summary,
        pcr.top_confusion_topics,
        pcr.sentiment_average,
        pcr.suggested_action,
        pcr.created_at
      FROM professor_class_report pcr
      WHERE pcr.id_class = ?
      ORDER BY pcr.created_at DESC
      LIMIT 1
    `;
    
    const result = await db.query<any>(query, [classId]);
    console.log(`[API] /class-insights found ${result.rows.length} reports for classId=${classId}`);
    
    if (result.rows.length === 0) {
      // No report yet - return empty
      return res.json({
        success: true,
        insights: [],
        summary: {
          totalStudentsAnalyzed: 0,
          topWeaknesses: [],
          classId
        }
      });
    }
    
    const report = result.rows[0];
    let topConfusionTopics = report.top_confusion_topics;
    if (typeof topConfusionTopics === 'string') {
      try { topConfusionTopics = JSON.parse(topConfusionTopics); } catch (e) { topConfusionTopics = []; }
    }
    
    // Format response to match frontend expectations
    res.json({
      success: true,
      insights: [{
        summary: report.general_summary,
        weaknesses: topConfusionTopics || [],
        sentiment: report.sentiment_average,
        suggested_action: report.suggested_action,
        created_at: report.created_at
      }],
      summary: {
        classId,
        topWeaknesses: (topConfusionTopics || []).map((topic: string) => ({ topic, studentCount: 1 }))
      }
    });
  } catch (error: any) {
    console.error('Class insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /ai/student-insights - Get personal summary for a specific student
router.get('/student-insights', async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId as string);
    const classId = parseInt(req.query.classId as string) || DEFAULT_CLASS_ID;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    console.log(`[API] /student-insights called with userId=${userId}, classId=${classId}`);
    
    const query = `
      SELECT 
        scs.id_summary,
        scs.id_class,
        scs.id_user,
        scs.summary_text,
        scs.strengths,
        scs.weaknesses,
        scs.study_tips,
        scs.created_at,
        scs.updated_at
      FROM student_class_summary scs
      WHERE scs.id_user = ? AND scs.id_class = ?
      ORDER BY scs.updated_at DESC
      LIMIT 1
    `;
    
    const result = await db.query<any>(query, [userId, classId]);
    console.log(`[API] /student-insights found ${result.rows.length} rows for userId=${userId}, classId=${classId}`);
    
    // Map to expected format for frontend compatibility
    const insights = result.rows.map((r: any) => ({
      ...r,
      summary: r.summary_text,
      knowledge_gaps: typeof r.weaknesses === 'string' ? JSON.parse(r.weaknesses) : r.weaknesses,
      weaknesses: typeof r.weaknesses === 'string' ? JSON.parse(r.weaknesses) : r.weaknesses,
      strengths: typeof r.strengths === 'string' ? JSON.parse(r.strengths) : r.strengths,
      study_tips: typeof r.study_tips === 'string' ? JSON.parse(r.study_tips) : r.study_tips
    }));
    
    res.json({
      success: true,
      insights
    });
  } catch (error: any) {
    console.error('Student insights error:', error);
    res.status(500).json({ error: error.message });
  }
});



router.get('/test-connection', async (req, res, next) => {
  try {
    const result = await checkGeminiConnection();
    res.json({
      status: "Success",
      message: "Conexión con Gemini (Vertex AI) establecida y funcionando.",
      testPromptResponse: result.trim(),
    });
  } catch (error) {
    console.error("Fallo la conexión con Vertex AI/Gemini:", error);
    next(new ApiError(500, `Fallo la conexión con la IA. Revise la ruta de la clave JSON o los permisos.`));
  }
});

// Ruta para el Chatbot: POST /ai/chat
router.post('/chat', async (req, res, next) => {
  try {
    // 1. Recibimos más datos del body
    const { prompt, userData, context, agentConfig, history } = req.body;
    
    if (!prompt) {
      throw new ApiError(400, "El campo 'prompt' es requerido.");
    }

    // 2. Valores por defecto
    const name = userData?.name || "Estudiante";
    const level = context?.level || "Secundaria"; 
    const subject = context?.subject || "General";
    
    const learningStyle = context?.learningStyle || "Visual";
    const currentTopics = context?.currentTopics || "General";
    const language = context?.language || "Español";
    
    const agentName = agentConfig?.name || "Aren";
    const animalType = agentConfig?.type || "Capybara";

    // 3. Selección de Prompt Basada en Rol
    // HACEMOS ESTO MÁS ROBUSTO:
    const rawRole = userData?.role || "student";
    const userRole = String(rawRole).toLowerCase().trim();
    
    console.log(`[DEBUG] Rol recibido: "${rawRole}" -> Procesado: "${userRole}"`);

    let systemInstruction = "";

    if (userRole === "teacher" || userRole === "professor" || userRole === "admin" || userRole === "docente") {
       console.log("--> Usando Prompt de PROFESOR");
       systemInstruction = PROFESSOR_SYSTEM_PROMPT
        .replace('{NAME}', name)
        .replace(/{NAME}/g, name)
        .replace(/{LANGUAGE}/g, language);
     } else {
        console.log("--> Usando Prompt de ESTUDIANTE");

        // 4. Buscar Mastery Data si es estudiante
        let masteryContext = "Sin datos de desempeño previos.";
        if (userData?.id) {
          try {
            const scores = await getStudentTopicProgress(userData.id);
            if (scores && scores.length > 0) {
              masteryContext = scores.map(s => `${s.topic_name}: ${s.score}%`).join(", ");
            }
          } catch (err) {
            console.error("[AI CHAT] Error fetching student scores:", err);
          }
        }

        systemInstruction = STUDENT_SYSTEM_PROMPT
          .replace('{AGENT_NAME}', agentName)
          .replace('{ANIMAL_TYPE}', animalType)
          .replace(/{ANIMAL_TYPE}/g, animalType)
          .replace('{NAME}', name)
          .replace(/{NAME}/g, name)
          .replace('{LEVEL}', level)
          .replace('{SUBJECT}', subject)
          .replace('{CURRENT_TOPICS}', currentTopics)
          .replace('{TOPIC_MASTERY}', masteryContext)
          .replace('{LEARNING_STYLE}', learningStyle)
          .replace(/{LANGUAGE}/g, language);
     }

    // 4. Llamamos al servicio con la instrucción
    const aiResponse = await generateContentWithGemini(prompt, systemInstruction, history);

    // 5. Save messages to chatbot tables
    // Extract user ID from JWT
    const authHeader = req.headers.authorization;
    let userId: number | null = null;
    let subjectId: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwt = await import('jsonwebtoken');
        const { appConfig } = await import('../config/env.js');
        const payload = jwt.default.verify(token, appConfig.auth.jwtSecret) as any;
        userId = payload.sub ? parseInt(payload.sub) : null;
        console.log(`[Chatbot] 🔑 Extracted userId: ${userId} from JWT`);
      } catch (e: any) {
        console.error('[Chatbot] ⚠️ Failed to extract userId from JWT:', e.message);
      }
    } else {
      console.log('[Chatbot] ⚠️ No Authorization header - messages will not be saved');
    }

    // Get subject ID from name
    if (subject && subject !== 'General') {
      subjectId = await getSubjectIdByName(subject);
    }

    // Save both user and model messages to chat_logs table for analytics
    if (userId) {
      console.log(`[ChatLogs] 📝 Saving messages for user ${userId}, subject: ${subject} (id: ${subjectId})`);
      
      try {
        // Save to learning_chat_history table (subjectId defaults to 1 if not set)
        const effectiveSubjectId = subjectId ?? 1;
        
        // Save user message
        await logChatMessage({ userId, subjectId: effectiveSubjectId, role: 'user', content: prompt });
        // Save AI response
        await logChatMessage({ userId, subjectId: effectiveSubjectId, role: 'model', content: aiResponse });
        
        console.log(`[ChatLogs] ✅ Messages saved for user ${userId}`);

        // 6. Classify and log the question to chatbot_question_log
        try {
          // Get available topics for topic detection
          const topicsForClassify = effectiveSubjectId
            ? await listTopicsBySubject(effectiveSubjectId)
            : [];
          const topicsList = topicsForClassify.map((t: any) => ({ id: t.id_topic, name: t.name }));

          // Classify the question (heuristic - no AI call)
          const classification = classifyQuestion(prompt, aiResponse, topicsList);

          // Find active class for the student
          const activeClassId = await findActiveClassForStudent(userId);

          // Log to chatbot_question_log
          await logQuestion({
            userId,
            classId: activeClassId,
            subjectId: effectiveSubjectId,
            topicDetected: classification.topicDetected,
            topicIdDetected: classification.topicIdDetected,
            frustrationLevel: classification.frustrationLevel,
            questionText: prompt,
            aiResponseSummary: classification.aiResponseSummary
          });

          console.log(`[QuestionLog] ✅ Question classified: topic=${classification.topicDetected || 'N/A'}, frustration=${classification.frustrationLevel}`);
        } catch (classifyErr) {
          console.error('[QuestionLog] ⚠️ Classification failed (non-blocking):', classifyErr);
        }
        
        // Broadcast to frontend that messages were saved (for debugging)
        try {
          const { io } = await import('../server.js');
          if (io) {
            io.emit('insight_update', {
              timestamp: new Date().toISOString(),
              message: `💾 Chat messages saved for user ${userId}`,
              data: { 
                phase: 1, 
                status: 'message_saved',
                userId,
                subject: subject 
              }
            });
          }
        } catch (e) { /* ignore broadcast errors */ }
      } catch (err: any) {
        console.error('[ChatLogs] ❌ Failed to save:', err);
        // Broadcast the error so it's visible in browser console
        try {
          const { io } = await import('../server.js');
          if (io) {
            io.emit('insight_update', {
              timestamp: new Date().toISOString(),
              message: `❌ Failed to save chat messages: ${err.message}`,
              data: { phase: 1, status: 'error', error: err.message }
            });
          }
        } catch (e) { /* ignore */ }
      }
    }

    res.json({
      response: aiResponse
    });

  } catch (error) {
    console.error("Error en /ai/chat:", error);
    next(error);
  }
});

// GET /ai/chat-history - Load chat history from database
router.get('/chat-history', async (req, res, next) => {
  try {
    // Extract user ID from JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authorization required');
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const { appConfig } = await import('../config/env.js');
    
    let userId: number;
    try {
      const payload = jwt.default.verify(token, appConfig.auth.jwtSecret) as any;
      userId = parseInt(payload.sub);
    } catch (e) {
      throw new ApiError(401, 'Invalid token');
    }

    // Get subject from query params
    const subjectName = req.query.subject as string;
    let subjectId: number | null = null;

    if (subjectName && subjectName !== 'General') {
      subjectId = await getSubjectIdByName(subjectName);
    }

    // Fetch chat history from chat_logs table
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await getChatHistory({ userId, subjectId, limit });

    console.log(`[ChatHistory] Loaded ${history.length} messages for user ${userId}, subject: ${subjectName || 'all'}`);

    // Format for frontend (chat_logs uses 'role' field directly)
    const formattedHistory = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at
    }));

    res.json({
      success: true,
      history: formattedHistory
    });

  } catch (error) {
    console.error("Error en /ai/chat-history:", error);
    next(error);
  }
});

// Ruta para generar Quiz: POST /ai/generate-quiz
router.post('/generate-quiz', async (req, res, next) => {
  try {
    const { 
      subject, 
      level, 
      topics, 
      questionCount, 
      language,
      customPrompt 
    } = req.body;

    // Validation
    if (!subject || !topics || topics.length === 0) {
      throw new ApiError(400, "Subject and topics are required.");
    }

    // Build the prompt with replacements (ID: Name mapping for deterministic results)
    const topicsList = Array.isArray(topics) 
      ? topics.map((t: any) => `ID ${t.id}: ${t.name}`).join(", ") 
      : topics;
    
    const quizPrompt = QUIZ_GENERATOR_PROMPT
      .replace(/{SUBJECT}/g, subject)
      .replace(/{LEVEL}/g, String(level || 5))
      .replace(/{TOPICS_LIST}/g, topicsList)
      .replace(/{QUESTION_COUNT}/g, String(questionCount || 5))
      .replace(/{LANGUAGE}/g, language || "Spanish")
      .replace(/{CUSTOM_PROMPT}/g, customPrompt || "None");

    console.log("[Quiz Generator] Generating quiz with prompt...");
    console.log(`  Subject: ${subject}, Level: ${level}, Topics: ${topicsList}`);

    // Call Gemini API
    const aiResponse = await generateContentWithGemini(
      "Generate a quiz based on the following instructions:",
      quizPrompt
    );

    // Try to parse JSON from response
    let rawResult;
    try {
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/```\s*$/, "");
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/```\s*$/, "");
      }
      rawResult = JSON.parse(cleanedResponse.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      throw new ApiError(500, "AI returned invalid JSON. Please try again.");
    }

    // Transform to frontend format including names
    const questions = (rawResult.questions || []).map((q: any) => {
      // Find the name for the given ID (fallback to original topic name if ID missing)
      const topicInfo = Array.isArray(topics) 
        ? topics.find((t: any) => Number(t.id) === Number(q.topic_id))
        : null;

      return {
        text: q.question_text,
        topic: topicInfo ? topicInfo.name : "General",
        topicId: q.topic_id || null, // Preserve the numeric ID
        points: q.points || 1.0,
        allowMultipleSelection: q.allow_multiple_selection || false,
        answers: [
          { text: q.option_1, isCorrect: (q.correct_options || []).includes(1) },
          { text: q.option_2, isCorrect: (q.correct_options || []).includes(2) },
          { text: q.option_3, isCorrect: (q.correct_options || []).includes(3) },
          { text: q.option_4, isCorrect: (q.correct_options || []).includes(4) }
        ]
      };
    });

    console.log(`[Quiz Generator] Successfully generated ${questions.length} questions`);

    res.json({
      success: true,
      data: { questions }
    });

  } catch (error) {
    console.error("Error en /ai/generate-quiz:", error);
    next(error);
  }
});

// GET /ai/chatbot-questions - Get chatbot questions for professor dashboard
router.get('/chatbot-questions', async (req, res, next) => {
  try {
    const classId = req.query.classId ? parseInt(req.query.classId as string) : null;
    const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string) : null;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    console.log(`[API] /chatbot-questions called classId=${classId}, subjectId=${subjectId}`);

    const { questions, total } = await getQuestionsByClass({
      classId,
      subjectId,
      limit,
      offset
    });

    // Format for frontend
    const formatted = questions.map(q => ({
      id: q.id_log,
      studentName: [q.user_name, q.user_last_name].filter(Boolean).join(' ') || 'Estudiante',
      topic: q.topic_detected || 'General',
      topicId: q.id_topic_detected,
      frustration: q.frustration_level,
      question: q.question_text,
      aiSummary: q.ai_response_summary,
      timestamp: q.created_at
    }));

    res.json({
      success: true,
      questions: formatted,
      total,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Chatbot questions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /ai/topic-summaries - Get per-topic AI summaries for a class
router.get('/topic-summaries', async (req, res, next) => {
  try {
    const classId = parseInt(req.query.classId as string) || DEFAULT_CLASS_ID;

    console.log(`[API] /topic-summaries called classId=${classId}`);

    // Get topics with their scores and AI summaries for this class
    const topicResult = await db.query<any>(
      `SELECT 
          ct.id_topic,
          t.name as topic_name,
          t.id_subject,
          s.name_subject as subject_name,
          ct.score_average,
          ct.ai_summary,
          COUNT(DISTINCT cst.id_user) as students_with_score
       FROM class_topic ct
       INNER JOIN topic t ON t.id_topic = ct.id_topic
       INNER JOIN subject s ON s.id_subject = t.id_subject
       LEFT JOIN class_student_topic cst ON cst.id_class = ct.id_class AND cst.id_topic = ct.id_topic
       WHERE ct.id_class = ?
       GROUP BY ct.id_topic, t.name, t.id_subject, s.name_subject, ct.score_average, ct.ai_summary
       ORDER BY t.id_subject, t.name`,
      [classId]
    );

    // Get topic relations (correlations)
    const relationResult = await db.query<any>(
      `SELECT 
          tfr.id_topic_father,
          tf.name as father_name,
          tfr.id_topic_son,
          ts.name as son_name,
          tfr.correlation_coefficient
       FROM topic_father_son_relation tfr
       INNER JOIN topic tf ON tf.id_topic = tfr.id_topic_father
       INNER JOIN topic ts ON ts.id_topic = tfr.id_topic_son
       INNER JOIN class_topic ct ON (ct.id_topic = tfr.id_topic_father OR ct.id_topic = tfr.id_topic_son)
       WHERE ct.id_class = ?
       GROUP BY tfr.id_topic_father, tf.name, tfr.id_topic_son, ts.name, tfr.correlation_coefficient`,
      [classId]
    );

    // Get question stats from chatbot_question_log
    let questionStats: any[] = [];
    try {
      const { getQuestionStatsByTopic } = await import('../repositories/chatbotQuestionLogRepository.js');
      questionStats = await getQuestionStatsByTopic(classId);
    } catch (e) {
      console.warn('[API] chatbot_question_log table may not exist yet');
    }

    // Build response
    const topics = topicResult.rows.map((topic: any) => {
      // Find relations for this topic
      const relations = relationResult.rows
        .filter((r: any) => r.id_topic_father === topic.id_topic || r.id_topic_son === topic.id_topic)
        .map((r: any) => ({
          relatedTopic: r.id_topic_father === topic.id_topic ? r.son_name : r.father_name,
          relatedTopicId: r.id_topic_father === topic.id_topic ? r.id_topic_son : r.id_topic_father,
          type: r.id_topic_father === topic.id_topic ? 'parent_of' : 'child_of',
          correlation: r.correlation_coefficient
        }));

      // Find question stats for this topic
      const qStats = questionStats.find(qs => qs.topicId === topic.id_topic) || null;

      // Parse AI summary if it's JSON
      let parsedSummary = null;
      if (topic.ai_summary) {
        try {
          parsedSummary = JSON.parse(topic.ai_summary);
        } catch {
          parsedSummary = { summary: topic.ai_summary };
        }
      }

      return {
        topicId: topic.id_topic,
        topicName: topic.topic_name,
        subjectId: topic.id_subject,
        subjectName: topic.subject_name,
        scoreAverage: topic.score_average ? parseFloat(topic.score_average) : null,
        studentsWithScore: topic.students_with_score,
        aiSummary: parsedSummary,
        relations,
        questionStats: qStats ? {
          count: qStats.count,
          avgFrustration: qStats.avgFrustration,
          sampleQuestions: qStats.sampleQuestions
        } : null
      };
    });

    res.json({
      success: true,
      classId,
      topics
    });
  } catch (error: any) {
    console.error('Topic summaries error:', error);
    res.status(500).json({ error: error.message });
  }
});

export const aiRouter = router;