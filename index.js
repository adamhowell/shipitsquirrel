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
  version: "2.0.0",
});

// ── Servers ─────────────────────────────────────────────────────────────────────

server.tool(
  "list_servers",
  "List all your servers with their IP addresses and status",
  {},
  async () => {
    const data = await apiRequest("/servers");

    const summary = data.servers.map(s =>
      `- **${s.name}** (${s.ip_address}): ${s.status} - ${s.app_count} apps`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `# Your Servers\n\n${summary}\n\nTotal: ${data.servers.length} servers\n\n**Note:** You can SSH into these servers as the deploy user to run commands or use Claude Code.`,
      }],
    };
  }
);

server.tool(
  "get_server",
  "Get detailed information about a specific server including its apps",
  {
    server_id: z.string().describe("The server ID, name, or IP address"),
  },
  async ({ server_id }) => {
    const data = await apiRequest(`/servers/${encodeURIComponent(server_id)}`);
    const s = data.server;

    const appList = s.apps?.map(a => `- ${a.name}: ${a.status} - ${a.deploy_path}`).join("\n") || "No apps";

    return {
      content: [{
        type: "text",
        text: `# ${s.name}

**IP Address:** ${s.ip_address}
**Status:** ${s.status}
**Provider:** ${s.provider || "N/A"}
**Region:** ${s.region || "N/A"}
**SSH User:** ${s.ssh_user || "deploy"}

## Apps on this server
${appList}

## SSH Access
\`\`\`bash
ssh ${s.ssh_user || "deploy"}@${s.ip_address}
\`\`\`

**Note:** When working on this server, make local git commits for any code changes.`,
      }],
    };
  }
);

server.tool(
  "list_regions",
  "List available DigitalOcean regions for server creation",
  {},
  async () => {
    const data = await apiRequest("/regions");

    if (data.regions.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No regions available. Make sure your DigitalOcean token is configured.",
        }],
      };
    }

    const table = data.regions.map(r =>
      `| ${r.slug} | ${r.name} |`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `# Available Regions

| Slug | Name |
|------|------|
${table}

Use the **slug** value when creating a server with \`create_server\`.`,
      }],
    };
  }
);

server.tool(
  "list_sizes",
  "List available DigitalOcean droplet sizes for server creation",
  {},
  async () => {
    const data = await apiRequest("/sizes");

    if (data.sizes.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No sizes available. Make sure your DigitalOcean token is configured.",
        }],
      };
    }

    const table = data.sizes.map(s => {
      const ram = s.memory >= 1024 ? `${s.memory / 1024}GB` : `${s.memory}MB`;
      return `| ${s.slug} | ${s.vcpus} | ${ram} | ${s.disk}GB | $${s.price_monthly}/mo |`;
    }).join("\n");

    return {
      content: [{
        type: "text",
        text: `# Available Sizes

| Slug | CPUs | RAM | Disk | Price |
|------|------|-----|------|-------|
${table}

Use the **slug** value when creating a server with \`create_server\`. Minimum 2GB RAM is required for Rails.`,
      }],
    };
  }
);

server.tool(
  "create_server",
  "Create a new server (DigitalOcean droplet) and start provisioning with Ruby, PostgreSQL, Redis, and Caddy",
  {
    name: z.string().describe("Server name (e.g., 'my-rails-server')"),
    region: z.string().describe("DigitalOcean region slug (e.g., 'nyc1'). Use list_regions to see options."),
    size: z.string().describe("Droplet size slug (e.g., 's-1vcpu-2gb'). Use list_sizes to see options."),
  },
  async ({ name, region, size }) => {
    const data = await apiRequest("/servers", {
      method: "POST",
      body: JSON.stringify({ name, region, size }),
    });

    const s = data.server;

    return {
      content: [{
        type: "text",
        text: `# Server Created

**Name:** ${s.name}
**Status:** ${s.status}
**Region:** ${s.region}
**Size:** ${s.size || size}

${data.message}

Use \`get_server\` with name "${s.name}" to check provisioning progress. Once status is "provisioned" or "connected", you can create apps on it.`,
      }],
    };
  }
);

