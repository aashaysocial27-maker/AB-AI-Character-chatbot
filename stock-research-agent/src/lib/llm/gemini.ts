import "server-only";
import { GoogleGenAI, type Content } from "@google/genai";
import type { CreateSession } from "./types";

/**
 * Gemini function calling. The model's own reply `content` is pushed back
 * unchanged, so its thought signatures travel with the next request.
 */
export const geminiSession: CreateSession = ({ apiKey, model, system, tools, turns }) => {
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.text }],
  }));
  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.parameters,
  }));

  return {
    async next(signal) {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: system, tools: [{ functionDeclarations }], abortSignal: signal },
      });
      const content = res.candidates?.[0]?.content;
      if (content) contents.push(content);

      const calls = (res.functionCalls ?? []).map((c, i) => ({
        id: c.id ?? `call_${contents.length}_${i}`,
        name: c.name ?? "",
        args: c.args ?? {},
      }));
      const finish = res.candidates?.[0]?.finishReason;
      const stopNote =
        !calls.length && !res.text && finish && finish !== "STOP"
          ? `Gemini stopped without an answer (${finish}).`
          : undefined;
      return { calls, text: res.text ?? "", stopNote };
    },

    addResults(results) {
      contents.push({
        role: "user",
        parts: results.map(({ call, result }) => ({
          functionResponse: { id: call.id, name: call.name, response: { ...result } },
        })),
      });
    },
  };
};
