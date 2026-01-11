// analyzeResumeWithOpenAI.js
import OpenAI from "openai";

let openaiClient = null;

async function getOpenAIClient() {
  // Lazy-load dotenv only when function runs
  if (!process.env.OPENAI_API_KEY) {
    const dotenv = await import("dotenv");
    dotenv.config();
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  // Create client only once (singleton)
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export async function analyzeResumeWithOpenAI(resumeText) {
  const openai = await getOpenAIClient();

  const systemInstruction = `
You are an expert Technical Recruiter with 20 years of experience in FAANG hiring. 
Your task is to analyze the provided resume text and provide a critical, honest assessment.

CRITICAL INSTRUCTIONS:
1. SCORE: Rate the resume on a scale of 0 to 10. 
   - 10: Perfect formatting, clear impact-driven metrics, and high-demand skills.
   - 5: Average, needs better bullet points or clearer role definitions.
   - 1: Poorly formatted or lacks technical depth.
2. STRENGTHS: Provide 3-5 specific points where the candidate excels.
3. IMPROVEMENTS: Provide 3-5 actionable steps the candidate should take to increase their score.
4. OUTPUT: You must return ONLY a JSON object. Do not include markdown formatting or prose outside the JSON.

JSON Schema:
{
  "score": number,
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"]
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Standard model name
    messages: [
      { role: "system", content: systemInstruction.trim() },
      { role: "user", content: `Resume text: ${resumeText}` },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  // FIX: Ensure these are arrays before returning them to the controller
  return {
    score: Number(parsed.score) || 0,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [String(parsed.strengths)],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [String(parsed.improvements)]
  };
}