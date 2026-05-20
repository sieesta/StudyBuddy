// @deno-types="https://deno.land/std@0.224.0/http/server.ts"
// @ts-ignore - Deno module resolution
// supabase/functions/ai-chat/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - Deno module resolution
import { corsHeaders } from "../_shared/cors.ts";

// Get the Gemini API key from the environment variables
// @ts-ignore - Deno global
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the user's prompt from the request body
    const { prompt } = await req.json();

    // Forward the request to the Gemini API
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
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
