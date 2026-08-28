# Model Context Protocol (MCP) Server Architecture & Integration Catalog

This catalog outlines vetted, production-grade Model Context Protocol (MCP) servers across essential software engineering, AI infrastructure, database, and workspace collaboration domains.

---

## 1. Core Developer & System MCP Servers

| Domain | Server Name | Package / Repository | Capabilities | Transport | Production Readiness |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GitHub** | `@modelcontextprotocol/server-github` | `npx -y @modelcontextprotocol/server-github` | PRs, issues, repos, commit inspection, code search | stdio / sse | Tier 1 (Official) |
| **Git** | `@modelcontextprotocol/server-git` | `npx -y @modelcontextprotocol/server-git` | Local git repo branches, diffs, commits, history | stdio | Tier 1 (Official) |
| **Filesystem** | `@modelcontextprotocol/server-filesystem` | `npx -y @modelcontextprotocol/server-filesystem <allowed-paths>` | Scoped file read/write, directory traversal, search | stdio | Tier 1 (Official) |
| **Terminal / CLI** | `mcp-server-terminal` / `cmux` | `npx -y @modelcontextprotocol/server-terminal` | Sandboxed command execution, environment variable handling | stdio | Tier 1 |
| **Memory / Graph** | `@modelcontextprotocol/server-memory` | `npx -y @modelcontextprotocol/server-memory` | Persistent knowledge graph & entity-relation memory | stdio | Tier 1 (Official) |

---

## 2. Databases & Storage MCP Servers

| Domain | Server Name | Package / Repo | Capabilities | Connection Spec | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `@modelcontextprotocol/server-postgres` | `npx -y @modelcontextprotocol/server-postgres <POSTGRES_URL>` | Read/write SQL execution, schema inspection, explain plans | `postgresql://user:pass@localhost:5432/db` | Approved |
| **SQLite** | `@modelcontextprotocol/server-sqlite` | `npx -y @modelcontextprotocol/server-sqlite --db-path <path>` | Lightweight zero-config relational database ops | Local `.db` path | Approved |
| **Redis** | `mcp-server-redis` | `npx -y @modelcontextprotocol/server-redis` | Key-value manipulation, TTLs, pub/sub monitoring, caching | `redis://localhost:6379` | Approved |
| **Vector DBs** | `mcp-server-qdrant` / `weaviate-mcp` | `uvx mcp-server-qdrant` / `uvx weaviate-mcp` | Vector embeddings insertion, similarity & hybrid search | GRPC / REST | Approved |

---

## 3. DevOps, Containerization & Cloud MCP Servers

| Domain | Server Name | Package / Repo | Capabilities | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Docker** | `mcp-server-docker` | `npx -y @modelcontextprotocol/server-docker` | Container lifecycle (start/stop/logs), image inspect, volume mounts | Approved |
| **Kubernetes** | `mcp-server-kubernetes` | `uvx mcp-server-kubernetes` | Pod, Deployment, Service triage, kubectl operations, logs | Approved |
| **AWS** | `aws-mcp` / `awslabs/mcp-server` | `uvx mcp-server-aws` | CloudWatch, S3, ECS, Lambda metrics and diagnostic actions | Approved |

---

## 4. Browser Automation & Testing MCP Servers

| Domain | Server Name | Package / Repo | Capabilities | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Playwright** | `@executeautomation/playwright-mcp-server` | `npx -y @executeautomation/playwright-mcp-server` | Headless/headed browser automation, screenshot capture, DOM scraping | Approved |
| **Puppeteer** | `@modelcontextprotocol/server-puppeteer` | `npx -y @modelcontextprotocol/server-puppeteer` | Page navigation, evaluation, console logging, visual checks | Approved |
| **Browserbase** | `mcp-browserbase` | `uvx @browserbasehq/mcp-browserbase` | Cloud-hosted browser execution with anti-bot bypass & proxy support | Approved |

---

## 5. Productivity, Design & Workspace Integrations

| Service | MCP Provider | Capabilities | Auth Mechanism |
| :--- | :--- | :--- | :--- |
| **Figma** | `figma-mcp` | Read design files, export components, inspect design tokens | Figma Personal Access Token |
| **Slack** | `@modelcontextprotocol/server-slack` | Channel reading/posting, thread replies, bot triggers | Slack Bot User OAuth Token |
| **Discord** | `mcp-server-discord` | Guild messaging, channel management, embed dispatch | Discord Bot Token |
| **Linear** | `linear-mcp-server` | Issue creation, status transitions, project tracking | Linear API Key |
| **Jira** | `jira-mcp-server` | Atlassian ticket management, sprint updates, JQL querying | Atlassian API Token |
| **Notion** | `notion-mcp-server` | Database querying, document creation, block updates | Notion Integration Secret |
| **Obsidian** | `obsidian-mcp-server` | Vault navigation, markdown notes linking, daily notes | Local Vault Path |
| **Google Suite** | `google-workspace-mcp` | Gmail reading/drafting, Google Calendar events, Drive files | OAuth2 Client Credentials |

---

## 6. Recommended Standard `mcp_config.json` Configuration

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/cid"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```
