# Ship It Squirrel → Accomplice

**This project has been renamed and moved to [Accomplice](https://accomplice.ai).**

The MCP server now lives in the main Accomplice repository:
https://github.com/adamhowell/accomplice/tree/main/mcp-server

## Migration

If you're using the Ship It Squirrel MCP server, update your configuration:

1. Replace `SHIPITSQUIRREL_API_TOKEN` with `ACCOMPLICE_API_TOKEN`
2. Replace `SHIPITSQUIRREL_URL` with `ACCOMPLICE_API_URL` (defaults to `https://accomplice.ai`)
3. Point your MCP config at the new server location in the accomplice repo

The old environment variable names still work for backwards compatibility.

---

*This repository is archived. All development continues at [github.com/adamhowell/accomplice](https://github.com/adamhowell/accomplice).*
