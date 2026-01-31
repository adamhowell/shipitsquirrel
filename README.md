# Ship It Squirrel MCP Server

Connect Claude Code to your Ship It Squirrel apps to deploy, monitor, debug, and fix your Rails apps from the terminal.

## Installation

### 1. Get your API Token

1. Go to [shipitsquirrel.com/settings/api](https://shipitsquirrel.com/settings/api)
2. Create a new API token
3. Copy the token

### 2. Add to Claude Code

The easiest way is to use the CLI:

```bash
claude mcp add -e "SHIPITSQUIRREL_API_TOKEN=your-api-token-here" -s user shipitsquirrel -- npx -y @shipitsquirrel/mcp-server
```

Or manually add this to your `~/.claude.json` file:

```json
{
  "mcpServers": {
    "shipitsquirrel": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@shipitsquirrel/mcp-server"],
      "env": {
        "SHIPITSQUIRREL_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### 3. Restart Claude Code

Restart Claude Code to load the new MCP server. Verify it's connected with `/mcp`.

## Available Tools

### Infrastructure

| Tool | Description |
|------|-------------|
| `list_regions` | List available DigitalOcean regions |
| `list_sizes` | List available droplet sizes with pricing |
| `create_server` | Create and provision a new server (Ruby, PostgreSQL, Redis, Caddy) |
| `delete_server` | Delete a server and its DigitalOcean droplet |
| `create_app` | Create a new app on a server with GitHub integration |
| `update_app` | Update app config (branch, deploy mode, domain) |
| `delete_app` | Delete an app and all associated data |

### Servers

| Tool | Description |
|------|-------------|
| `list_servers` | List all your servers with IPs and status |
| `get_server` | Get detailed server info including apps |

### Apps

| Tool | Description |
|------|-------------|
| `list_apps` | List all your apps with status and bug counts |
| `get_app` | Get detailed info about a specific app |

### Deployments & Operations

| Tool | Description |
|------|-------------|
| `list_deployments` | List recent deployments for an app |
| `get_deployment` | Get deployment details including full log |
| `deploy_app` | Trigger a new deployment |
| `restart_app` | Restart the application (Puma) |
| `rollback_app` | Rollback to previous successful deployment |
| `get_app_logs` | Get recent application logs from the server |

### Bug Tracking

| Tool | Description |
|------|-------------|
| `list_bugs` | List bugs for an app (filter by status) |
| `get_bug` | Get full bug details including backtrace |
| `resolve_bug` | Mark a bug as resolved |
| `ignore_bug` | Mark a bug as ignored |
| `reopen_bug` | Reopen a resolved/ignored bug |

## Getting Started with Agents

With the infrastructure tools, Claude can go from zero to a running Rails app entirely from the terminal:

```
1. list_regions / list_sizes        → pick infrastructure
2. create_server name region size   → provisions in ~5 min
3. get_server (poll until ready)
4. create_app name server repo      → configures everything
5. deploy_app                       → live app with SSL
```

Just tell Claude: *"Create a new server in NYC and deploy my Rails app from github.com/user/repo"* and it handles the rest.

**Prerequisites:** You need a DigitalOcean token configured in [Settings > Integrations](https://shipitsquirrel.com/settings/integrations) and an active subscription in [Settings > Billing](https://shipitsquirrel.com/settings/billing).

## Example Usage

Once connected, you can ask Claude things like:

- "Create a new server in San Francisco and deploy my app"
- "List my Ship It Squirrel servers"
- "Show me open bugs for my-app"
- "Get details on bug abc123 and fix the code"
- "Deploy my-app"
- "Show me the last 200 lines of logs for my-app"
- "Rollback my-app to the previous version"
- "Restart my-app"
- "Resolve bug xyz789 with notes 'Fixed in commit abc'"

### Full Bug Fix Workflow

Claude can handle the entire cycle: see a bug, read the backtrace, find the relevant code, fix it, deploy the fix, then mark the bug as resolved.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHIPITSQUIRREL_API_TOKEN` | Yes | Your API token from shipitsquirrel.com |
| `SHIPITSQUIRREL_URL` | No | API base URL (default: https://shipitsquirrel.com) |

## Development

```bash
npm install
SHIPITSQUIRREL_API_TOKEN=your-token npm start
```

## License

MIT
