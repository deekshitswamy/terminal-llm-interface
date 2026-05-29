import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class SmartHomeMcpClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.tools = [];
  }

  async connect() {
    this.transport = new StdioClientTransport({
      command: "/Users/deekshitswamy/Documents/learning/python/smart-home-ai/venv/bin/python",
      args: ["/Users/deekshitswamy/Documents/learning/python/smart-home-ai/mcp_server.py"]
    });

    this.client = new Client(
      {
        name: "nightwire-terminal-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    try {
      await this.client.connect(this.transport);
      // Fetch available tools from the server
      const toolsResult = await this.client.listTools();
      this.tools = toolsResult.tools || [];
    } catch (error) {
      this.client = null;
      this.tools = [];
    }
  }

  getTools() {
    return this.tools;
  }

  async callTool(name, argumentsObj) {
    if (!this.client) {
      throw new Error("MCP Client is not connected.");
    }
    try {
      const result = await this.client.callTool({
        name,
        arguments: argumentsObj
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  async close() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {}
      this.client = null;
    }
  }
}
export const mcpClientInstance = new SmartHomeMcpClient();
