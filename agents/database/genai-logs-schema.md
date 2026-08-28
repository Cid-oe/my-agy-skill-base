---
name: genai-logs-schema
description: '['
kind: local
model: inherit
agy:
  version: 1.0.0
  category: database
  tags:
  - genai_logs_schema
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T08:58:35+00:00'
  sources:
  - repo: google/agents-cli
    author: google
    license: Apache-2.0
    url: https://github.com/google/agents-cli
    path: src/google/agents/cli/scaffold/base_templates/python/deployment/terraform/shared/genai_logs_schema.json
    format: json
---

[
  { "name": "logName",          "type": "STRING",    "mode": "NULLABLE" },
  { "name": "textPayload",      "type": "STRING",    "mode": "NULLABLE" },
  { "name": "timestamp",        "type": "TIMESTAMP", "mode": "NULLABLE" },
  { "name": "receiveTimestamp",  "type": "TIMESTAMP", "mode": "NULLABLE" },
  { "name": "severity",         "type": "STRING",    "mode": "NULLABLE" },
  { "name": "insertId",         "type": "STRING",    "mode": "NULLABLE" },
  { "name": "trace",            "type": "STRING",    "mode": "NULLABLE" },
  { "name": "spanId",           "type": "STRING",    "mode": "NULLABLE" },
  { "name": "traceSampled",     "type": "BOOLEAN",   "mode": "NULLABLE" },
  {
    "name": "resource", "type": "RECORD", "mode": "NULLABLE",
    "fields": [
      { "name": "type", "type": "STRING", "mode": "NULLABLE" },
      {
        "name": "labels", "type": "RECORD", "mode": "NULLABLE",
        "fields": [
          { "name": "project_id", "type": "STRING", "mode": "NULLABLE" },
          { "name": "location",   "type": "STRING", "mode": "NULLABLE" }
        ]
      }
    ]
  },
  {
    "name": "labels", "type": "RECORD", "mode": "NULLABLE",
    "fields": [
      { "name": "gen_ai_conversation_id",         "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_agent_name",              "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_input_messages_ref",      "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_output_messages_ref",     "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_system_instructions_ref", "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_usage_input_tokens",      "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_usage_output_tokens",     "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_response_finish_reasons", "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_tool_definitions",        "type": "STRING", "mode": "NULLABLE" },
      { "name": "gen_ai_tool_definitions_ref",    "type": "STRING", "mode": "NULLABLE" },
      { "name": "gcp_vertex_agent_invocation_id", "type": "STRING", "mode": "NULLABLE" },
      { "name": "gcp_vertex_agent_event_id",      "type": "STRING", "mode": "NULLABLE" },
      { "name": "event_name",                     "type": "STRING", "mode": "NULLABLE" }
    ]
  }
]
