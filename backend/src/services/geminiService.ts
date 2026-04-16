// C:\ArenAI\ArenAI\backend\src\services\geminiService.ts
import { VertexAI } from '@google-cloud/vertexai';
import { appConfig } from '../config/env.js';

// Commented out Ollama solution
/*
const OLLAMA_URL = "http://213.250.149.27:11434/api/generate";
const OLLAMA_MODEL = "qwen2.5:0.5b";
*/

// Initialize Vertex AI
const project = appConfig.google.projectId || 'coastal-burner-491004-f0';
const location = appConfig.google.location || 'us-central1';

const vertexAI = new VertexAI({
    project: project,
    location: location,
});

/**
 * Generates content using Google Gemini (Vertex AI).
 * Replaces the previous Ollama implementation.
 */
export async function generateContentWithGemini(
    userPrompt: string, 
    systemInstruction?: string, 
    history?: any[]
): Promise<string> {
    try {
        console.log(`[Gemini] Generating content for project: ${project} using gemini-2.5-flash`);

        // In Vertex AI SDK, systemInstruction is best passed during model initialization
        const generativeModel = vertexAI.getGenerativeModel({
            model: 'gemini-2.5-flash', // Using specific version to avoid 404 alias issues
            systemInstruction: systemInstruction ? {
                role: 'system',
                parts: [{ text: systemInstruction }]
            } : undefined,
        });

        // Construct the chat with history
        const chat = generativeModel.startChat({
            history: history ? history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.parts?.[0]?.text || msg.message || msg.content || "" }]
            })) : [],
        });

        const result = await chat.sendMessage(userPrompt);
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!text) {
            console.warn("[Gemini] Empty response received from model");
        }

        return text.trim();

    } catch (error) {
        console.error("Error generating content with Gemini (Vertex AI):", error);
        throw error;
    }
}

/**
 * Quick test function to verify connection.
 */
export async function checkGeminiConnection(): Promise<string> {
    const prompt = "Asume el rol del motor de inteligencia artificial de ArenAI. Responde en una sola oración: ¿estás listo para empezar a procesar contenido educativo?";
    console.log(`[Gemini Test] Sending test prompt to project: ${project}`);
    
    try {
        const generativeModel = vertexAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });

        const result = await generativeModel.generateContent(prompt);
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        return text.trim();
    } catch (error) {
        console.error("Gemini connection test failed:", error);
        if (error instanceof Error) {
            console.error("Detalles del error:", error.message);
        }
        throw error;
    }
}

