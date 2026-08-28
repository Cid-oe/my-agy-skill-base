---
name: flight-schema
description: '['
kind: local
model: inherit
agy:
  version: 1.0.0
  category: database
  tags:
  - flight_schema
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text. Merged 2 same-name variants into one canonical agent.
  validation: passed
  imported: '2026-08-26T08:59:14+00:00'
  sources:
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/ag2/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/agno/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langroid/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/claude-sdk-python/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/claude-sdk-typescript/src/agent/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/crewai-conversational-flows/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/crewai-crews/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/google-adk/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-fastapi/src/agents/src/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-python/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-typescript/src/agent/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/llamaindex/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/ms-agent-python/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/pydantic-ai/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/strands-typescript/src/agent/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/strands/src/agents/a2ui_schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-fastapi/src/agents/src/beautiful_chat_data/schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-python/src/agents/beautiful_chat_data/schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/langgraph-typescript/src/agent/beautiful-chat-data/schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/ms-agent-python/src/agents/beautiful_chat_data/schemas/flight_schema.json
    format: json
  - repo: CopilotKit/CopilotKit
    author: CopilotKit
    license: MIT
    url: https://github.com/CopilotKit/CopilotKit
    path: showcase/integrations/pydantic-ai/src/agents/beautiful_chat_data/schemas/flight_schema.json
    format: json
---

[
  {
    "id": "root",
    "component": "Card",
    "child": "content"
  },
  {
    "id": "content",
    "component": "Column",
    "children": ["title", "route", "meta", "bookButton"]
  },
  {
    "id": "title",
    "component": "Title",
    "text": "Flight Details"
  },
  {
    "id": "route",
    "component": "Row",
    "justify": "spaceBetween",
    "align": "center",
    "children": ["from", "arrow", "to"]
  },
  {
    "id": "from",
    "component": "Airport",
    "code": { "path": "/origin" }
  },
  {
    "id": "arrow",
    "component": "Arrow"
  },
  {
    "id": "to",
    "component": "Airport",
    "code": { "path": "/destination" }
  },
  {
    "id": "meta",
    "component": "Row",
    "justify": "spaceBetween",
    "align": "center",
    "children": ["airline", "price"]
  },
  {
    "id": "airline",
    "component": "AirlineBadge",
    "name": { "path": "/airline" }
  },
  {
    "id": "price",
    "component": "PriceTag",
    "amount": { "path": "/price" }
  },
  {
    "id": "bookButton",
    "component": "Button",
    "variant": "primary",
    "child": "bookButtonLabel",
    "action": {
      "event": {
        "name": "book_flight",
        "context": {
          "origin": { "path": "/origin" },
          "destination": { "path": "/destination" },
          "airline": { "path": "/airline" },
          "price": { "path": "/price" }
        }
      }
    }
  },
  {
    "id": "bookButtonLabel",
    "component": "Text",
    "text": "Book flight"
  }
]
