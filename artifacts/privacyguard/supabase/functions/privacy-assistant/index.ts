const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 16_384;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 8_000;
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `
You are PrivacyGuard AI, a cybersecurity and digital privacy education assistant.

Your purpose is to teach users how to improve their digital privacy safely.

You can explain:
- privacy settings
- app permissions
- location privacy
- browser privacy
- social media privacy
- tracking
- cookies
- third-party data sharing
- authentication safety
- phishing awareness
- personal data protection

Always provide defensive and educational guidance.

Never ask the user for:
- passwords
- OTPs
- API keys
- authentication cookies
- private keys
- recovery codes
- banking credentials
- session tokens

Never request sensitive credentials.

Never claim that you can directly change a user's Google, Instagram, Facebook, WhatsApp, Microsoft, Apple, or other third-party account settings.

Instead, explain the safe steps the user can perform themselves.

Keep explanations simple and understandable.

When appropriate:
1. Explain the privacy risk.
2. Explain why it matters.
3. Give step-by-step actions.
4. Give a practical recommendation.
5. Add a short safety note when useful.

Keep responses concise and avoid unnecessary jargon.

If the question is unrelated to privacy or cybersecurity, politely redirect the user toward PrivacyGuard AI's purpose.
`;

type ChatRole = "user" | "assistant";

