#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.SHIPITSQUIRREL_URL || "https://shipitsquirrel.com";
const API_TOKEN = process.env.SHIPITSQUIRREL_API_TOKEN;

if (!API_TOKEN) {
  console.error("Error: SHIPITSQUIRREL_API_TOKEN environment variable is required");
  process.exit(1);
}

// API helper
async function apiRequest(path, options = {}) {
  const url = `${API_BASE}/api/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Create MCP server
const server = new McpServer({
  name: "shipitsquirrel",
  version: "1.0.0",
});

// List all servers
server.tool(
  "list_servers",
  "List all your servers with their IP addresses and status",
  {},
  async () => {
    const data = await apiRequest("/servers");

    const summary = data.servers.map(server =>
      `- **${server.name}** (${server.ip_address}): ${server.status} - ${server.app_count} apps${server.claude_ready ? " [Claude Ready]" : ""}`
    ).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `# Your Servers\n\n${summary}\n\nTotal: ${data.servers.length} servers\n\n**Note:** You can SSH into these servers as the deploy user to run commands or use Claude Code.`,
        },
      ],
    };
  }
);

// Get server details
server.tool(
  "get_server",
  "Get detailed information about a specific server including its apps",
  {
    server_id: z.string().describe("The server ID, name, or IP address"),
  },
  async ({ server_id }) => {
    const data = await apiRequest(`/servers/${server_id}`);
    const server = data.server;

    const appsList = server.apps?.map(app =>
      `- ${app.name}: ${app.status} - ${app.deploy_path}`
    ).join("\n") || "No apps deployed";

    return {
      content: [
        {
          type: "text",
          text: `# ${server.name}

**IP Address:** ${server.ip_address}
**Status:** ${server.status}
**Provider:** ${server.provider || "N/A"}
**Region:** ${server.region || "N/A"}
**SSH User:** ${server.ssh_user}
**Claude Ready:** ${server.claude_ready ? "Yes" : "No"}

## Apps on this server
${appsList}

## SSH Access
\`\`\`bash
ssh ${server.ssh_user}@${server.ip_address}
\`\`\`

**Note:** When working on this server, make local git commits for any code changes.`,
        },
      ],
    };
  }
);

// List all apps
server.tool(
  "list_apps",
  "List all your Ship It Squirrel apps with their status and bug counts",
  {},
  async () => {
    const data = await apiRequest("/apps");

    const summary = data.apps.map(app =>
      `- **${app.name}**: ${app.status} (${app.open_bug_count} open bugs) - ${app.server || "No server"}${app.server_ip ? ` (${app.server_ip})` : ""}`
    ).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `# Your Apps\n\n${summary}\n\nTotal: ${data.apps.length} apps`,
        },
      ],
    };
  }
);

// Get app details
server.tool(
  "get_app",
  "Get detailed information about a specific app",
  {
    app_id: z.string().describe("The app ID or name"),
  },
  async ({ app_id }) => {
    const data = await apiRequest(`/apps/${app_id}`);
    const app = data.app;

    return {
      content: [
        {
          type: "text",
          text: `# ${app.name}

**Status:** ${app.status}
**Server:** ${app.server || "Not assigned"}${app.server_ip ? ` (${app.server_ip})` : ""}
**Branch:** ${app.branch}
**Domain:** ${app.domain || app.preview_url || "Not configured"}
**Deploy Path:** ${app.deploy_path || "N/A"}
**Claude Ready:** ${app.claude_ready ? "Yes" : "No"}

## Stats
- Open bugs: ${app.open_bug_count}
- Uptime (24h): ${app.uptime_percentage_24h ? `${app.uptime_percentage_24h}%` : "N/A"}
- Avg response time: ${app.avg_response_time_ms ? `${app.avg_response_time_ms}ms` : "N/A"}
- Agent connected: ${app.agent_connected ? "Yes" : "No"}
- Last deployed: ${app.last_deployed_at || "Never"}

## SSH Access
${app.ssh_user && app.server_ip ? `\`\`\`bash
ssh ${app.ssh_user}@${app.server_ip}
cd ${app.deploy_path}/current
\`\`\`` : "Server not configured"}

**Note:** When making code changes, create local git commits on the server.`,
        },
      ],
    };
  }
);

// List deployments
server.tool(
  "list_deployments",
  "List recent deployments for an app",
  {
    app_id: z.string().describe("The app ID or name"),
    limit: z.number().optional().describe("Number of deployments to return (default 10)"),
  },
  async ({ app_id, limit }) => {
    const params = limit ? `?limit=${limit}` : "?limit=10";
    const data = await apiRequest(`/apps/${app_id}/deploys${params}`);

    if (data.deploys.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No deployments found for ${data.app.name}.`,
          },
        ],
      };
    }

    const deployList = data.deploys.map(deploy => {
      const status = deploy.status === "success" ? "✓" : deploy.status === "failed" ? "✗" : "○";
      const duration = deploy.duration_seconds ? `${deploy.duration_seconds}s` : "N/A";
      return `${status} **${deploy.status}** - ${deploy.commit_message || "No message"} (${deploy.branch}) - ${duration}
   ${deploy.started_at || deploy.created_at} | ID: ${deploy.id}`;
    }).join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `# Deployments for ${data.app.name}\n\n${deployList}`,
        },
      ],
    };
  }
);

