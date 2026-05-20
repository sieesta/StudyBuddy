// @deno-types="https://deno.land/std@0.224.0/http/server.ts"
// @ts-ignore - Deno module resolution
// supabase/functions/ai-chat/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - Deno module resolution
import { corsHeaders } from "../_shared/cors.ts";

// Get the Gemini API key from the environment variables
// @ts-ignore - Deno global
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the user's prompt from the request body
    const { prompt } = await req.json();

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY in function environment. Set GEMINI_API_KEY as an env var.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required in the request body.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Gemini expects parts[].data to contain the payload (oneof). Wrap text under data.text
    const requestBody = {
      contents: [
        {
          parts: [
            {
              data: { text: prompt },
            },
          ],
        },
      ],
    };

    // Forward the request to the Gemini API
    const response = await fetch(API_URL_BASE + `?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API call failed with status: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    
    // Check for a valid response from Gemini
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
        // This can happen if the prompt is blocked for safety reasons
        throw new Error("Invalid response structure from Gemini API. The prompt may have been blocked.");
    }
      
    const aiResponse = data.candidates[0].content.parts[0].text;

    // Send the AI's response back to the client
    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Handle any errors
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
