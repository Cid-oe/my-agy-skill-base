---
name: 2026-08-25-files-service-seam
description: 'Status: implemented'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
  tags: []
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T09:07:13+00:00'
  sources:
  - repo: Draculabo/AntigravityManager
    author: Draculabo
    license: NOASSERTION
    url: https://github.com/Draculabo/AntigravityManager
    path: .agents/notes/implemented/architecture/2026-08-25-files-service-seam.md
    format: markdown-frontmatter
---

# Agent Note: Files service is the only cross-module file-plane seam

Status: implemented

## Problem

Protocol controllers expanded uploaded-file handles by injecting `FileContentStore` directly. That exposed the Files module's persistence implementation to OpenAI, Anthropic, and Gemini modules, allowing those modules to couple to storage methods and durable details.

## Decision

`FilesModule` exports only `FilesService`. File-reference expansion receives `FilesService` and resolves a validated handle through `FilesService.content`. `FileContentStore` remains a private provider of the Files module.

## Alternatives considered

- Keep exporting `FileContentStore` and retain the structural reader interface. Rejected because it preserves a public storage dependency with one production implementation.
- Move reference expansion into each protocol controller. Rejected because validation, byte conversion, caching, and file-store error translation would drift across protocols.

## Consequences

Protocol controllers retain their own request and error dialects, while file retrieval follows one public Files contract. Future storage changes can remain inside Files as long as `FilesService.content` preserves its contract. A consumer needing a new capability must add it to `FilesService` rather than import the store.

## Verification

- Module integration tests prove `FilesService` is exportable and `FileContentStore` is not.
- File-reference tests cover OpenAI, Anthropic, and Gemini expansion plus invalid, expired, unavailable, and no-reference cases.
- Type checking and dependency-boundary verification cover the revised module graph.
