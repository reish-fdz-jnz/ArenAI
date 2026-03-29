// C:\ArenAI\ArenAI\backend\src\services\geminiService.ts

import { GoogleGenAI } from '@google/genai';
// import { appConfig } from '../config/env.js'; // Descomenta si usas tu config centralizada

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

if (!PROJECT_ID || !LOCATION) {
    console.warn("⚠️ ADVERTENCIA: GOOGLE_CLOUD_PROJECT_ID o GOOGLE_CLOUD_LOCATION no están definidos. El servicio de Gemini podría fallar.");
}

// CORRECCIÓN AQUÍ:
const ai = new GoogleGenAI({
    vertexai: true, // Esto activa el modo Vertex AI
    location: LOCATION || 'us-central1',
    project: PROJECT_ID || 'coastal-burner-491004-f0',
});

// Usamos el modelo 1.5 Flash que es rápido y económico en Vertex AI
const GEMINI_MODEL = "gemini-2.0-flash-lite-001";

// Modificamos la función para aceptar un segundo parámetro: systemInstruction
// Modificamos la función para aceptar un segundo parámetro: systemInstruction
// Y un tercer parámetro opcional: history
export async function generateContentWithGemini(
    userPrompt: string,
    systemInstruction?: string,
    history?: any[]
): Promise<string> {
    try {
        let contentsPayload: any[] = [];

        // 1. If history exists, format it correctly
        if (history && Array.isArray(history) && history.length > 0) {
            // Ensure proper format for Gemini API
            contentsPayload = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: msg.parts || [{ text: msg.message || "" }]
            }));
        }

        // 2. Construct the logical "Final Prompt" for the current turn
        // We attach the System Instruction to the CURRENT user prompt effectively by formatting.
        // Or we can just pretend the system instruction is a preamble. 
        // For simplicity and robustness with this SDK:
        // We will append the current user prompt to the contents list.

        let finalUserText = userPrompt;

        // If it's a fresh chat (no history), or we just want to reinforce the instruction:
        if (systemInstruction) {
            finalUserText = `${systemInstruction}\n\n----------------\nPREGUNTA DEL USUARIO:\n${userPrompt}`;
        }

        // Add the current interaction
        contentsPayload.push({
            role: "user",
            parts: [{ text: finalUserText }]
        });

        const response: any = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: contentsPayload,
        });

        if (response && response.text) {
            return typeof response.text === 'function' ? response.text() : response.text;
        }

        if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return response.candidates[0].content.parts[0].text;
        }

        return JSON.stringify(response);
    } catch (error) {
        console.error("Error generating content with Gemini:", error);
        throw error;
    }
}

/**
 * Quick test function to verify connection.
 */
export async function checkGeminiConnection(): Promise<string> {
    const prompt = "Hello how are you";
    console.log(`[Gemini Test] Sending prompt: ${prompt}`);

    try {
        // Nota: en este SDK a veces se usa config como segundo argumento, 
        // pero para generateContent suele ser el primero con las opciones.
        const response: any = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        let text = '';
        if (response.text) {
            text = typeof response.text === 'function' ? response.text() : response.text;
        } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            text = response.candidates[0].content.parts[0].text;
        }

        return text;
    } catch (error) {
        console.error("Gemini connection test failed:", error);
        // Mostrar detalles del error si es de Google Cloud
        if (error instanceof Error) {
            console.error("Detalles del error:", error.message);
        }
        throw error;
    }
}
