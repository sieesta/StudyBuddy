// @deno-types="https://deno.land/std@0.224.0/http/server.ts"
// @ts-ignore - Deno module resolution
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - Deno module resolution
import { corsHeaders } from "../_shared/cors.ts";

// @ts-ignore - Deno global
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const FUNCTION_VERSION = "ai-chat-v4";
const GEMINI_MODEL = "gemini-2.0-flash-lite";

function buildGeminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

type ChatMessage = {
  role?: string;
  text?: string;
};

function buildPromptText(history: ChatMessage[], prompt: string) {
  const historyText = history
    .filter((message) => typeof message?.text === "string" && message.text.trim())
    .slice(-6)
    .map((message) => `${message.role === "assistant" || message.role === "model" ? "Assistant" : "User"}: ${message.text!.trim()}`)
    .join("\n");

  if (!historyText) {
    return prompt.trim();
  }

  return [
    "Conversation so far:",
    historyText,
    "Current user prompt:",
    prompt.trim(),
  ].join("\n");
}

async function callGemini(promptText: string) {
  const response = await fetch(buildGeminiUrl(GEMINI_MODEL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    }),
  });

  const responseText = await response.text();
  return { response, responseText };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY in function environment." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required in the request body." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const promptText = buildPromptText(history, prompt);
    const firstAttempt = await callGemini(promptText);
    let { response, responseText } = firstAttempt;

    if (!response.ok && response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const retryAttempt = await callGemini(promptText);
      response = retryAttempt.response;
      responseText = retryAttempt.responseText;
    }

    if (!response.ok) {
      let retryAfter = response.headers.get("retry-after");
      let errorMessage = `Gemini request failed with status ${response.status}.`;
      if (response.status === 429) {
        errorMessage = "Gemini rate limit reached. Please wait a moment and try again.";
      }

      return new Response(JSON.stringify({
        error: errorMessage,
        model: GEMINI_MODEL,
        version: FUNCTION_VERSION,
        retryAfter,
        details: responseText,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const data = JSON.parse(responseText);
    const reply = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim();

    if (!reply) {
      return new Response(JSON.stringify({ error: "Gemini returned no text response.", model: GEMINI_MODEL, version: FUNCTION_VERSION, details: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ response: reply, model: GEMINI_MODEL, version: FUNCTION_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message, version: FUNCTION_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});