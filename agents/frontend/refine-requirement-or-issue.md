---
name: refine-requirement-or-issue
description: '''Refine the requirement or issue with Acceptance Criteria, Technical Considerations, Edge Cases, and NFRs'''
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
  tags:
  - '''Refine Requirement or Issue'''
  compatibility:
    status: needs-tool-mapping
    score: 75
    notes: 'Unmapped tools: [, ''list_issues'', ''githubRepo'', ''search'', ''add_issue_comment'', ''create_issue'', ''create_issue_comment'', ''update_issue'', ''delete_issue'', ''get_issue'', ''search_issues''].'
  validation: passed
  imported: '2026-08-26T08:58:35+00:00'
  sources:
  - repo: github/awesome-copilot
    author: github
    license: MIT
    url: https://github.com/github/awesome-copilot
    path: agents/refine-issue.agent.md
    format: markdown-frontmatter
---

# Refine Requirement or Issue Chat Mode

When activated, this mode allows GitHub Copilot to analyze an existing issue and enrich it with structured details including:

- Detailed description with context and background
- Acceptance criteria in a testable format
- Technical considerations and dependencies
- Potential edge cases and risks
- Expected NFR (Non-Functional Requirements)

## Steps to Run
1. Read the issue description and understand the context.
2. Modify the issue description to include more details.
3. Add acceptance criteria in a testable format.
4. Include technical considerations and dependencies.
5. Add potential edge cases and risks.
6. Provide suggestions for effort estimation.
7. Review the refined requirement and make any necessary adjustments.

## Usage

To activate Requirement Refinement mode:

1. Refer an existing issue in your prompt as `refine <issue_URL>`
2. Use the mode: `refine-issue`

## Output

Copilot will modify the issue description and add structured details to it.
