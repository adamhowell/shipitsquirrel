# Ship It Squirrel MCP Server

Connect Claude Code to your Ship It Squirrel apps for bug tracking and monitoring.

## Installation

### 1. Get your API Token

1. Go to [shipitsquirrel.com/settings/integrations](https://shipitsquirrel.com/settings/integrations)
2. Create a new API token
3. Copy the token

### 2. Add to Claude Code

Add this to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "shipitsquirrel": {
      "command": "npx",
      "args": ["-y", "github:adamhowell/shipitsquirrel"],
      "env": {
        "SHIPITSQUIRREL_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### 3. Restart Claude Code

Restart Claude Code to load the new MCP server.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_apps` | List all your apps with status and bug counts |
| `get_app` | Get detailed info about a specific app |
| `list_bugs` | List bugs for an app (filter by status) |
| `get_bug` | Get full bug details including backtrace |
| `resolve_bug` | Mark a bug as resolved |
| `ignore_bug` | Mark a bug as ignored |
| `reopen_bug` | Reopen a resolved/ignored bug |

## Example Usage

Once connected, you can ask Claude things like:

- "List my Ship It Squirrel apps"
- "Show me the open bugs for my-app"
- "Get details on bug abc123"
- "Resolve bug xyz789 with notes 'Fixed in commit abc'"
- "What bugs have occurred in the last 24 hours?"

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
