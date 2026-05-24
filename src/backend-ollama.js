async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return data.error || JSON.stringify(data);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export async function doctorOllama(config) {
  try {
    const response = await fetch(`${config.ollama.baseUrl}/api/tags`);
    if (!response.ok) {
      return {
        ok: false,
        details: {
          message: await parseErrorResponse(response)
        }
      };
    }

    const data = await response.json();
    const models = (data.models || []).map((model) => model.name);

    return {
      ok: true,
      details: {
        model: config.ollama.model,
        models
      }
    };
  } catch (error) {
    return {
      ok: false,
      details: {
        message: error.message
      }
    };
  }
}

export async function getOllamaStatus(config) {
  const doctor = await doctorOllama(config);
  return {
    backend: "ollama",
    ok: doctor.ok,
    model: config.ollama.model,
    models: doctor.details?.models || [],
    baseUrl: config.ollama.baseUrl
  };
}

export async function listOllamaModels(config) {
  const response = await fetch(`${config.ollama.baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  return (data.models || []).map((model) => model.name);
}

export async function resetOllamaConversation() {
  return { deleted: false };
}

export async function sendOllamaMessage({ config, state, prompt, onChunk }) {
  const messages = [
    {
      role: "system",
      content: config.stylePrompt
    },
    ...state.messages,
    {
      role: "user",
      content: prompt
    }
  ];

  const response = await fetch(`${config.ollama.baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.ollama.model,
      messages,
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const event = JSON.parse(trimmed);
      const chunk = event.message?.content || "";

      if (chunk) {
        fullResponse += chunk;
        onChunk(chunk);
      }
    }
  }

  return {
    response: fullResponse,
    messages: [
      ...state.messages,
      {
        role: "user",
        content: prompt
      },
      {
        role: "assistant",
        content: fullResponse
      }
    ]
  };
}
