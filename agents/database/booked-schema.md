---
name: booked-schema
description: '['
kind: local
model: inherit
agy:
  version: 1.0.0
  category: database
  tags:
  - booked_schema
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T08:59:14+00:00'
  sources:
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/ag2/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/agno/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/claude-sdk-python/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/crewai-conversational-flows/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/crewai-crews/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/google-adk/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-fastapi/src/agents/src/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-typescript/src/agent/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/llamaindex/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/ms-agent-python/src/agents/a2ui_schemas/booked_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/pydantic-ai/src/agents/a2ui_schemas/booked_schema.json
    format: json
---

[
  {
    "id": "root",
    "component": "Column",
    "gap": 8,
    "children": ["title", "detail"]
  },
  {
    "id": "title",
    "component": "Text",
    "text": { "path": "/title" },
    "variant": "h2"
  },
  {
    "id": "detail",
    "component": "Text",
    "text": { "path": "/detail" },
    "variant": "body"
  }
]
