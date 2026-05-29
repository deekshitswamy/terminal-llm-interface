import { mcpClientInstance } from "./mcp-client.js";

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
  const mcpTools = mcpClientInstance.getTools();
  const ollamaTools = mcpTools.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));

  const currentMessages = [
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

  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    loopCount++;
    const hasTools = ollamaTools.length > 0;

    const response = await fetch(`${config.ollama.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.ollama.model,
        messages: currentMessages,
        tools: hasTools ? ollamaTools : undefined,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    const data = await response.json();
    const assistantMessage = data.message;

    // Check if Ollama requested any tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Append assistant's tool call request to conversation history
      currentMessages.push(assistantMessage);

      // Execute each tool call synchronously
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;

        onChunk(`\n⚙️  [MCP Tool] ${toolName}...`);

        try {
          const toolResult = await mcpClientInstance.callTool(toolName, toolArgs);
          const resultText = toolResult.content.map(c => c.text).join("\n");

          currentMessages.push({
            role: "tool",
            content: resultText,
            name: toolName
          });
          onChunk(" Success!\n");
        } catch (err) {
          const errorMsg = `Error: ${err.message}`;
          currentMessages.push({
            role: "tool",
            content: errorMsg,
            name: toolName
          });
          onChunk(` Failed: ${err.message}\n`);
        }
      }

      // Loop again to feed results back to the LLM
      continue;
    }

    // No tool calls: we have the final assistant text response
    const finalText = assistantMessage.content || "";

    // Typewriter effect simulation to align with terminal chat UI chunk drawing
    const chunkSize = 4;
    for (let i = 0; i < finalText.length; i += chunkSize) {
      onChunk(finalText.slice(i, i + chunkSize));
      await new Promise(r => setTimeout(r, 3));
    }

    return {
      response: finalText,
      messages: [
        ...state.messages,
        {
          role: "user",
          content: prompt
        },
        {
          role: "assistant",
          content: finalText
        }
      ]
    };
  }

  throw new Error("Exceeded maximum tool-calling recursion loops.");
}
