import {
  GoogleGenerativeAI,
  type FunctionDeclaration,
  type FunctionCall,
} from "@google/generative-ai";
import { logStructured } from "@/lib/logging/structured";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "La API KEY de GEMINI no está configurada en las variables de entorno",
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

// ── Document analysis (backward-compatible, used by analyze route) ──

export async function analyzeDocument(
  text: string,
  analysisType: "summary" | "qa" | "sentiment" | "entities" | "extract",
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompts = {
      summary: `Please provide a comprehensive summary of the following document. Include main points, key findings, and conclusions:\n\n${text}`,
      qa: `Based on the following document, generate 5 important questions and their answers:\n\n${text}`,
      sentiment: `Analyze the sentiment and tone of the following document. Provide overall sentiment (positive/negative/neutral) and key emotional tones detected:\n\n${text}`,
      entities: `Extract all named entities (people, organizations, locations, dates, etc.) from the following document:\n\n${text}`,
      extract: `Extract key information from the following document in structured format:\n\n${text}`,
    };

    const prompt = prompts[analysisType];
    const result = await model.generateContent(prompt);
    const response = result.response;

    return response.text();
  } catch (error) {
    console.log("Gemini error:", error);
    return `Could not analyze for ${analysisType}`;
  }
}

// ── Agent query with function calling ──

interface QueryWithToolsResult {
  text: string;
  functionCalls: FunctionCall[] | undefined;
}

export async function queryWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: FunctionDeclaration[],
): Promise<QueryWithToolsResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: tools }],
  });

  const result = await model.generateContent(userMessage);
  const response = result.response;

  // response.text() tira solo cuando el candidate tiene bad finishReason
  // (SAFETY, RECITATION, LANGUAGE) o el prompt entero fue bloqueado. Para
  // respuestas function-only retorna "" sin tirar. El catch NO es para
  // "ocultar function calls" — es para observar bloqueos del modelo.
  let text = "";
  try {
    text = response.text();
  } catch (err) {
    logStructured({
      event: "gemini_response_parse_error",
      level: "warn",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    text,
    functionCalls: response.functionCalls(),
  };
}
