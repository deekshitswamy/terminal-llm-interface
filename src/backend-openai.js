// Utilizes Node's native fetch (available in Node >=18)

export async function doctorOpenai(config) {
  if (!config.openai.apiKey) {
    return { ok: false, details: { message: "OpenAI API key is missing. Set it in config." } };
  }
  try {
    const response = await fetch(`${config.openai.baseUrl}/models`, {
      headers: {
        "Authorization": `Bearer ${config.openai.apiKey}`
      }
    });
    if (!response.ok) {
      return { ok: false, details: { message: `OpenAI returned status ${response.status}` } };
    }
    return { ok: true, details: { message: "Connection to OpenAI is successful." } };
  } catch (error) {
    return { ok: false, details: { message: error.message } };
  }
}

export async function getOpenaiStatus(config) {
  const doctor = await doctorOpenai(config);
  return {
    backend: "openai",
    ok: doctor.ok,
    model: config.openai.model,
    baseUrl: config.openai.baseUrl
  };
}

export async function listOpenaiModels() {
  return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];
}

export async function resetOpenaiConversation() {
  return { deleted: false };
}

export async function sendOpenaiMessage({ config, state, prompt, onChunk }) {
  const apiKey = config.openai.apiKey;
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Run /terminal config or edit your config.json.");
  }

  const currentMessages = [
    { role: "system", content: config.stylePrompt },
    ...state.messages.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: prompt }
  ];

  const response = await globalThis.fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: currentMessages,
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned) continue;
      if (cleaned === "data: [DONE]") continue;

      if (cleaned.startsWith("data: ")) {
        try {
          const json = JSON.parse(cleaned.slice(6));
          const content = json.choices?.[0]?.delta?.content || "";
          if (content) {
            finalText += content;
            onChunk(content);
          }
        } catch {
          // Ignore chunk parsing anomalies
        }
      }
    }
  }

  return {
    response: finalText,
    messages: [
      ...state.messages,
      { role: "user", content: prompt },
      { role: "assistant", content: finalText }
    ]
  };
}
