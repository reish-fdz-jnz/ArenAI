import { db } from '../db/pool.js';

// --- CONFIGURATION ---
const MIN_READ_TIME_SECONDS = 10;
const PASSING_SCORE = 70;
const CLASS_FAIL_THRESHOLD = 60;

const CAUSE_CODES = {
  PREREQUISITE_GAP: 'ERR_GAP',
  GUESSING: 'ERR_TIME',
  SYSTEMIC: 'ERR_SYS',
  CONCEPT_SPECIFIC: 'ERR_CONCEPT',
  LOW_ENGAGEMENT: 'ERR_ENGAGE',
  FATIGUE: 'ERR_FATIGUE',
};

const FRUSTRATION_KEYWORDS = [
  'no entiendo', 'dificil', 'ayuda', 'confundido', 'confunden',
  'no puedo', 'no me sale', 'no se', 'complicado', 'perdido',
];

// --- TYPES ---
interface TopicScore {
  id_topic: number;
  score_pct: number;
  correctness_pct: number;
  avg_time: number;
  question_count: number;
}

interface ClassAverage {
  id_topic: number;
  avg_score_pct: number;
}

interface Relation {
  id_topic_father_son_relation: number;
  id_topic_father: number;
  id_topic_son: number;
  correlation_coefficient: number;
}

interface TopicResource {
  id_topic_resource: number;
  id_topic: number;
  resource_source: string;
  description: string;
  resource_quality: number;
}

interface ChatMessage {
  id_user: number;
  id_subject: number;
  role: string;
  content: string;
}

// --- DATABASE FETCHERS ---

export async function fetchTopicRelations(): Promise<Relation[]> {
  const result = await db.query<Relation>('SELECT * FROM topic_father_son_relation');
  return result.rows;
}

export async function fetchTopicResources(topicId?: number): Promise<TopicResource[]> {
  if (topicId) {
    const result = await db.query<TopicResource>('SELECT * FROM topic_resource WHERE id_topic = ?', [topicId]);
    return result.rows;
  }
  const result = await db.query<TopicResource>('SELECT * FROM topic_resource');
  return result.rows;
}

export async function fetchStudentScores(studentId: number): Promise<Record<number, TopicScore>> {
  const sql = `
    SELECT qq.id_topic,
           AVG(qr.is_correct) * 100 as correctness_pct,
           AVG(qr.time_taken_seconds) as avg_time,
           COUNT(*) as question_count,
           SUM(qr.points_awarded) / SUM(qq.points) * 100 as score_pct
    FROM quiz_response qr
    JOIN quiz_question qq ON qq.id_question = qr.id_question
    JOIN quiz_attempt qa ON qa.id_attempt = qr.id_attempt
    WHERE qa.id_student = ?
    GROUP BY qq.id_topic
  `;
  const result = await db.query<any>(sql, [studentId]);
  
  const map: Record<number, TopicScore> = {};
  for (const row of result.rows) {
    map[row.id_topic] = {
      id_topic: row.id_topic,
      score_pct: Number(row.score_pct) || 0,
      correctness_pct: Number(row.correctness_pct) || 0,
      avg_time: Number(row.avg_time) || 0,
      question_count: Number(row.question_count) || 0,
    };
  }
  return map;
}

export async function fetchClassAverages(classId: number): Promise<Record<number, ClassAverage>> {
  const sql = `
    SELECT qq.id_topic,
           SUM(qr.points_awarded) / SUM(qq.points) * 100 as avg_score_pct
    FROM quiz_response qr
    JOIN quiz_question qq ON qq.id_question = qr.id_question
    JOIN quiz_attempt qa ON qa.id_attempt = qr.id_attempt
    JOIN class_student cs ON cs.id_user = qa.id_student
    WHERE cs.id_class = ?
    GROUP BY qq.id_topic
  `;
  const result = await db.query<any>(sql, [classId]);
  
  const map: Record<number, ClassAverage> = {};
  for (const row of result.rows) {
    map[row.id_topic] = {
      id_topic: row.id_topic,
      avg_score_pct: Number(row.avg_score_pct) || 0,
    };
  }
  return map;
}

