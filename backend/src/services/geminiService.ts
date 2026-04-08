// C:\ArenAI\ArenAI\backend\src\services\geminiService.ts

const OLLAMA_URL = "http://213.250.149.27:11434/api/generate";
const OLLAMA_MODEL = "qwen2.5:0.5b";

// Modificamos la función para aceptar un segundo parámetro: systemInstruction
// Y un tercer parámetro opcional: history
export async function generateContentWithGemini(
    userPrompt: string, 
    systemInstruction?: string, 
    history?: any[]
): Promise<string> {
    try {
        let finalPrompt = "";

        // Si hay historial (history), podemos agregarlo al contexto
        if (history && Array.isArray(history) && history.length > 0) {
            for (const msg of history) {
                const role = msg.role === 'user' ? 'Usuario' : 'IA';
                const text = msg.parts?.[0]?.text || msg.message || "";
                finalPrompt += `${role}: ${text}\n\n`;
            }
        }

        // Agregar la instrucción del sistema al prompt final si existe
        if (systemInstruction) {
             finalPrompt += `${systemInstruction}\n\n----------------\nPREGUNTA DEL USUARIO:\n${userPrompt}`;
        } else {
             finalPrompt += `Usuario: ${userPrompt}`;
        }

        const payload = {
            model: OLLAMA_MODEL,
            prompt: finalPrompt,
            stream: false
        };

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();
        
        return data.response ? data.response.trim() : JSON.stringify(data);
    } catch (error) {
        console.error("Error generating content with Ollama (geminiService):", error);
        throw error;
    }
}

/**
 * Quick test function to verify connection.
 */
export async function checkGeminiConnection(): Promise<string> {
    const prompt = "Asume el rol del motor de inteligencia artificial de ArenAI. Responde en una sola oración: ¿estás listo para empezar a procesar contenido educativo?";
    console.log(`[Ollama Test] Sending prompt: ${prompt}`);
    
    try {
        const payload = {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false
        };

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();
        return data.response ? data.response.trim() : JSON.stringify(data);
    } catch (error) {
        console.error("Ollama connection test failed:", error);
        if (error instanceof Error) {
            console.error("Detalles del error:", error.message);
        }
        throw error;
    }
}

