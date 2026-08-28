# Ordered Developer Capability & Skill Pipeline

This pipeline specifies the exact 15-stage workflow order with corresponding installed active skills from `~/.agents/skills/`.

## 1. Repository Indexer

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `analyze-project` | Forensic root cause analyzer for Antigravity sessions. Classifies scope deltas, rework patterns, root causes, hotspots,  | [`analyze-project/SKILL.md`](file:///home/cid/.agents/skills/analyze-project/SKILL.md) |
| `codebase-design` | Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find de | [`codebase-design/SKILL.md`](file:///home/cid/.agents/skills/codebase-design/SKILL.md) |
| `codebase-audit-pre-push` | "Deep audit before GitHub push: removes junk files, dead code, security holes, and optimization issues. Checks every fil | [`codebase-audit-pre-push/SKILL.md`](file:///home/cid/.agents/skills/codebase-audit-pre-push/SKILL.md) |
| `vexor-cli` | Semantic file discovery via `vexor`. Use whenever locating where something is implemented/loaded/defined in a medium or  | [`vexor-cli/SKILL.md`](file:///home/cid/.agents/skills/vexor-cli/SKILL.md) |
| `filesystem-context` | Use for file-based context management, dynamic context discovery, and reducing context window bloat. Offload context to  | [`filesystem-context/SKILL.md`](file:///home/cid/.agents/skills/filesystem-context/SKILL.md) |

---

## 2. AST Editor

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `code-refactoring-refactor-clean` | "You are a code refactoring expert specializing in clean code principles, SOLID design patterns, and modern software eng | [`code-refactoring-refactor-clean/SKILL.md`](file:///home/cid/.agents/skills/code-refactoring-refactor-clean/SKILL.md) |
| `code-refactoring-tech-debt` | "You are a technical debt expert specializing in identifying, quantifying, and prioritizing technical debt in software p | [`code-refactoring-tech-debt/SKILL.md`](file:///home/cid/.agents/skills/code-refactoring-tech-debt/SKILL.md) |
| `simplify-code` | "Review a diff for clarity and safe simplifications, then optionally apply low-risk fixes." | [`simplify-code/SKILL.md`](file:///home/cid/.agents/skills/simplify-code/SKILL.md) |
| `re-create` | "Completely delete and rewrite a file or module from scratch when structural rot makes patching impossible." | [`re-create/SKILL.md`](file:///home/cid/.agents/skills/re-create/SKILL.md) |
| `code-polish` | Rewrites unprofessional code comments into clear ones and performs non-semantic cleanup. Use to professionalize code wit | [`code-polish/SKILL.md`](file:///home/cid/.agents/skills/code-polish/SKILL.md) |
| `logic-fix-all` | 'Autonomous repository-wide audit-and-fix pipeline: health → review → locate/explain → fix → diff-verify → iterate until | [`logic-fix-all/SKILL.md`](file:///home/cid/.agents/skills/logic-fix-all/SKILL.md) |

---

## 3. Incremental Context Memory

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `agent-memory` | A hybrid memory system that provides persistent, searchable knowledge management for AI agents. | [`agent-memory/SKILL.md`](file:///home/cid/.agents/skills/agent-memory/SKILL.md) |
| `agent-memory-mcp` | "A hybrid memory system that provides persistent, searchable knowledge management for AI agents (Architecture, Patterns, | [`agent-memory-mcp/SKILL.md`](file:///home/cid/.agents/skills/agent-memory-mcp/SKILL.md) |
| `conversation-memory` | Persistent memory systems for LLM conversations including | [`conversation-memory/SKILL.md`](file:///home/cid/.agents/skills/conversation-memory/SKILL.md) |
| `context-manager` | Elite AI context engineering specialist mastering dynamic context management, vector databases, knowledge graphs, and in | [`context-manager/SKILL.md`](file:///home/cid/.agents/skills/context-manager/SKILL.md) |
| `context-guardian` | Guardiao de contexto que preserva dados criticos antes da compactacao automatica. Snapshots, verificacao de integridade  | [`context-guardian/SKILL.md`](file:///home/cid/.agents/skills/context-guardian/SKILL.md) |
| `hierarchical-agent-memory` | "Scoped CLAUDE.md memory system that reduces context token spend. Creates directory-level context files, tracks savings  | [`hierarchical-agent-memory/SKILL.md`](file:///home/cid/.agents/skills/hierarchical-agent-memory/SKILL.md) |

---

## 4. Architecture Auditor

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `architect-review` | "Master software architect specializing in modern architecture" | [`architect-review/SKILL.md`](file:///home/cid/.agents/skills/architect-review/SKILL.md) |
| `senior-architect` | "Complete toolkit for senior architect with modern tools and best practices." | [`senior-architect/SKILL.md`](file:///home/cid/.agents/skills/senior-architect/SKILL.md) |
| `architecture-patterns` | "Master proven backend architecture patterns including Clean Architecture, Hexagonal Architecture, and Domain-Driven Des | [`architecture-patterns/SKILL.md`](file:///home/cid/.agents/skills/architecture-patterns/SKILL.md) |
| `c4-architecture-c4-architecture` | "Generate comprehensive C4 architecture documentation for an existing repository/codebase using a bottom-up analysis app | [`c4-architecture-c4-architecture/SKILL.md`](file:///home/cid/.agents/skills/c4-architecture-c4-architecture/SKILL.md) |
| `ddd-strategic-design` | "Design DDD strategic artifacts including subdomains, bounded contexts, and ubiquitous language for complex business dom | [`ddd-strategic-design/SKILL.md`](file:///home/cid/.agents/skills/ddd-strategic-design/SKILL.md) |
| `cqrs-implementation` | "Implement Command Query Responsibility Segregation for scalable architectures. Use when separating read and write model | [`cqrs-implementation/SKILL.md`](file:///home/cid/.agents/skills/cqrs-implementation/SKILL.md) |

---

## 5. Multi-step Autonomous Planner

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `concise-planning` | "Use when a user asks for a plan for a coding task, to generate a clear, actionable, and atomic checklist." | [`concise-planning/SKILL.md`](file:///home/cid/.agents/skills/concise-planning/SKILL.md) |
| `writing-plans` | "Use when you have a spec or requirements for a multi-step task, before touching code" | [`writing-plans/SKILL.md`](file:///home/cid/.agents/skills/writing-plans/SKILL.md) |
| `executing-plans` | "Use when you have a written implementation plan to execute in a separate session with review checkpoints" | [`executing-plans/SKILL.md`](file:///home/cid/.agents/skills/executing-plans/SKILL.md) |
| `subagent-driven-development` | "Use when executing implementation plans with independent tasks in the current session" | [`subagent-driven-development/SKILL.md`](file:///home/cid/.agents/skills/subagent-driven-development/SKILL.md) |
| `subagent-orchestrator` | Coordinate quota-aware parallel subagents for large, multi-file Antigravity tasks. | [`subagent-orchestrator/SKILL.md`](file:///home/cid/.agents/skills/subagent-orchestrator/SKILL.md) |
| `goal-loop` | "Draft and explain persistent goal-loop prompts for long-running agent work with clear stop conditions." | [`goal-loop/SKILL.md`](file:///home/cid/.agents/skills/goal-loop/SKILL.md) |

---

## 6. Test Generator

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `tdd-workflow` | "Test-Driven Development workflow principles. RED-GREEN-REFACTOR cycle." | [`tdd-workflow/SKILL.md`](file:///home/cid/.agents/skills/tdd-workflow/SKILL.md) |
| `tdd-workflows-tdd-red` | "Generate failing tests for the TDD red phase to define expected behavior and edge cases." | [`tdd-workflows-tdd-red/SKILL.md`](file:///home/cid/.agents/skills/tdd-workflows-tdd-red/SKILL.md) |
| `tdd-workflows-tdd-green` | "Implement the minimal code needed to make failing tests pass in the TDD green phase." | [`tdd-workflows-tdd-green/SKILL.md`](file:///home/cid/.agents/skills/tdd-workflows-tdd-green/SKILL.md) |
| `test-driven-development` | "Use when implementing any feature or bugfix, before writing implementation code" | [`test-driven-development/SKILL.md`](file:///home/cid/.agents/skills/test-driven-development/SKILL.md) |
| `unit-testing-test-generate` | "Generate comprehensive, maintainable unit tests across languages with strong coverage and edge case focus." | [`unit-testing-test-generate/SKILL.md`](file:///home/cid/.agents/skills/unit-testing-test-generate/SKILL.md) |
| `test-guard` | "Review generated or changed test code against universal testing rules before it ships or is presented for approval." | [`test-guard/SKILL.md`](file:///home/cid/.agents/skills/test-guard/SKILL.md) |
| `vitest-skill` | 'Generates Vitest tests in JavaScript/TypeScript with Vite-native speed. Jest-compatible API with ESM support and HMR. U | [`vitest-skill/SKILL.md`](file:///home/cid/.agents/skills/vitest-skill/SKILL.md) |
| `playwright-skill` | "IMPORTANT - Path Resolution: This skill can be installed in different locations (plugin system, manual installation, gl | [`playwright-skill/SKILL.md`](file:///home/cid/.agents/skills/playwright-skill/SKILL.md) |

---

## 7. GitHub PR Reviewer

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `git-pr-review` | Generate a concise and structured PR description from commit history with minimal token usage | [`git-pr-review/SKILL.md`](file:///home/cid/.agents/skills/git-pr-review/SKILL.md) |
| `pr-writer` | "Create pull requests following Sentry's engineering practices." | [`pr-writer/SKILL.md`](file:///home/cid/.agents/skills/pr-writer/SKILL.md) |
| `code-reviewer` | "Elite code review expert specializing in modern AI-powered code" | [`code-reviewer/SKILL.md`](file:///home/cid/.agents/skills/code-reviewer/SKILL.md) |
| `differential-review` | "Security-focused code review for PRs, commits, and diffs." | [`differential-review/SKILL.md`](file:///home/cid/.agents/skills/differential-review/SKILL.md) |
| `review-and-simplify-changes` | Review a git diff or explicit file scope for reuse, code quality, efficiency, clarity, and standards issues, then option | [`review-and-simplify-changes/SKILL.md`](file:///home/cid/.agents/skills/review-and-simplify-changes/SKILL.md) |
| `fix-review` | "Verify fix commits address audit findings without new bugs" | [`fix-review/SKILL.md`](file:///home/cid/.agents/skills/fix-review/SKILL.md) |

---

## 8. Performance Profiler

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `performance-engineer` | "Expert performance engineer specializing in modern observability," | [`performance-engineer/SKILL.md`](file:///home/cid/.agents/skills/performance-engineer/SKILL.md) |
| `performance-profiling` | "Performance profiling principles. Measurement, analysis, and optimization techniques." | [`performance-profiling/SKILL.md`](file:///home/cid/.agents/skills/performance-profiling/SKILL.md) |
| `react-component-performance` | Diagnose slow React components and suggest targeted performance fixes. | [`react-component-performance/SKILL.md`](file:///home/cid/.agents/skills/react-component-performance/SKILL.md) |
| `k6-load-testing` | "Comprehensive k6 load testing skill for API, browser, and scalability testing. Write realistic load scenarios, analyze  | [`k6-load-testing/SKILL.md`](file:///home/cid/.agents/skills/k6-load-testing/SKILL.md) |

---

## 9. Security Auditor

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `security-auditor` | Expert security auditor specializing in DevSecOps, comprehensive cybersecurity, and compliance frameworks. | [`security-auditor/SKILL.md`](file:///home/cid/.agents/skills/security-auditor/SKILL.md) |
| `api-security-testing` | "API security testing workflow for REST and GraphQL APIs covering authentication, authorization, rate limiting, input va | [`api-security-testing/SKILL.md`](file:///home/cid/.agents/skills/api-security-testing/SKILL.md) |
| `solidity-security` | "Master smart contract security best practices, vulnerability prevention, and secure Solidity development patterns." | [`solidity-security/SKILL.md`](file:///home/cid/.agents/skills/solidity-security/SKILL.md) |
| `semgrep-rule-creator` | Creates custom Semgrep rules for detecting security vulnerabilities, bug patterns, and code patterns. Use when writing S | [`semgrep-rule-creator/SKILL.md`](file:///home/cid/.agents/skills/semgrep-rule-creator/SKILL.md) |
| `sast-configuration` | "Static Application Security Testing (SAST) tool setup, configuration, and custom rule creation for comprehensive securi | [`sast-configuration/SKILL.md`](file:///home/cid/.agents/skills/sast-configuration/SKILL.md) |
| `vulnerability-scanner` | "Advanced vulnerability analysis principles. OWASP 2025, Supply Chain Security, attack surface mapping, risk prioritizat | [`vulnerability-scanner/SKILL.md`](file:///home/cid/.agents/skills/vulnerability-scanner/SKILL.md) |

---

## 10. Documentation Generator

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `documentation` | "Documentation generation workflow covering API docs, architecture docs, README files, code comments, and technical writ | [`documentation/SKILL.md`](file:///home/cid/.agents/skills/documentation/SKILL.md) |
| `api-documentation-generator` | "Generate comprehensive, developer-friendly API documentation from code, including endpoints, parameters, examples, and  | [`api-documentation-generator/SKILL.md`](file:///home/cid/.agents/skills/api-documentation-generator/SKILL.md) |
| `docs-architect` | Creates comprehensive technical documentation from existing codebases. Analyzes architecture, design patterns, and imple | [`docs-architect/SKILL.md`](file:///home/cid/.agents/skills/docs-architect/SKILL.md) |
| `brain-to-docs` | "Interview the user to turn project vision and decisions into README and ADR documentation." | [`brain-to-docs/SKILL.md`](file:///home/cid/.agents/skills/brain-to-docs/SKILL.md) |
| `wiki-architect` | "You are a documentation architect that produces structured wiki catalogues and onboarding guides from codebases." | [`wiki-architect/SKILL.md`](file:///home/cid/.agents/skills/wiki-architect/SKILL.md) |
| `readme` | "You are an expert technical writer creating comprehensive project documentation. Your goal is to write a README.md that | [`readme/SKILL.md`](file:///home/cid/.agents/skills/readme/SKILL.md) |

---

## 11. MCP Orchestrator

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `agent-squad` | Main agent orchestrator that coordinates a specialized squad of agents | [`agent-squad/SKILL.md`](file:///home/cid/.agents/skills/agent-squad/SKILL.md) |
| `dispatch` | "Delegate tasks to OpenAI Codex CLI and Google Antigravity CLI from Claude Code with topic-aware sessions" | [`dispatch/SKILL.md`](file:///home/cid/.agents/skills/dispatch/SKILL.md) |
| `aws-mcp-setup` | Configure AWS MCP servers for documentation search and API access. Use when setting up AWS MCP, configuring AWS document | [`aws-mcp-setup/SKILL.md`](file:///home/cid/.agents/skills/aws-mcp-setup/SKILL.md) |
| `using-n8n-mcp-skills` | Route n8n MCP workflow design, editing, validation, testing, deployment, credential, execution, and debugging tasks to s | [`using-n8n-mcp-skills/SKILL.md`](file:///home/cid/.agents/skills/using-n8n-mcp-skills/SKILL.md) |
| `agent-tool-builder` | Tools are how AI agents interact with the world. A well-designed | [`agent-tool-builder/SKILL.md`](file:///home/cid/.agents/skills/agent-tool-builder/SKILL.md) |
| `mcp-builder` | "Create MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed t | [`mcp-builder/SKILL.md`](file:///home/cid/.agents/skills/mcp-builder/SKILL.md) |

---

## 12. Token Optimizer

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `zipai-optimizer` | "Ultra-dense token optimizer skill for prompt caching, log pruning, AST-based inspection, and minified JSON payloads." | [`zipai-optimizer/SKILL.md`](file:///home/cid/.agents/skills/zipai-optimizer/SKILL.md) |
| `context-window-management` | Strategies for managing LLM context windows including | [`context-window-management/SKILL.md`](file:///home/cid/.agents/skills/context-window-management/SKILL.md) |
| `geminiignore-finops` | "Configure and optimize .geminiignore files for AI context window efficiency and token cost reduction (FinOps)." | [`geminiignore-finops/SKILL.md`](file:///home/cid/.agents/skills/geminiignore-finops/SKILL.md) |
| `recursive-context-pruning-token-budgeting` | "Optimizes AI agent performance by pruning redundant context, managing token usage, and enforcing ultra-concise, direct- | [`recursive-context-pruning-token-budgeting/SKILL.md`](file:///home/cid/.agents/skills/recursive-context-pruning-token-budgeting/SKILL.md) |
| `tokenwise` | "Measurement-driven model router for Claude Code. Routes Haiku/Sonnet/Opus per task class, logs every routed task with r | [`tokenwise/SKILL.md`](file:///home/cid/.agents/skills/tokenwise/SKILL.md) |

---

## 13. Video Prompt Builder

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `remotion` | Generate walkthrough videos from Stitch projects using Remotion with smooth transitions, zooming, and text overlays | [`remotion/SKILL.md`](file:///home/cid/.agents/skills/remotion/SKILL.md) |
| `fal-generate` | "Generate images and videos using fal.ai AI models" | [`fal-generate/SKILL.md`](file:///home/cid/.agents/skills/fal-generate/SKILL.md) |
| `fal-workflow` | "Generate workflow JSON files for chaining AI models" | [`fal-workflow/SKILL.md`](file:///home/cid/.agents/skills/fal-workflow/SKILL.md) |
| `video-content-extractor` | "Extract key frames from MP4 videos at configurable intervals, run Tesseract OCR, and generate structured Markdown repor | [`video-content-extractor/SKILL.md`](file:///home/cid/.agents/skills/video-content-extractor/SKILL.md) |
| `seek-and-analyze-video` | "Seek and analyze video content using Memories.ai Large Visual Memory Model for persistent video intelligence" | [`seek-and-analyze-video/SKILL.md`](file:///home/cid/.agents/skills/seek-and-analyze-video/SKILL.md) |
| `remotion-best-practices` | "Best practices for Remotion - Video creation in React" | [`remotion-best-practices/SKILL.md`](file:///home/cid/.agents/skills/remotion-best-practices/SKILL.md) |

---

## 14. SDK Expert Router

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `agent-framework-azure-ai-py` | "Build persistent agents on Azure AI Foundry using the Microsoft Agent Framework Python SDK." | [`agent-framework-azure-ai-py/SKILL.md`](file:///home/cid/.agents/skills/agent-framework-azure-ai-py/SKILL.md) |
| `azure-ai-projects-py` | "Build AI applications on Microsoft Foundry using the azure-ai-projects SDK." | [`azure-ai-projects-py/SKILL.md`](file:///home/cid/.agents/skills/azure-ai-projects-py/SKILL.md) |
| `azure-ai-projects-ts` | "High-level SDK for Azure AI Foundry projects with agents, connections, deployments, and evaluations." | [`azure-ai-projects-ts/SKILL.md`](file:///home/cid/.agents/skills/azure-ai-projects-ts/SKILL.md) |
| `pydantic-models-py` | "Create Pydantic models following the multi-model pattern for clean API contracts." | [`pydantic-models-py/SKILL.md`](file:///home/cid/.agents/skills/pydantic-models-py/SKILL.md) |
| `crewai` | Expert in CrewAI - the leading role-based multi-agent framework | [`crewai/SKILL.md`](file:///home/cid/.agents/skills/crewai/SKILL.md) |
| `langgraph` | Expert in LangGraph - the production-grade framework for building | [`langgraph/SKILL.md`](file:///home/cid/.agents/skills/langgraph/SKILL.md) |
| `fastapi-pro` | Build high-performance async APIs with FastAPI, SQLAlchemy 2.0, and Pydantic V2. Master microservices, WebSockets, and m | [`fastapi-pro/SKILL.md`](file:///home/cid/.agents/skills/fastapi-pro/SKILL.md) |

---

## 15. Release Automation

| Skill Identifier | Description | Path |
| :--- | :--- | :--- |
| `app-store-changelog` | Generate user-facing App Store release notes from git history since the last tag. | [`app-store-changelog/SKILL.md`](file:///home/cid/.agents/skills/app-store-changelog/SKILL.md) |
| `changelog-automation` | "Automate changelog generation from commits, PRs, and releases following Keep a Changelog format. Use when setting up re | [`changelog-automation/SKILL.md`](file:///home/cid/.agents/skills/changelog-automation/SKILL.md) |
| `gitops-workflow` | "Complete guide to implementing GitOps workflows with ArgoCD and Flux for automated Kubernetes deployments." | [`gitops-workflow/SKILL.md`](file:///home/cid/.agents/skills/gitops-workflow/SKILL.md) |
| `github-actions-templates` | "Production-ready GitHub Actions workflow patterns for testing, building, and deploying applications." | [`github-actions-templates/SKILL.md`](file:///home/cid/.agents/skills/github-actions-templates/SKILL.md) |
| `gitlab-ci-patterns` | "Comprehensive GitLab CI/CD pipeline patterns for automated testing, building, and deployment." | [`gitlab-ci-patterns/SKILL.md`](file:///home/cid/.agents/skills/gitlab-ci-patterns/SKILL.md) |
| `antigravity-maintainer-batch-release` | "Run protected AAS maintainer sweeps, PR merge batches, canonical sync, Core preview checks, and scripted releases. Use  | [`antigravity-maintainer-batch-release/SKILL.md`](file:///home/cid/.agents/skills/antigravity-maintainer-batch-release/SKILL.md) |

---

