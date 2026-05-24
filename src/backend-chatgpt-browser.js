async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return normalizeGatewayMessage(
      data?.error?.message || data?.detail || JSON.stringify(data)
    );
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function normalizeGatewayMessage(message) {
  if (!message) {
    return "Unknown ChatGPT gateway error.";
  }

  if (/fetch failed/i.test(message)) {
    return "The local ChatGPT gateway is not reachable. Start it with `/chatgpt start`, and re-run `/chatgpt login` if your browser session expired.";
  }

  if (/Target page, context or browser has been closed/i.test(message)) {
    return "The ChatGPT browser session closed mid-request. Restart it with `/chatgpt start`, then try again.";
  }

  return message;
}

function normalizeGatewayError(error) {
  return new Error(normalizeGatewayMessage(error?.message || String(error)));
}

function buildGatewayRoot(baseUrl) {
  const url = new URL(baseUrl);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function buildGatewayUrl(config, pathname) {
  return `${buildGatewayRoot(config.chatgptBrowser.baseUrl)}${pathname}`;
}

function trimHistory(messages, limit = 10) {
  return messages.slice(-limit);
}

function buildHeaders(config) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.chatgptBrowser.apiToken}`
  };
}

export async function doctorChatgptBrowser(config) {
  try {
    const response = await fetch(buildGatewayUrl(config, "/status"), {
      headers: buildHeaders(config)
    });

    if (!response.ok) {
      return {
        ok: false,
        details: {
          message: await parseErrorResponse(response)
        }
      };
    }

    const data = await response.json();
    return {
      ok: true,
      details: {
        currentThread: data.current_thread || "",
        loggedIn: Boolean(data.logged_in)
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

export async function getChatgptBrowserStatus(config) {
  const doctor = await doctorChatgptBrowser(config);
  return {
    backend: "chatgpt-browser",
    ok: doctor.ok,
    baseUrl: config.chatgptBrowser.baseUrl,
    model: config.chatgptBrowser.model,
    models: [config.chatgptBrowser.model],
    currentThread: doctor.details?.currentThread || "",
    loggedIn: Boolean(doctor.details?.loggedIn)
  };
}

export async function listChatgptBrowserModels(config) {
  let response;
  try {
    response = await fetch(`${config.chatgptBrowser.baseUrl}/models`, {
      headers: buildHeaders(config)
    });
  } catch (error) {
    throw normalizeGatewayError(error);
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  return (data.data || []).map((model) => model.id);
}

export async function resetChatgptBrowserConversation() {
  return { deleted: false };
}

export async function sendChatgptBrowserMessage({ config, state, prompt, onChunk }) {
  const isNewThread = !state.conversationId;
  const endpoint = isNewThread
    ? buildGatewayUrl(config, "/thread/new")
    : buildGatewayUrl(
        config,
        `/thread/${encodeURIComponent(state.conversationId)}/chat`
      );
  const message = isNewThread
    ? `${config.stylePrompt}\n\n${prompt}`
    : prompt;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        message
      })
    });
  } catch (error) {
    throw normalizeGatewayError(error);
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  const content = data?.message;
  const conversationId = data?.thread_id || state.conversationId || "";

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The ChatGPT browser gateway returned an empty response.");
  }

  onChunk(content);

  return {
    conversationId,
    response: content,
    messages: trimHistory([
      ...state.messages,
      {
        role: "user",
        content: prompt
      },
      {
        role: "assistant",
        content
      }
    ])
  };
}

export async function listChatgptBrowserThreads(config) {
  let response;
  try {
    response = await fetch(buildGatewayUrl(config, "/threads"), {
      headers: buildHeaders(config)
    });
  } catch (error) {
    throw normalizeGatewayError(error);
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  return data.threads || [];
}

export async function speakChatgptBrowserResponse(config) {
  let response;
  try {
    response = await fetch(buildGatewayUrl(config, "/thread/read-aloud"), {
      method: "POST",
      headers: buildHeaders(config)
    });
  } catch (error) {
    throw normalizeGatewayError(error);
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response.json();
}

export async function stopChatgptBrowserSpeaking(config) {
  try {
    await fetch(buildGatewayUrl(config, "/thread/stop-speaking"), {
      method: "POST",
      headers: buildHeaders(config)
    });
  } catch {
    // Ignore offline/connection errors on stop
  }
}
