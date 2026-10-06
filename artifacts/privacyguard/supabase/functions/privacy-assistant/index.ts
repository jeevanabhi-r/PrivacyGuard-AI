const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 16_384;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 8_000;
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are PrivacyGuard AI, a cybersecurity and digital privacy education assistant.

Your purpose is to teach users how to improve their digital privacy safely.

You may explain:
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

IMPORTANT SAFETY RULES:

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

Never claim that you can directly modify the user's Google, Instagram, Facebook, WhatsApp, Microsoft, Apple, or other third-party account settings.

Instead, explain the safe steps the user can perform themselves.

Keep explanations understandable for normal users.

When appropriate:
1. Explain the privacy risk
2. Explain why it matters
3. Give step-by-step actions
4. Give a practical recommendation
5. Use brief headings such as Short explanation, Risk, Recommended actions, or Safety note when they make the answer clearer.
Keep responses concise and avoid unnecessary jargon.

If the question is unrelated to privacy or cybersecurity education, politely redirect the user toward the purpose of PrivacyGuard AI.`;

type ChatRole = "user" | "assistant";
type Message = { role: ChatRole; content: string };

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asUserMessages(rows: unknown[], currentMessageId: string): Message[] {
  const chronological = rows
    .filter((row): row is { id: string; role: ChatRole; content: string } =>
      typeof row === "object"
      && row !== null
      && "id" in row
      && "role" in row
      && "content" in row
      && ((row as { role: unknown }).role === "user" || (row as { role: unknown }).role === "assistant")
      && typeof (row as { id: unknown }).id === "string"
      && typeof (row as { content: unknown }).content === "string")
    .slice(0, MAX_HISTORY_MESSAGES + 1);

  let remaining = MAX_HISTORY_CHARS;
  const bounded: Message[] = [];
  for (let index = 0; index < chronological.length; index += 1) {
    const row = chronological[index];
    if (row.id === currentMessageId) continue;
    if (remaining <= 0) break;
    const content = row.content.slice(0, remaining);
    if (content) bounded.push({ role: row.role, content });
    remaining -= content.length;
  }
  return bounded.reverse();
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
  }

  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "request_too_large" });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "request_too_large" });
    }
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  if (typeof body !== "object" || body === null || !("message" in body)) {
    return jsonResponse(400, { error: "invalid_request" });
  }
  const submittedMessage = (body as { message: unknown }).message;
  const conversationId = (body as { conversationId?: unknown }).conversationId;
  const requestedMessageId = (body as { messageId?: unknown }).messageId;
  if (typeof submittedMessage !== "string") {
    return jsonResponse(400, { error: "invalid_message" });
  }
  const message = submittedMessage.trim();
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return jsonResponse(400, {
      error: "invalid_message",
      message: `Message must contain between 1 and ${MAX_MESSAGE_CHARS} characters.`,
    });
  }
  if (conversationId !== undefined && !isUuid(conversationId)) {
    return jsonResponse(400, { error: "invalid_conversation" });
  }
  if (requestedMessageId !== undefined && !isUuid(requestedMessageId)) {
    return jsonResponse(400, { error: "invalid_message_id" });
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  const userHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  };
  const timeoutSignal = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let userId: string;
  try {
    const authResponse = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${bearer}` },
      signal: timeoutSignal(),
    });
    if (!authResponse.ok) {
      return jsonResponse(401, { error: "unauthorized" });
    }
    const user = await authResponse.json();
    if (typeof user?.id !== "string" || !isUuid(user.id)) {
      return jsonResponse(401, { error: "unauthorized" });
    }
    userId = user.id;
  } catch {
    return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
  }
  const adminHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const minuteStart = new Date();
  minuteStart.setUTCSeconds(0, 0);
  try {
    const limitResponse = await fetch(`${baseUrl}/rest/v1/rpc/consume_privacy_assistant_rate_limit`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ p_window_start: minuteStart.toISOString() }),
      signal: timeoutSignal(),
    });
    if (!limitResponse.ok) {
      return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
    }
    if (await limitResponse.json() !== true) {
      return jsonResponse(429, {
        error: "rate_limited",
        message: "PrivacyGuard AI is temporarily busy. Please try again in a moment.",
      });
    }
  } catch {
    return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
  }

  let activeConversationId = conversationId as string | undefined;
  try {
    if (activeConversationId) {
      const checkUrl = new URL(`${baseUrl}/rest/v1/conversations`);
      checkUrl.searchParams.set("select", "id");
      checkUrl.searchParams.set("id", `eq.${activeConversationId}`);
      checkUrl.searchParams.set("user_id", `eq.${userId}`);
      checkUrl.searchParams.set("limit", "1");
      const check = await fetch(checkUrl, { headers: adminHeaders, signal: timeoutSignal() });
      const owned = check.ok ? await check.json() : [];
      if (!Array.isArray(owned) || owned.length === 0) {
        return jsonResponse(404, { error: "conversation_not_found" });
      }
    } else {
      const title = message.replace(/\s+/g, " ").slice(0, 72) || "New conversation";
      const create = await fetch(`${baseUrl}/rest/v1/conversations`, {
        method: "POST",
        headers: { ...adminHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ user_id: userId, title }),
        signal: timeoutSignal(),
      });
      if (!create.ok) {
        return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
      }
      const created = await create.json();
      activeConversationId = Array.isArray(created) && typeof created[0]?.id === "string"
        ? created[0].id
        : undefined;
      if (!activeConversationId) {
        return jsonResponse(503, { error: "assistant_unavailable", message: "AI Assistant is currently unavailable." });
      }
    }

    const userMessageId = typeof requestedMessageId === "string" ? requestedMessageId : crypto.randomUUID();
    const existingMessageUrl = new URL(`${baseUrl}/rest/v1/messages`);
    existingMessageUrl.searchParams.set("select", "id,conversation_id,user_id,role,content");
    existingMessageUrl.searchParams.set("id", `eq.${userMessageId}`);
    existingMessageUrl.searchParams.set("user_id", `eq.${userId}`);
    existingMessageUrl.searchParams.set("limit", "1");
    const existingMessageResponse = await fetch(existingMessageUrl, {
      headers: adminHeaders,
      signal: timeoutSignal(),
    });
    if (!existingMessageResponse.ok) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }
    const existingMessages = await existingMessageResponse.json();
    const existingMessage = Array.isArray(existingMessages) ? existingMessages[0] : undefined;
    if (existingMessage) {
      if (
        existingMessage.role !== "user"
        || existingMessage.content !== message
      ) {
        return jsonResponse(409, { error: "message_id_conflict" });
      }
      if (existingMessage.conversation_id !== activeConversationId) {
        if (conversationId) return jsonResponse(409, { error: "message_id_conflict" });
        const unusedConversationUrl = new URL(`${baseUrl}/rest/v1/conversations`);
        unusedConversationUrl.searchParams.set("id", `eq.${activeConversationId}`);
        unusedConversationUrl.searchParams.set("user_id", `eq.${userId}`);
        await fetch(unusedConversationUrl, {
          method: "DELETE",
          headers: adminHeaders,
          signal: timeoutSignal(),
        });
        activeConversationId = existingMessage.conversation_id;
      }
    } else {
      const userMessageResponse = await fetch(`${baseUrl}/rest/v1/messages`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          id: userMessageId,
          conversation_id: activeConversationId,
          user_id: userId,
          role: "user",
          content: message,
        }),
        signal: timeoutSignal(),
      });
      if (!userMessageResponse.ok) {
        return jsonResponse(503, {
          error: "assistant_unavailable",
          message: "AI Assistant is currently unavailable.",
          conversationId: activeConversationId,
        });
      }
    }

    const savedAnswerUrl = new URL(`${baseUrl}/rest/v1/messages`);
    savedAnswerUrl.searchParams.set("select", "content");
    savedAnswerUrl.searchParams.set("user_id", `eq.${userId}`);
    savedAnswerUrl.searchParams.set("reply_to", `eq.${userMessageId}`);
    savedAnswerUrl.searchParams.set("role", "eq.assistant");
    savedAnswerUrl.searchParams.set("limit", "1");
    const savedAnswerResponse = await fetch(savedAnswerUrl, {
      headers: adminHeaders,
      signal: timeoutSignal(),
    });
    if (!savedAnswerResponse.ok) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }
    const savedAnswers = await savedAnswerResponse.json();
    if (Array.isArray(savedAnswers) && typeof savedAnswers[0]?.content === "string") {
      return jsonResponse(200, {
        response: savedAnswers[0].content,
        conversationId: activeConversationId,
      });
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
        messageId: userMessageId,
      });
    }

    const historyUrl = new URL(`${baseUrl}/rest/v1/messages`);
    historyUrl.searchParams.set("select", "id,role,content");
    historyUrl.searchParams.set("conversation_id", `eq.${activeConversationId}`);
    historyUrl.searchParams.set("user_id", `eq.${userId}`);
    historyUrl.searchParams.set("order", "created_at.desc,id.desc");
    historyUrl.searchParams.set("limit", String(MAX_HISTORY_MESSAGES + 1));
    const historyResponse = await fetch(historyUrl, {
      headers: adminHeaders,
      signal: timeoutSignal(),
    });
    if (!historyResponse.ok) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }
    const historyRows = await historyResponse.json();
    const history = Array.isArray(historyRows)
      ? asUserMessages(historyRows, userMessageId)
      : [];

    const model = Deno.env.get("GROQ_MODEL")?.trim() || "llama-3.3-70b-versatile";
    let groqResponse: Response;
    try {
      groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            { role: "user", content: message },
          ],
          max_tokens: 900,
          temperature: 0.35,
        }),
        signal: timeoutSignal(),
      });
    } catch {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }

    if (groqResponse.status === 429) {
      return jsonResponse(429, {
        error: "rate_limited",
        message: "PrivacyGuard AI is temporarily busy. Please try again in a moment.",
        conversationId: activeConversationId,
      });
    }
    if (!groqResponse.ok) {
      const status = groqResponse.status === 408 || groqResponse.status === 504 ? 504 : 503;
      return jsonResponse(status, {
        error: status === 504 ? "timeout" : "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }

    const completion = await groqResponse.json();
    const answer = completion?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }

    const assistantMessageResponse = await fetch(`${baseUrl}/rest/v1/messages`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        conversation_id: activeConversationId,
        user_id: userId,
        role: "assistant",
        content: answer,
        reply_to: userMessageId,
      }),
      signal: timeoutSignal(),
    });
    if (!assistantMessageResponse.ok) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }

    const updateConversation = await fetch(`${baseUrl}/rest/v1/conversations?id=eq.${activeConversationId}&user_id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...adminHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
      signal: timeoutSignal(),
    });
    if (!updateConversation.ok) {
      return jsonResponse(503, {
        error: "assistant_unavailable",
        message: "AI Assistant is currently unavailable.",
        conversationId: activeConversationId,
      });
    }

    return jsonResponse(200, {
      response: answer,
      conversationId: activeConversationId,
    });
  } catch {
    return jsonResponse(503, {
      error: "assistant_unavailable",
      message: "AI Assistant is currently unavailable.",
      conversationId: activeConversationId,
    });
  }
});