export async function fetchChatHistory(userId: number, subjectId: number): Promise<ChatMessage[]> {
  const sql = `SELECT id_user, id_subject, role, content FROM learning_chat_history WHERE id_user = ? AND id_subject = ?`;
  const result = await db.query<ChatMessage>(sql, [userId, subjectId]);
  return result.rows;
}

export async function fetchTopicName(topicId: number): Promise<string> {
  const result = await db.query<any>('SELECT name FROM topic WHERE id_topic = ?', [topicId]);
  if (result.rows.length > 0) {
    return result.rows[0].name;
  }
  return 'Unknown Topic';
}

// --- DIAGNOSTIC LAYERS ---

function layerGuessing(avgTime: number) {
  if (avgTime < MIN_READ_TIME_SECONDS) {
    const suspicion = Math.min(1.0, 1.0 - (avgTime / MIN_READ_TIME_SECONDS));
    return {
      layer: 'GUESSING',
      cause_code: CAUSE_CODES.GUESSING,
      suspicion_score: Number(suspicion.toFixed(2)),
      detail: `Promedio de tiempo ${avgTime.toFixed(1)}s (mínimo esperado: ${MIN_READ_TIME_SECONDS}s)`,
    };
  }
  return {
    layer: 'GUESSING',
    cause_code: CAUSE_CODES.GUESSING,
    suspicion_score: 0.0,
    detail: `Promedio de tiempo ${avgTime.toFixed(1)}s — lectura adecuada`,
  };
}

async function layerPrerequisites(topicId: number, studentScores: Record<number, TopicScore>, relations: Relation[]) {
  const parents = relations.filter((r) => r.id_topic_son === topicId);

  if (parents.length === 0) {
    return {
      layer: 'PREREQUISITE_GAP',
      cause_code: CAUSE_CODES.PREREQUISITE_GAP,
      suspicion_score: 0.0,
      detail: 'Tema raíz — no tiene prerrequisitos',
      weak_prerequisites: [],
    };
  }

  const weakParents = [];
  let maxGap = 0.0;

  for (const rel of parents) {
    const parentId = rel.id_topic_father;
    const parentScore = studentScores[parentId]?.score_pct || 0;
    const parentName = await fetchTopicName(parentId);
    const gap = rel.correlation_coefficient * (100 - parentScore);

    if (parentScore < PASSING_SCORE) {
      weakParents.push({
        id_topic: parentId,
        name: parentName,
        score: parentScore,
        correlation: rel.correlation_coefficient,
        gap: Number(gap.toFixed(2)),
      });
    }

    if (gap > maxGap) {
      maxGap = gap;
    }
  }

  const suspicion = weakParents.length > 0 ? Math.min(1.0, maxGap / 100) : 0.0;

  let detail = 'Sin lagunas detectadas en prerrequisitos';
  if (weakParents.length > 0) {
    // Find the worst parent based on gap
    const worst = weakParents.reduce((prev, current) => (prev.gap > current.gap ? prev : current));
    detail = `Laguna crítica en '${worst.name}' (score: ${worst.score}%, correlación: ${worst.correlation})`;
  }

  return {
    layer: 'PREREQUISITE_GAP',
    cause_code: CAUSE_CODES.PREREQUISITE_GAP,
    suspicion_score: Number(suspicion.toFixed(2)),
    detail,
    weak_prerequisites: weakParents,
  };
}

