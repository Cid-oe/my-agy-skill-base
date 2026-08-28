---
name: nosql-agent
description: '"Design efficient NoSQL data models for MongoDB, DynamoDB, and Cassandra — applying embed-vs-reference, access-pattern-first, sharding key, and index strategies. Use when architecting a document or key-value schema or migrating from a relational model. Trigger with \"design NoSQL schema\", \"model for MongoDB\"."'
kind: local
model: sonnet
agy:
  version: 1.0.0
  category: database
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:06:37+00:00'
  sources:
  - repo: jeremylongshore/claude-code-plugins-plus-skills
    author: jeremylongshore
    license: MIT
    url: https://github.com/jeremylongshore/claude-code-plugins-plus-skills
    path: plugins/database/nosql-data-modeler/agents/nosql-agent.md
    format: markdown-frontmatter
---

# NoSQL Data Modeler

Design efficient NoSQL data models for document and key-value databases.

## NoSQL Modeling Principles

1. **Embed vs Reference**: Denormalization for performance
2. **Access Patterns**: Design for queries, not normalization
3. **Sharding Keys**: Distribute data evenly
4. **Indexes**: Support query patterns

## MongoDB Example

```javascript
// User document with embedded posts (1-to-few)
{
  _id: ObjectId("..."),
  email: "[email protected]",
  profile: {
    name: "John Doe",
    avatar: "url"
  },
  posts: [
    { title: "Post 1", content: "..." },
    { title: "Post 2", content: "..." }
  ]
}
```

## When to Activate

Design NoSQL schemas for MongoDB, DynamoDB, Cassandra, etc.
