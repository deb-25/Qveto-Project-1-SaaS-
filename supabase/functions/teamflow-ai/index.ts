import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS Headers ──────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Verified high-performance & free models on OpenRouter
const MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-pro-exp-02-05:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "deepseek/deepseek-r1:free",
  "google/gemma-2-9b-it:free",
  "openrouter/free",
];

const DEFAULT_SYSTEM_PROMPT = `You are TeamFlow AI, an intelligent agile project management copilot and agile coach.
Your mission is to help engineering, design, and product teams execute sprints with maximum velocity and clarity.

Specialized capabilities:
1. Task Breakdown: Deconstruct complex features into actionable, independent subtasks with suggested priority levels.
2. Acceptance Criteria Generation: Formulate crisp Gherkin (Given/When/Then) or checklist acceptance criteria for stories.
3. Sprint Summaries & Retrospectives: Summarize team performance, overdue blockers, and progress trends into executive briefs.
4. Risk Assessment: Evaluate deadlines and task complexity to suggest appropriate priority (Urgent, High, Medium, Low).

Rules:
- Be concise, structured, and action-oriented.
- When JSON format is requested, output strictly valid JSON without surrounding commentary.
- Use clear markdown with bold headers and bullet points.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey =
      Deno.env.get("OPENROUTER_API_KEY") ||
      Deno.env.get("AI_API_KEY") ||
      Deno.env.get("OPENAI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY");

    // Parse request payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      action, // 'breakdown' | 'enhance' | 'sprint_summary' | 'suggest_priority' | 'chat'
      messages,
      prompt,
      taskTitle,
      taskDescription,
      projectContext,
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
      temperature = 0.5,
      max_tokens = 1600,
      json = false,
      model: requestedModel,
    } = body;

    // Construct tailored prompts based on action
    let userPrompt = prompt || "";
    let isJsonOutput = json;

    if (action === "breakdown") {
      isJsonOutput = true;
      userPrompt = `Break down the following task into 3 to 5 clear, concrete subtasks:
Task Title: "${taskTitle}"
${taskDescription ? `Context / Details: ${taskDescription}` : ""}
${projectContext ? `Project: ${projectContext}` : ""}

Return strictly a JSON array of objects with the format:
[
  {
    "title": "Subtask title",
    "description": "Brief 1-sentence implementation detail",
    "priority": "low" | "medium" | "high" | "urgent"
  }
]`;
    } else if (action === "enhance") {
      userPrompt = `Write a comprehensive, professional agile task description for:
Title: "${taskTitle}"
${taskDescription ? `Initial Notes: ${taskDescription}` : ""}
${projectContext ? `Project: ${projectContext}` : ""}

Include:
- **Overview & Goal**
- **User Story** (As a... I want to... So that...)
- **Acceptance Criteria** (Checklist format)
- **Technical Considerations / Edge Cases**`;
    } else if (action === "suggest_priority") {
      isJsonOutput = true;
      userPrompt = `Analyze this task and recommend its optimal priority level (urgent, high, medium, low):
Title: "${taskTitle}"
${taskDescription ? `Description: ${taskDescription}` : ""}
${body.dueDate ? `Due Date: ${body.dueDate}` : ""}

Return strictly a JSON object:
{
  "priority": "urgent" | "high" | "medium" | "low",
  "reason": "Clear 1-2 sentence justification based on impact and deadlines"
}`;
    }

    const formattedMessages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      formattedMessages.push({ role: "system", content: systemPrompt });
    }

    if (Array.isArray(messages) && messages.length > 0) {
      formattedMessages.push(...messages);
    } else if (userPrompt) {
      formattedMessages.push({ role: "user", content: userPrompt });
    } else {
      return new Response(
        JSON.stringify({ error: "Please provide either 'prompt', 'messages', or an 'action' with 'taskTitle'." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fallback if API key is not yet set in Supabase secrets
    if (!apiKey) {
      if (action === "breakdown") {
        return new Response(
          JSON.stringify({
            success: true,
            fallback: true,
            subtasks: [
              { title: `Define specifications for ${taskTitle || "feature"}`, priority: "high", description: "Document technical acceptance criteria and component interfaces." },
              { title: `Implement core logic and state flow`, priority: "high", description: "Build service hooks, database models, and mutations." },
              { title: `Design interactive UI and responsive layouts`, priority: "medium", description: "Style UI components with dark glassmorphic theme and micro-animations." },
              { title: `Write test cases and verify edge cases`, priority: "medium", description: "Validate error boundaries, permissions, and zero-state handling." }
            ],
            note: "Generated using built-in agile fallback. Add OPENROUTER_API_KEY in Supabase secrets for dynamic generative AI."
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          fallback: true,
          error: "AI service key not configured in secrets. Please add OPENROUTER_API_KEY or AI_API_KEY in your Supabase project dashboard secrets.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const modelsToTry = requestedModel ? [requestedModel, ...MODELS] : MODELS;
    let lastError = null;

    // Iterate through models with fallback
    for (const model of modelsToTry) {
      try {
        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://teamflow.local",
            "X-Title": "TeamFlow Agile Assistant",
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
            temperature,
            max_tokens,
            response_format: isJsonOutput ? { type: "json_object" } : undefined,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Model ${model} returned ${response.status}: ${errText}`);
          lastError = `Model ${model} failed: ${errText}`;
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";

        // Parse JSON if requested
        if (isJsonOutput) {
          try {
            // Remove markdown code fences if present
            const cleanContent = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
            const parsed = JSON.parse(cleanContent);
            return new Response(
              JSON.stringify({ success: true, model, data: parsed }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } catch {
            // Return raw content with success flag
            return new Response(
              JSON.stringify({ success: true, model, content }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, model, content }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Exception with model ${model}:`, err);
      }
    }

    // If all models failed
    return new Response(
      JSON.stringify({ success: false, error: "All AI model attempts failed.", details: lastError }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