function layerGroupFilter(studentScore: number, sectionAvg: number) {
  if (sectionAvg < CLASS_FAIL_THRESHOLD) {
    const suspicion = Math.min(1.0, (CLASS_FAIL_THRESHOLD - sectionAvg) / CLASS_FAIL_THRESHOLD);
    return {
      layer: 'SYSTEMIC',
      cause_code: CAUSE_CODES.SYSTEMIC,
      suspicion_score: Number(suspicion.toFixed(2)),
      detail: `Promedio de la sección: ${sectionAvg.toFixed(1)}% (debajo del umbral de ${CLASS_FAIL_THRESHOLD}%). Problema probable: método de enseñanza o material`,
      is_systemic: true,
    };
  }

  const gapVsClass = Math.max(0, sectionAvg - studentScore);
  let suspicion = 0.0;
  if (gapVsClass > 20) {
    suspicion = Math.min(1.0, gapVsClass / 100);
  }

  return {
    layer: 'SYSTEMIC',
    cause_code: CAUSE_CODES.SYSTEMIC,
    suspicion_score: Number(suspicion.toFixed(2)),
    detail: `Promedio sección: ${sectionAvg.toFixed(1)}%, Estudiante: ${studentScore.toFixed(1)}%. Diferencia: ${gapVsClass.toFixed(1)}pts — ${gapVsClass > 20 ? 'Problema individual' : 'Dentro del rango normal'}`,
    is_systemic: false,
  };
}

function layerChatMining(chatHistory: ChatMessage[]) {
  const userMsgs = chatHistory.filter((m) => m.role === 'user');

  let hits = 0;
  const matchedKeywords: string[] = [];

  for (const msg of userMsgs) {
    const contentLower = msg.content.toLowerCase();
    for (const kw of FRUSTRATION_KEYWORDS) {
      if (contentLower.includes(kw)) {
        hits++;
        if (!matchedKeywords.includes(kw)) {
          matchedKeywords.push(kw);
        }
      }
    }
  }

  const suspicion = Math.min(1.0, hits * 0.15); // max reached at ~7 hits

  return {
    layer: 'LOW_ENGAGEMENT',
    cause_code: CAUSE_CODES.LOW_ENGAGEMENT,
    suspicion_score: Number(suspicion.toFixed(2)),
    detail: hits > 0 ? `${hits} señal(es) de frustración detectada(s): [${matchedKeywords.join(', ')}]` : 'Sin señales de frustración en el chat',
    keyword_hits: hits,
    matched_keywords: matchedKeywords,
  };
}

// --- ENGINE DECISION PROCESS ---

function computeSuccessProbability(topicId: number, studentScores: Record<number, TopicScore>, relations: Relation[]): number {
  const parents = relations.filter((r) => r.id_topic_son === topicId);
  if (parents.length === 0) return 1.0;

  let product = 1.0;
  for (const rel of parents) {
    const parentScore = studentScores[rel.id_topic_father]?.score_pct || 0;
    const skill = parentScore / 100.0;
    product *= skill * rel.correlation_coefficient;
  }
  return Number(product.toFixed(4));
}

function findBestResource(topicId: number, resources: TopicResource[]): TopicResource | null {
  const topicRes = resources.filter((r) => r.id_topic === topicId);
  if (topicRes.length === 0) return null;
  return topicRes.reduce((prev, current) => (prev.resource_quality > current.resource_quality ? prev : current));
}