// Get deployment details
server.tool(
  "get_deployment",
  "Get detailed information about a specific deployment including logs",
  {
    app_id: z.string().describe("The app ID or name"),
    deploy_id: z.string().describe("The deployment ID"),
  },
  async ({ app_id, deploy_id }) => {
    const data = await apiRequest(`/apps/${app_id}/deploys/${deploy_id}`);
    const deploy = data.deploy;

    const log = deploy.log || "No log available";

    return {
      content: [
        {
          type: "text",
          text: `# Deployment ${deploy.id}

**Status:** ${deploy.status}
**Branch:** ${deploy.branch}
**Commit:** ${deploy.commit_sha || "N/A"}
**Message:** ${deploy.commit_message_full || "No message"}
**Initiated by:** ${deploy.initiated_by || "Unknown"}
**Started:** ${deploy.started_at || "N/A"}
**Finished:** ${deploy.finished_at || "N/A"}
**Duration:** ${deploy.duration_seconds ? `${deploy.duration_seconds} seconds` : "N/A"}

${deploy.error_message ? `## Error\n\`\`\`\n${deploy.error_message}\n\`\`\`\n` : ""}

## Deployment Log
\`\`\`
${log}
\`\`\``,
        },
      ],
    };
  }
);

// List bugs for an app
server.tool(
  "list_bugs",
  "List bugs for a specific app, optionally filtered by status",
  {
    app_id: z.string().describe("The app ID"),
    status: z.string().optional().describe("Filter by status: open, resolved, or ignored (optional)"),
  },
  async ({ app_id, status }) => {
    const params = status ? `?status=${status}` : "";
    const data = await apiRequest(`/apps/${app_id}/bugs${params}`);

    if (data.bugs.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No ${status || ""} bugs found for this app.`,
          },
        ],
      };
    }

    const bugList = data.bugs.map(bug =>
      `## ${bug.error_class}
**Message:** ${bug.message}
**Status:** ${bug.status} | **Occurrences:** ${bug.occurrence_count}
**First seen:** ${bug.first_seen_at} | **Last seen:** ${bug.last_seen_at}
**ID:** ${bug.id}
---`
    ).join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `# Bugs (${data.counts.open} open, ${data.counts.resolved} resolved, ${data.counts.ignored} ignored)\n\n${bugList}`,
        },
      ],
    };
  }
);

// Get bug details
server.tool(
  "get_bug",
  "Get detailed information about a specific bug including backtrace",
  {
    app_id: z.string().describe("The app ID"),
    bug_id: z.string().describe("The bug ID"),
  },
  async ({ app_id, bug_id }) => {
    const data = await apiRequest(`/apps/${app_id}/bugs/${bug_id}`);
    const bug = data.bug;

    const backtrace = bug.backtrace?.slice(0, 15).join("\n") || "No backtrace available";
    const context = bug.context ? JSON.stringify(bug.context, null, 2) : "No context";

    return {
      content: [
        {
          type: "text",
          text: `# ${bug.error_class}

**Message:** ${bug.message}
**Status:** ${bug.status}
**Occurrences:** ${bug.occurrence_count}
**First seen:** ${bug.first_seen_at}
**Last seen:** ${bug.last_seen_at}

## Backtrace (first 15 lines)
\`\`\`
${backtrace}
\`\`\`

## Context
\`\`\`json
${context}
\`\`\`

${bug.resolution_notes ? `## Resolution Notes\n${bug.resolution_notes}` : ""}`,
        },
      ],
    };
  }
);

// Resolve a bug
server.tool(
  "resolve_bug",
  "Mark a bug as resolved",
  {
    app_id: z.string().describe("The app ID"),
    bug_id: z.string().describe("The bug ID"),
    notes: z.string().optional().describe("Optional resolution notes"),
  },
  async ({ app_id, bug_id, notes }) => {
    const body = notes ? JSON.stringify({ notes }) : undefined;
    const data = await apiRequest(`/apps/${app_id}/bugs/${bug_id}/resolve`, {
      method: "POST",
      body,
    });

    return {
      content: [
        {
          type: "text",
          text: `Bug resolved: ${data.bug.error_class}\n\nThe bug has been marked as resolved.`,
        },
      ],
    };
  }
);

// Ignore a bug
server.tool(
  "ignore_bug",
  "Mark a bug as ignored (won't show in open bugs)",
  {
    app_id: z.string().describe("The app ID"),
    bug_id: z.string().describe("The bug ID"),
    notes: z.string().optional().describe("Optional notes explaining why it's being ignored"),
  },
  async ({ app_id, bug_id, notes }) => {
    const body = notes ? JSON.stringify({ notes }) : undefined;
    const data = await apiRequest(`/apps/${app_id}/bugs/${bug_id}/ignore`, {
      method: "POST",
      body,
    });

    return {
      content: [
        {
          type: "text",
          text: `Bug ignored: ${data.bug.error_class}\n\nThe bug has been marked as ignored.`,
        },
      ],
    };
  }
);

// Reopen a bug
server.tool(
  "reopen_bug",
  "Reopen a previously resolved or ignored bug",
  {
    app_id: z.string().describe("The app ID"),
    bug_id: z.string().describe("The bug ID"),
  },
  async ({ app_id, bug_id }) => {
    const data = await apiRequest(`/apps/${app_id}/bugs/${bug_id}/reopen`, {
      method: "POST",
    });

    return {
      content: [
        {
          type: "text",
          text: `Bug reopened: ${data.bug.error_class}\n\nThe bug is now open again.`,
        },
      ],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ship It Squirrel MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