type Message = {
  role: ChatRole;
  content: string;
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function cleanUuid(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return isUuid(trimmed) ? trimmed : undefined;
}

function buildHistory(
  rows: unknown[],
  currentMessageId: string,
): Message[] {
  const validRows = rows.filter(
    (
      row,
    ): row is {
      id: string;
      role: ChatRole;
      content: string;
    } => {
      if (typeof row !== "object" || row === null) {
        return false;
      }

      const item = row as Record<string, unknown>;

      return (
        typeof item.id === "string" &&
        typeof item.content === "string" &&
        (item.role === "user" || item.role === "assistant")
      );
    },
  );

  let remaining = MAX_HISTORY_CHARS;
  const result: Message[] = [];

  for (const row of validRows) {
    if (row.id === currentMessageId) {
      continue;
    }

    if (remaining <= 0) {
      break;
    }

    const content = row.content.slice(0, remaining);

    if (content) {
      result.push({
        role: row.role,
        content,
      });
    }

    remaining -= content.length;
  }

  return result.reverse();
}

async function fetchJson(
  url: string,
  options: RequestInit,
): Promise<Response> {
  return await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

Deno.serve(async (request: Request) => {
  /*
   * CORS
   */
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: "method_not_allowed",
    });
  }

  console.log("[privacy-assistant] Incoming request handling started.");

  /*
   * Stage 1: Supabase runtime variables check.
   */
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[privacy-assistant] Stage 1 - Runtime variables:", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[privacy-assistant] Missing critical Supabase runtime variables");
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "AI Assistant is currently unavailable (backend configuration error).",
    });
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");

  /*
   * Stage 2: Authentication header extraction.
   */
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!bearer) {
    console.warn("[privacy-assistant] Stage 2 - Missing Authorization bearer token");
    return jsonResponse(401, {
      error: "unauthorized",
    });
  }

  /*
   * Stage 3: Request size and body parsing.
   */
  const contentLength = Number(
    request.headers.get("Content-Length") ?? "0",
  );

  if (contentLength > MAX_BODY_BYTES) {
    console.warn("[privacy-assistant] Stage 3 - Request payload exceeds byte limit:", contentLength);
    return jsonResponse(413, {
      error: "request_too_large",
    });
  }

  let body: Record<string, unknown>;

  try {
    const raw = await request.text();

    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(413, {
        error: "request_too_large",
      });
    }

    const parsed = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return jsonResponse(400, {
        error: "invalid_request",
        message: "Request body must be a JSON object.",
      });
    }

    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(400, {
      error: "invalid_json",
      message: "The request body is not valid JSON.",
    });
  }

  const submittedMessage =
    body.message ??
    body.prompt ??
    body.content ??
    body.text;

  if (typeof submittedMessage !== "string") {
    return jsonResponse(400, {
      error: "invalid_message",
      message: "Please send a message in the request.",
    });
  }

  const message = submittedMessage.trim();

  if (!message) {
    return jsonResponse(400, {
      error: "invalid_message",
      message: "Message cannot be empty.",
    });
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    return jsonResponse(400, {
      error: "invalid_message",
      message: `Message must contain no more than ${MAX_MESSAGE_CHARS} characters.`,
    });
  }

  const suppliedConversationId = cleanUuid(body.conversationId);
  const suppliedMessageId = cleanUuid(body.messageId);

  console.log("[privacy-assistant] Stage 3 - Message validated:", {
    length: message.length,
    hasSuppliedConversationId: Boolean(suppliedConversationId),
    hasSuppliedMessageId: Boolean(suppliedMessageId),
  });

  /*
   * Stage 4: Authenticate user against Supabase Auth.
   */
  let userId: string;

  try {
    const authResponse = await fetchJson(
      `${baseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${bearer}`,
        },
      },
    );

    if (!authResponse.ok) {
      console.warn("[privacy-assistant] Stage 4 - Supabase auth check failed with status:", authResponse.status);
      return jsonResponse(401, {
        error: "unauthorized",
      });
    }

    const user = await authResponse.json();

    if (typeof user?.id !== "string" || !isUuid(user.id)) {
      console.warn("[privacy-assistant] Stage 4 - User object missing valid UUID");
      return jsonResponse(401, {
        error: "unauthorized",
      });
    }

    userId = user.id;
    console.log("[privacy-assistant] Stage 4 - User authenticated:", userId);
  } catch (err) {
    console.error("[privacy-assistant] Stage 4 - Auth service unreachable:", err);
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "Authentication service is currently unreachable.",
    });
  }

  /*
   * Admin headers for service-role operations.
   */
  const adminHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  /*
   * Stage 5: Rate limit check via RPC.
   */
  try {
    const minuteStart = new Date();
    minuteStart.setUTCSeconds(0, 0);

    const rateLimitResponse = await fetchJson(
      `${baseUrl}/rest/v1/rpc/consume_privacy_assistant_rate_limit`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_window_start: minuteStart.toISOString(),
        }),
      },
    );

    if (!rateLimitResponse.ok) {
      const errText = await rateLimitResponse.text();
      console.error("[privacy-assistant] Stage 5 - Rate limit RPC error:", rateLimitResponse.status, errText);
      // We log but proceed gracefully if rate-limiting fails due to RPC or transient DB issues
    } else {
      const allowed = await rateLimitResponse.json();
      console.log("[privacy-assistant] Stage 5 - Rate limit result:", { allowed });

      if (allowed === false) {
        return jsonResponse(429, {
          error: "rate_limited",
          message: "PrivacyGuard AI is temporarily busy. Please try again in a moment.",
        });
      }
    }
  } catch (err) {
    console.warn("[privacy-assistant] Stage 5 - Rate limit RPC call exception:", err);
    // Transitory RPC check failure will not block user education
  }

  /*
   * Stage 6: Conversation resolution or creation.
   */
  let conversationId: string;

  async function createConversation(): Promise<string> {
    const title =
      message.replace(/\s+/g, " ").slice(0, 72) || "New conversation";

    const response = await fetchJson(
      `${baseUrl}/rest/v1/conversations`,
      {
        method: "POST",
        headers: {
          ...adminHeaders,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: userId,
          title,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[privacy-assistant] Stage 6 - Conversation creation failed:", response.status, errText);
      throw new Error(`conversation_create_failed (${response.status})`);
    }

    const created = await response.json();
    const id =
      Array.isArray(created) && typeof created[0]?.id === "string"
        ? created[0].id
        : undefined;

    if (!id || !isUuid(id)) {
      throw new Error("conversation_id_missing");
    }

    console.log("[privacy-assistant] Stage 6 - New conversation created:", id);
    return id;
  }

  try {
    if (suppliedConversationId) {
      const checkUrl = new URL(`${baseUrl}/rest/v1/conversations`);
      checkUrl.searchParams.set("select", "id");
      checkUrl.searchParams.set("id", `eq.${suppliedConversationId}`);
      checkUrl.searchParams.set("user_id", `eq.${userId}`);
      checkUrl.searchParams.set("limit", "1");

      const checkResponse = await fetchJson(checkUrl.toString(), {
        headers: adminHeaders,
      });

      if (checkResponse.ok) {
        const existing = await checkResponse.json();
        if (Array.isArray(existing) && existing.length > 0) {
          conversationId = suppliedConversationId;
          console.log("[privacy-assistant] Stage 6 - Using existing conversation:", conversationId);
        } else {
          conversationId = await createConversation();
        }
      } else {
        conversationId = await createConversation();
      }
    } else {
      conversationId = await createConversation();
    }
  } catch (err) {
    console.error("[privacy-assistant] Stage 6 - Conversation handling error:", err);
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "Unable to initialize conversation.",
    });
  }

  /*
   * Stage 7: User message creation / lookup.
   */
  const userMessageId = suppliedMessageId ?? crypto.randomUUID();
  let finalMessageId = userMessageId;

  try {
    const existingMessageUrl = new URL(`${baseUrl}/rest/v1/messages`);
    existingMessageUrl.searchParams.set(
      "select",
      "id,conversation_id,user_id,role,content",
    );
    existingMessageUrl.searchParams.set("id", `eq.${userMessageId}`);
    existingMessageUrl.searchParams.set("user_id", `eq.${userId}`);
    existingMessageUrl.searchParams.set("limit", "1");

    const existingResponse = await fetchJson(existingMessageUrl.toString(), {
      headers: adminHeaders,
    });

    let existing: { role?: string; content?: string; conversation_id?: string } | undefined;

    if (existingResponse.ok) {
      const existingMessages = await existingResponse.json();
      existing = Array.isArray(existingMessages) ? existingMessages[0] : undefined;
    }

    if (existing) {
      if (
        existing.role !== "user" ||
        existing.content !== message ||
        existing.conversation_id !== conversationId
      ) {
        finalMessageId = crypto.randomUUID();
      }
    }

    // Save message if not already present
    if (!existing || finalMessageId !== userMessageId) {
      const saveUserMessage = await fetchJson(`${baseUrl}/rest/v1/messages`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          id: finalMessageId,
          conversation_id: conversationId,
          user_id: userId,
          role: "user",
          content: message,
        }),
      });

      if (!saveUserMessage.ok) {
        const errText = await saveUserMessage.text();
        console.warn("[privacy-assistant] Stage 7 - User message insert conflict or error:", saveUserMessage.status, errText);
        // Retry with a fresh UUID in case of conflict
        finalMessageId = crypto.randomUUID();
        const retry = await fetchJson(`${baseUrl}/rest/v1/messages`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            id: finalMessageId,
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            content: message,
          }),
        });

        if (!retry.ok) {
          const retryErr = await retry.text();
          console.error("[privacy-assistant] Stage 7 - Retry message insert failed:", retry.status, retryErr);
          return jsonResponse(503, {
            error: "assistant_unavailable",
            message: "Unable to save message in conversation.",
            conversationId,
          });
        }
      }
    }

    console.log("[privacy-assistant] Stage 7 - User message persisted:", finalMessageId);

    /*
     * Stage 8: Check if assistant response already exists (idempotency).
     */
    const answerUrl = new URL(`${baseUrl}/rest/v1/messages`);
    answerUrl.searchParams.set("select", "content");
    answerUrl.searchParams.set("user_id", `eq.${userId}`);
    answerUrl.searchParams.set("reply_to", `eq.${finalMessageId}`);
    answerUrl.searchParams.set("role", "eq.assistant");
    answerUrl.searchParams.set("limit", "1");

    const savedAnswerResponse = await fetchJson(answerUrl.toString(), {
      headers: adminHeaders,
    });

    if (savedAnswerResponse.ok) {
      const saved = await savedAnswerResponse.json();
      if (Array.isArray(saved) && typeof saved[0]?.content === "string") {
        console.log("[privacy-assistant] Stage 8 - Existing response found, returning cached answer.");
        return jsonResponse(200, {
          response: saved[0].content,
          conversationId,
          messageId: finalMessageId,
        });
      }
    }
  } catch (err) {
    console.error("[privacy-assistant] Stage 7/8 - Message persistence error:", err);
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "Database operation error during message persistence.",
      conversationId,
    });
  }

  /*
   * Stage 9: Groq API Key validation.
   */
  const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim();

  console.log("[privacy-assistant] Stage 9 - Groq secret check:", {
    hasGroqKey: Boolean(groqApiKey),
    keyLength: groqApiKey ? groqApiKey.length : 0,
  });

  if (!groqApiKey) {
    console.error("[privacy-assistant] Stage 9 - GROQ_API_KEY secret is not present in Edge Function secrets!");
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "AI Assistant is currently unavailable (Groq secret not configured in Supabase).",
      conversationId,
      messageId: finalMessageId,
    });
  }

  /*
   * Stage 10: Load conversation history for LLM context.
   */
  let history: Message[] = [];

  try {
    const historyUrl = new URL(`${baseUrl}/rest/v1/messages`);
    historyUrl.searchParams.set("select", "id,role,content");
    historyUrl.searchParams.set("conversation_id", `eq.${conversationId}`);
    historyUrl.searchParams.set("user_id", `eq.${userId}`);
    historyUrl.searchParams.set("order", "created_at.desc,id.desc");
    historyUrl.searchParams.set("limit", String(MAX_HISTORY_MESSAGES + 1));

    const historyResponse = await fetchJson(historyUrl.toString(), {
      headers: adminHeaders,
    });

    if (historyResponse.ok) {
      const historyRows = await historyResponse.json();
      if (Array.isArray(historyRows)) {
        history = buildHistory(historyRows, finalMessageId);
      }
    } else {
      console.warn("[privacy-assistant] Stage 10 - History load non-ok:", historyResponse.status);
    }
  } catch (err) {
    console.warn("[privacy-assistant] Stage 10 - History load failed, proceeding without history:", err);
  }

  console.log("[privacy-assistant] Stage 10 - Context history prepared, messages count:", history.length);

  /*
   * Stage 11: Call Groq API.
   */
  const model = Deno.env.get("GROQ_MODEL")?.trim() || "openai/gpt-oss-120b";
  console.log("[privacy-assistant] Stage 11 - Calling Groq API with model:", model);

  let groqResponse: Response;

  try {
    groqResponse = await fetchJson(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT.trim(),
            },
            ...history,
            {
              role: "user",
              content: message,
            },
          ],
          max_tokens: 900,
          temperature: 0.35,
        }),
      },
    );
  } catch (err) {
    console.error("[privacy-assistant] Stage 11 - Network error calling Groq:", err);
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "AI Assistant is currently unavailable (Groq network timeout).",
      conversationId,
      messageId: finalMessageId,
    });
  }

  console.log("[privacy-assistant] Stage 11 - Groq API response status:", groqResponse.status, "ok:", groqResponse.ok);

  if (!groqResponse.ok) {
    const groqErrText = await groqResponse.text();
    console.error("[privacy-assistant] Stage 11 - Groq API returned error status:", groqResponse.status, groqErrText);

    let groqErrMsg = "Groq request failed";
    try {
      const parsed = JSON.parse(groqErrText);
      if (parsed?.error?.message) groqErrMsg = parsed.error.message;
    } catch {}

    if (groqResponse.status === 429) {
      return jsonResponse(429, {
        error: "rate_limited",
        message: "PrivacyGuard AI is temporarily busy. Please try again in a moment.",
        conversationId,
        messageId: finalMessageId,
      });
    }

    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "AI is temporarily unavailable. Please try again in a moment, or explore our privacy guides.",
      conversationId,
      messageId: finalMessageId,
    });
  }

  let answer: string | undefined;

  try {
    const completion = await groqResponse.json();
    answer = completion?.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("[privacy-assistant] Stage 11 - Failed to parse Groq completion JSON:", err);
  }

  if (typeof answer !== "string" || !answer.trim()) {
    console.error("[privacy-assistant] Stage 11 - Groq returned empty completion content");
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "AI Assistant returned an empty response.",
      conversationId,
      messageId: finalMessageId,
    });
  }

  /*
   * Stage 12: Save assistant response to database.
   */
  try {
    const saveAssistant = await fetchJson(`${baseUrl}/rest/v1/messages`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: answer,
        reply_to: finalMessageId,
      }),
    });

    if (!saveAssistant.ok) {
      const saveErr = await saveAssistant.text();
      console.error("[privacy-assistant] Stage 12 - Save assistant message failed:", saveAssistant.status, saveErr);
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "Unable to save assistant response.",
        conversationId,
        messageId: finalMessageId,
      });
    }

    console.log("[privacy-assistant] Stage 12 - Assistant message successfully persisted.");

    // Update conversation timestamp (best-effort)
    await fetchJson(
      `${baseUrl}/rest/v1/conversations?id=eq.${conversationId}&user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          ...adminHeaders,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          updated_at: new Date().toISOString(),
        }),
      },
    );
  } catch (err) {
    console.error("[privacy-assistant] Stage 12 - Error saving assistant message:", err);
  }

  /*
   * Stage 13: Success response.
   */
  console.log("[privacy-assistant] Stage 13 - Request completed successfully.");
  return jsonResponse(200, {
    response: answer,
    conversationId,
    messageId: finalMessageId,
  });
});