export async function runDiagnosticEngine(studentId: number, topicId: number, classId: number, subjectId: number) {
  // 1. Fetch live contextual data
  const relations = await fetchTopicRelations();
  const resources = await fetchTopicResources();
  const studentScoresMap = await fetchStudentScores(studentId);
  const classAveragesMap = await fetchClassAverages(classId);
  const chatHistory = await fetchChatHistory(studentId, subjectId);
  const topicName = await fetchTopicName(topicId);

  // Parse direct metrics
  const specificStudentTopic = studentScoresMap[topicId];
  const studentScore = specificStudentTopic?.score_pct || 0;
  const quizTimeAvg = specificStudentTopic?.avg_time || 0;
  const sectionAvg = classAveragesMap[topicId]?.avg_score_pct || 0;

  // 2. Run diagnostic layers
  const resultGuessing = layerGuessing(quizTimeAvg);
  const resultPrereqs = await layerPrerequisites(topicId, studentScoresMap, relations);
  const resultGroup = layerGroupFilter(studentScore, sectionAvg);
  const resultChat = layerChatMining(chatHistory);

  const layers: any[] = [resultGuessing, resultPrereqs, resultGroup, resultChat];

  // 3. Priority Weighted Selection
  const PRIORITY_WEIGHTS: Record<string, number> = {
    GUESSING: 1.5,
    PREREQUISITE_GAP: 1.3,
    SYSTEMIC: 1.2,
    LOW_ENGAGEMENT: 1.0,
  };

  for (const layer of layers) {
    const weight = PRIORITY_WEIGHTS[layer.layer] || 1.0;
    layer._effective_score = Number((layer.suspicion_score * weight).toFixed(3));
  }

  // Find layer with highest effective score
  let primary = layers.reduce((prev, current) => (prev._effective_score > current._effective_score ? prev : current));

  if (primary._effective_score < 0.05) {
    primary = {
      layer: 'CONCEPT_SPECIFIC',
      cause_code: CAUSE_CODES.CONCEPT_SPECIFIC,
      suspicion_score: 0.5,
      detail: `Dificultad con el concepto específico de '${topicName}'`,
      _effective_score: 0.5,
    };
  }

  // 4. Calculate Global Metrics
  const severity = Number((primary.suspicion_score * (1 - studentScore / 100)).toFixed(2));
  const successProb = computeSuccessProbability(topicId, studentScoresMap, relations);

  // 5. Build Suggested Actions
  let suggestedAction = 'Continuar con práctica del tema actual';
  let suggestedResource: TopicResource | null = null;

  if (primary.cause_code === CAUSE_CODES.PREREQUISITE_GAP && resultPrereqs.weak_prerequisites.length > 0) {
    const worstPrereq = resultPrereqs.weak_prerequisites.reduce((prev: any, current: any) => (prev.gap > current.gap ? prev : current));
    const res = findBestResource(worstPrereq.id_topic, resources);
    if (res) {
      suggestedResource = res;
      suggestedAction = `Repasar Recurso ID #${res.id_topic_resource} (${res.description})`;
    } else {
      suggestedAction = `Repasar '${worstPrereq.name}' antes de continuar`;
    }
  } else if (primary.cause_code === CAUSE_CODES.GUESSING) {
    suggestedAction = 'Implementar quiz supervisado con temporizador mínimo';
  } else if (primary.cause_code === CAUSE_CODES.SYSTEMIC) {
    suggestedAction = 'Revisar material y método de enseñanza del tema con el profesor';
  } else if (primary.cause_code === CAUSE_CODES.LOW_ENGAGEMENT || primary.cause_code === CAUSE_CODES.CONCEPT_SPECIFIC) {
    const res = findBestResource(topicId, resources);
    if (res) {
      suggestedResource = res;
      suggestedAction = `Sesión guiada con IA + Recurso ID #${res.id_topic_resource} (${res.description})`;
    }
  }

  // 6. Output Construction
  let behaviorNote = '';
  if (quizTimeAvg > 0 && quizTimeAvg < MIN_READ_TIME_SECONDS) {
    behaviorNote = `Respuestas extremadamente rápidas (${quizTimeAvg.toFixed(0)}s avg) → posible bateo`;
  } else if (quizTimeAvg > 90) {
    behaviorNote = `Tiempo alto (${quizTimeAvg.toFixed(0)}s avg) → esfuerzo genuino sin éxito`;
  } else {
    behaviorNote = `Tiempo normal (${quizTimeAvg.toFixed(0)}s avg)`;
  }

  return {
    student_id: studentId,
    topic_id: topicId,
    topic_failed: topicName,
    student_score: studentScore,
    analysis_metadata: {
      primary_cause_code: primary.cause_code,
      primary_cause_layer: primary.layer,
      severity_index: severity,
      confidence_level: primary.suspicion_score,
      success_probability: successProb,
    },
    root_cause_analysis: {
      primary_cause: primary.layer.replace(/_/g, ' ').replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()),
      details: primary.detail,
      behavior_note: behaviorNote,
      context_check: resultGroup.detail,
      chat_signals: resultChat.detail,
      impacted_prerequisite_id: resultPrereqs.weak_prerequisites.length > 0 ? resultPrereqs.weak_prerequisites[0].id_topic : null,
    },
    suggested_action: suggestedAction,
    suggested_resource: suggestedResource,
    all_layers: layers,
  };
}