server.tool(
  "delete_server",
  "Delete a server and its DigitalOcean droplet",
  {
    server_id: z.string().describe("The server ID, name, or IP address"),
  },
  async ({ server_id }) => {
    const data = await apiRequest(`/servers/${encodeURIComponent(server_id)}`, {
      method: "DELETE",
    });

    return {
      content: [{
        type: "text",
        text: `${data.message}${data.droplet_deleted ? " (droplet also deleted from DigitalOcean)" : " (note: droplet may still exist on DigitalOcean)"}`,
      }],
    };
  }
);

// ── Apps ────────────────────────────────────────────────────────────────────────

server.tool(
  "list_apps",
  "List all your Ship It Squirrel apps with their status and bug counts",
  {},
  async () => {
    const data = await apiRequest("/apps");

    const summary = data.apps.map(app =>
      `- **${app.name}**: ${app.status} (${app.open_bug_count} open bugs) - ${app.server || "no server"} (${app.server_ip || "N/A"})`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `# Your Apps\n\n${summary}\n\nTotal: ${data.apps.length} apps`,
      }],
    };
  }
);

server.tool(
  "get_app",
  "Get detailed information about a specific app",
  {
    app_id: z.string().describe("The app ID or name"),
  },
  async ({ app_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}`);
    const app = data.app;

    return {
      content: [{
        type: "text",
        text: `# ${app.name}

**Status:** ${app.status}
**Server:** ${app.server || "Not assigned"} (${app.server_ip || "N/A"})
**Branch:** ${app.branch}
**Domain:** ${app.domain || app.preview_url || "Not configured"}
**Deploy Path:** ${app.deploy_path}

## Stats
- Open bugs: ${app.open_bug_count}
- Uptime (24h): ${app.uptime_percentage_24h ? `${app.uptime_percentage_24h}%` : "N/A"}
- Avg response time: ${app.avg_response_time_ms ? `${app.avg_response_time_ms}ms` : "N/A"}
- Agent connected: ${app.agent_connected ? "Yes" : "No"}
- Last deployed: ${app.last_deployed_at || "Never"}

## SSH Access
\`\`\`bash
ssh ${app.ssh_user || "deploy"}@${app.server_ip}
cd ${app.deploy_path}/current
\`\`\`

**Note:** When making code changes, create local git commits on the server.`,
      }],
    };
  }
);

