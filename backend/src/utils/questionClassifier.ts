// ============================================================
// Heuristic Question Classifier
// Classifies chatbot questions by topic and frustration level
// Uses keyword matching (no AI call) for real-time speed
// ============================================================

/**
 * Frustration indicators — words/patterns that suggest frustration
 */
const HIGH_FRUSTRATION_PATTERNS = [
    /no entiendo/i, /no comprendo/i, /no (le |lo )?capto/i,
    /estoy frustrad/i, /me frustr/i, /esto es imposible/i,
    /no puedo/i, /me rindo/i, /ya no s[eé]/i,
    /ayuda\s*!+/i, /por favor\s*!+/i, /socorro/i,
    /\?\?+/, /!!+/, /odio/i, /detesto/i,
    /no sirvo/i, /soy (malo|mala|pésim)/i,
    /demasiado difícil/i, /muy difícil/i,
    /no me sale/i, /llevo (rato|horas|mucho)/i,
];

const MEDIUM_FRUSTRATION_PATTERNS = [
    /me confund/i, /confus/i, /no me queda claro/i,
    /tengo duda/i, /no estoy segur/i,
    /me cuesta/i, /se me dificulta/i,
    /otra vez/i, /de nuevo/i, /repite/i,
    /no recuerdo/i, /se me olvid/i,
    /\?$/, // Single question mark (mild confusion)
    /podrías explicar/i, /puedes ayudar/i,
    /qué hacía mal/i, /por qué (está|estaba) mal/i,
];

/**
 * Detect frustration level from message text
 */
export function detectFrustrationLevel(text: string): 'low' | 'medium' | 'high' {
    // Check high first
    for (const pattern of HIGH_FRUSTRATION_PATTERNS) {
        if (pattern.test(text)) return 'high';
    }
    // Then medium
    for (const pattern of MEDIUM_FRUSTRATION_PATTERNS) {
        if (pattern.test(text)) return 'medium';
    }
    return 'low';
}

/**
 * Detect topic from message using available topic names
 * Returns the best matching topic name and ID (if available)
 */
export function detectTopic(
    text: string, 
    availableTopics: { id?: number; name: string }[]
): { topicName: string | null; topicId: number | null } {
    if (!availableTopics || availableTopics.length === 0) {
        return { topicName: null, topicId: null };
    }

    const normalizedText = text.toLowerCase().trim();
    
    // Score each topic by how many words match
    let bestMatch: { name: string; id?: number; score: number } | null = null;

    for (const topic of availableTopics) {
        const topicWords = topic.name.toLowerCase().split(/\s+/);
        let score = 0;
        
        for (const word of topicWords) {
            // Skip very short words (articles etc.)
            if (word.length <= 2) continue;
            
            if (normalizedText.includes(word)) {
                score += word.length; // Longer words = stronger signal
            }
        }
        
        // Also check if the full topic name appears in the text
        if (normalizedText.includes(topic.name.toLowerCase())) {
            score += topic.name.length * 2; // Bonus for full match
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { name: topic.name, id: topic.id, score };
        }
    }

    if (bestMatch && bestMatch.score >= 4) { // Minimum threshold to avoid false positives
        return {
            topicName: bestMatch.name,
            topicId: bestMatch.id ?? null
        };
    }

    return { topicName: null, topicId: null };
}

/**
 * Classify a question: topic + frustration + response summary
 * Called inline during POST /ai/chat for real-time classification
 */
export function classifyQuestion(
    questionText: string,
    aiResponse: string,
    availableTopics: { id?: number; name: string }[]
): {
    topicDetected: string | null;
    topicIdDetected: number | null;
    frustrationLevel: 'low' | 'medium' | 'high';
    aiResponseSummary: string;
} {
    const { topicName, topicId } = detectTopic(questionText, availableTopics);
    const frustrationLevel = detectFrustrationLevel(questionText);
    const aiResponseSummary = aiResponse.substring(0, 200).trim();

    return {
        topicDetected: topicName,
        topicIdDetected: topicId,
        frustrationLevel,
        aiResponseSummary
    };
}
