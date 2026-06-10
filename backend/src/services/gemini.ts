import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("[gemini] GEMINI_API_KEY is not set — AI insights will be unavailable");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MODEL = "gemini-1.5-flash";

// System prompt giving the model F1 context
const SYSTEM_PROMPT = `You are PitWall AI, an expert Formula 1 race strategist and analyst.
You have deep knowledge of:
- F1 race strategy, tire compounds (Soft/Medium/Hard/Inter/Wet) and degradation
- DRS, Safety Cars, Virtual Safety Cars and their strategic impact
- Pit stop timing windows and undercut/overcut strategies
- Driver and constructor championship standings
- Circuit characteristics and their effect on strategy choices
- Historical race data and statistics

Answer questions concisely and authoritatively. Use F1 terminology naturally.
When discussing lap times, use seconds or M:SS.mmm format.
Keep responses focused and under 400 words unless a detailed analysis is requested.`;

export interface GeminiMessage {
  role: "user" | "model";
  content: string;
}

/**
 * Ask Gemini a single question with optional conversation history.
 * Returns the text response.
 */
export async function askGemini(
  question: string,
  history: GeminiMessage[] = [],
): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini API key is not configured");
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  // Convert our message history to Gemini's format
  const geminiHistory = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(question);
  const response = result.response;

  return response.text();
}

/**
 * Stream a Gemini response — useful for long analyses.
 * Yields text chunks as they arrive.
 */
export async function* streamGemini(
  question: string,
  history: GeminiMessage[] = [],
): AsyncGenerator<string> {
  if (!genAI) {
    throw new Error("Gemini API key is not configured");
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const geminiHistory = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessageStream(question);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