server.tool(
  "create_app",
  "Create a new app on a server. Configures deploy key, webhook, and subdomain automatically.",
  {
    name: z.string().describe("App name (e.g., 'my-rails-app')"),
    server_id: z.string().describe("Server ID or name to deploy on"),
    repo_url: z.string().describe("Git repository URL (e.g., 'git@github.com:user/repo.git')"),
    branch: z.string().optional().describe("Git branch (default: 'main')"),
    rails_master_key: z.string().optional().describe("Rails master key for credentials decryption"),
    deploy_mode: z.string().optional().describe("'manual' (default) or 'auto' for auto-deploy on push"),
    domain: z.string().optional().describe("Custom domain (e.g., 'myapp.com'). A preview URL is always generated."),
  },
  async ({ name, server_id, repo_url, branch, rails_master_key, deploy_mode, domain }) => {
    const body = { name, server_id, repo_url };
    if (branch) body.branch = branch;
    if (rails_master_key) body.rails_master_key = rails_master_key;
    if (deploy_mode) body.deploy_mode = deploy_mode;
    if (domain) body.domain = domain;

    const data = await apiRequest("/apps", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const app = data.app;

    return {
      content: [{
        type: "text",
        text: `# App Created

**Name:** ${app.name}
**Server:** ${app.server}
**Branch:** ${app.branch}
**Deploy Mode:** ${app.deploy_mode}
**Preview URL:** ${app.preview_url}
${app.domain ? `**Domain:** ${app.domain}` : ""}
**Deploy Path:** ${app.deploy_path}

${data.message}

**Next steps:**
1. Run \`deploy_app\` with app name "${app.name}" to deploy
2. Use \`get_deployment\` to check deploy progress
3. Visit ${app.preview_url} once deployed`,
      }],
    };
  }
);

server.tool(
  "update_app",
  "Update an app's configuration (branch, deploy mode, domain, or Rails master key)",
  {
    app_id: z.string().describe("The app ID or name"),
    branch: z.string().optional().describe("Git branch to deploy from"),
    deploy_mode: z.string().optional().describe("'manual' or 'auto'"),
    domain: z.string().optional().describe("Custom domain"),
    rails_master_key: z.string().optional().describe("Rails master key"),
  },
  async ({ app_id, branch, deploy_mode, domain, rails_master_key }) => {
    const body = {};
    if (branch !== undefined) body.branch = branch;
    if (deploy_mode !== undefined) body.deploy_mode = deploy_mode;
    if (domain !== undefined) body.domain = domain;
    if (rails_master_key !== undefined) body.rails_master_key = rails_master_key;

    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const app = data.app;

    return {
      content: [{
        type: "text",
        text: `# App Updated: ${app.name}

**Branch:** ${app.branch}
**Deploy Mode:** ${app.deploy_mode}
**Domain:** ${app.domain || app.preview_url}
**Server:** ${app.server}

${data.message}`,
      }],
    };
  }
);

server.tool(
  "delete_app",
  "Delete an app and all its associated data (bugs, deploys, uptime checks)",
  {
    app_id: z.string().describe("The app ID or name"),
  },
  async ({ app_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}`, {
      method: "DELETE",
    });

    return {
      content: [{
        type: "text",
        text: data.message,
      }],
    };
  }
);

// ── Deployments ─────────────────────────────────────────────────────────────────

server.tool(
  "list_deployments",
  "List recent deployments for an app",
  {
    app_id: z.string().describe("The app ID or name"),
    limit: z.number().optional().describe("Number of deployments to return (default 10)"),
  },
  async ({ app_id, limit }) => {
    const params = limit ? `?limit=${limit}` : "?limit=10";
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/deploys${params}`);

    if (data.deploys.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No deployments found for ${data.app.name}.`,
        }],
      };
    }

    const deployList = data.deploys.map(d => {
      const duration = d.duration_seconds ? `${d.duration_seconds}s` : "N/A";
      const sha = d.commit_sha ? d.commit_sha.substring(0, 8) : "N/A";
      return `| ${d.status} | ${sha} | ${d.commit_message || "N/A"} | ${d.deployed_by || "N/A"} | ${duration} | ${d.started_at || d.finished_at || "N/A"} | ${d.id} |`;
    }).join("\n");

    return {
      content: [{
        type: "text",
        text: `# Deployments for ${data.app.name}

| Status | Commit | Message | By | Duration | Time | ID |
|--------|--------|---------|----|----------|------|----|
${deployList}`,
      }],
    };
  }
);

server.tool(
  "get_deployment",
  "Get detailed information about a specific deployment including logs",
  {
    app_id: z.string().describe("The app ID or name"),
    deploy_id: z.string().describe("The deployment ID"),
  },
  async ({ app_id, deploy_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/deploys/${deploy_id}`);
    const d = data.deploy;

    const duration = d.duration_seconds ? `${d.duration_seconds}s` : "N/A";

    return {
      content: [{
        type: "text",
        text: `# Deployment ${d.id}

**Status:** ${d.status}
**Branch:** ${d.branch}
**Commit:** ${d.commit_sha || "N/A"}
**Message:** ${d.commit_message_full || d.commit_message || "N/A"}
**Deployed by:** ${d.deployed_by || "N/A"}
**Started:** ${d.started_at || "N/A"}
**Finished:** ${d.finished_at || "N/A"}
**Duration:** ${duration}

## Deploy Log
\`\`\`
${d.log || "No log available"}
\`\`\``,
      }],
    };
  }
);

server.tool(
  "deploy_app",
  "Trigger a new deployment for an app. Cancels any queued/running deploys first.",
  {
    app_id: z.string().describe("The app ID or name"),
  },
  async ({ app_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/deploys`, {
      method: "POST",
    });

    return {
      content: [{
        type: "text",
        text: `# Deployment Queued

**App:** ${data.deploy.branch}
**Deploy ID:** ${data.deploy.id}
**Status:** ${data.deploy.status}

The deployment has been queued and will start shortly. Use \`get_deployment\` with the deploy ID to check progress.`,
      }],
    };
  }
);

// ── App Operations ──────────────────────────────────────────────────────────────

server.tool(
  "restart_app",
  "Restart the application (Puma web server process)",
  {
    app_id: z.string().describe("The app ID or name"),
  },
  async ({ app_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/restart`, {
      method: "POST",
    });

    return {
      content: [{
        type: "text",
        text: `Application restarted successfully: ${data.app.name}`,
      }],
    };
  }
);

server.tool(
  "rollback_app",
  "Rollback to the previous successful deployment",
  {
    app_id: z.string().describe("The app ID or name"),
  },
  async ({ app_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/rollback`, {
      method: "POST",
    });

    return {
      content: [{
        type: "text",
        text: `Rollback completed successfully: ${data.app.name}`,
      }],
    };
  }
);

server.tool(
  "get_app_logs",
  "Get recent application logs (from journalctl/systemd)",
  {
    app_id: z.string().describe("The app ID or name"),
    lines: z.number().optional().describe("Number of log lines to fetch (default 100, max 500)"),
  },
  async ({ app_id, lines }) => {
    const params = lines ? `?lines=${lines}` : "";
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/logs${params}`);

    return {
      content: [{
        type: "text",
        text: `# Logs for ${data.app.name} (last ${data.lines} lines)

\`\`\`
${data.logs || "No logs available"}
\`\`\``,
      }],
    };
  }
);

// ── Bugs ────────────────────────────────────────────────────────────────────────

server.tool(
  "list_bugs",
  "List bugs for a specific app, optionally filtered by status",
  {
    app_id: z.string().describe("The app ID"),
    status: z.string().optional().describe("Filter by status: open, resolved, or ignored (optional)"),
  },
  async ({ app_id, status }) => {
    const params = status ? `?status=${status}` : "";
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/bugs${params}`);

    if (data.bugs.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No ${status || ""} bugs found for this app.`,
        }],
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
      content: [{
        type: "text",
        text: `# Bugs (${data.counts.open} open, ${data.counts.resolved} resolved, ${data.counts.ignored} ignored)\n\n${bugList}`,
      }],
    };
  }
);

server.tool(
  "get_bug",
  "Get detailed information about a specific bug including backtrace",
  {
    app_id: z.string().describe("The app ID"),
    bug_id: z.string().describe("The bug ID"),
  },
  async ({ app_id, bug_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/bugs/${bug_id}`);
    const bug = data.bug;

    const backtrace = bug.backtrace?.slice(0, 15).join("\n") || "No backtrace available";
    const context = bug.context ? JSON.stringify(bug.context, null, 2) : "No context";

    return {
      content: [{
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
      }],
    };
  }
);

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
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/bugs/${bug_id}/resolve`, {
      method: "POST",
      body,
    });

    return {
      content: [{
        type: "text",
        text: `Bug resolved: ${data.bug.error_class}\n\nThe bug has been marked as resolved.`,
      }],
    };
  }
);

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
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/bugs/${bug_id}/ignore`, {
      method: "POST",
      body,
    });

    return {
      content: [{
        type: "text",
        text: `Bug ignored: ${data.bug.error_class}\n\nThe bug has been marked as ignored.`,
      }],
    };
  }
);

server.tool(
  "reopen_bug",
  "Reopen a previously resolved or ignored bug",
  {
    app_id: z.string().describe("The app ID"),
    bug_id: z.string().describe("The bug ID"),
  },
  async ({ app_id, bug_id }) => {
    const data = await apiRequest(`/apps/${encodeURIComponent(app_id)}/bugs/${bug_id}/reopen`, {
      method: "POST",
    });

    return {
      content: [{
        type: "text",
        text: `Bug reopened: ${data.bug.error_class}\n\nThe bug is now open again.`,
      }],
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
