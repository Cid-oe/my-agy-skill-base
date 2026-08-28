# Software Engineering & AI SDK Catalog

A comprehensive, curated guide to modern Software Development Kits (SDKs) and libraries spanning LLM providers, multi-agent frameworks, media generation, frontend/backend ecosystems, and cloud databases.

---

## 1. AI & LLM Provider SDKs

### OpenAI SDK
- **Ecosystem**: Python (`openai`), TypeScript/Node.js (`openai`)
- **Key Features**: Structured Outputs via JSON Schema / Pydantic / Zod, Assistants API, Streaming Tool Calls, Realtime Voice WebSockets.
- **Best Practices**: Use typed response schemas (`response_format=MyModel`), enable automatic retry mechanisms with exponential backoff.

### Anthropic SDK
- **Ecosystem**: Python (`anthropic`), TypeScript (`@anthropic-ai/sdk`)
- **Key Features**: Extended context window (200k+), Prompt Caching (`cache_control`), Computer Use tool calls, Thinking mode (`thinking={"type": "enabled", "budget_tokens": 4096}`).
- **Best Practices**: Use system prompt caching blocks for large knowledge bases to achieve 90% cost reduction and lower latency.

### Google Gemini / GenAI SDK
- **Ecosystem**: Python (`google-genai`), TypeScript (`@google/genai`)
- **Key Features**: Multimodal inputs (audio/video/image/PDF), 1M-2M token context windows, Grounding with Google Search, Code Execution sandbox.
- **Best Practices**: Leverage native file uploads via File API for large datasets or videos instead of base64 payloads.

### OpenRouter & Multi-Provider Gateways
- **Ecosystem**: Unified OpenAI-compatible API format across 200+ models with automatic fallbacks and cost routing.

### Ollama (Local LLMs)
- **Ecosystem**: Python (`ollama`), Node.js (`ollama-js`), CLI
- **Key Features**: Fast local inference for Llama 3, DeepSeek-R1/V3, Qwen 2.5, Mistral, phi-4; zero cloud cost and local privacy.

---

## 2. Multi-Agent & Orchestration Frameworks

| Framework | Primary Language | Architecture Focus | Best Use Case |
| :--- | :--- | :--- | :--- |
| **LangGraph** | Python / TypeScript | State Machines & Directed Cyclic Graphs | Complex, cyclical agent workflows with human-in-the-loop & persistence |
| **CrewAI** | Python | Role-based autonomous collaborative agents | Multi-role delegation, team brainstorming, structured reporting |
| **DSPy** | Python | Programming (not prompting) foundation models | Compiling and auto-optimizing prompt pipelines with metric evaluators |
| **PydanticAI** | Python | Type-safe, production-first agent framework | Fast dependency injection, strict validation, native Pydantic integration |
| **Temporal / Inngest** | TypeScript / Go / Python | Durable execution & resilient background jobs | Zero-failure multi-day workflow orchestration |

---

## 3. Video & Image Generation SDKs & APIs

### Video Generation
- **Fal.ai Audio & Video APIs**: Unified endpoint for Kling, Luma Dream Machine, Runway Gen-3, Hunyuan Video, CogVideoX, Minimax Hailuo.
- **ComfyUI (Headless / API)**: Direct node graph execution via JSON payload over WebSockets with custom ControlNet and IPAdapter pipelines.
- **Remotion**: Programmatic React-based video generation with smooth transitions, timeline orchestration, and automated rendering.
- **FFmpeg & MoviePy**: High-performance CLI and Python bindings for video clipping, audio sync, encoding, and filter graphs.

### Image Generation
- **Flux.1 (Schnell / Dev / Pro)**: State-of-the-art open weights image model from Black Forest Labs via Fal.ai, Replicate, or local Diffusers.
- **SDXL & Stable Diffusion 3.5**: Deeply customizable text-to-image with ControlNet edge/pose conditioning and LoRA adapters.
- **Segment Anything (SAM 2)**: Zero-shot visual segmentation and mask extraction in image/video streams.

---

## 4. Modern Frontend & Backend Frameworks

### Frontend
- **Next.js 15 & React 19**: App Router, React Server Components (RSC), Server Actions, Turbopack.
- **SvelteKit & Svelte 5**: Runes-based fine-grained reactivity, SSR, API routes.
- **Tailwind CSS v4 & shadcn/ui**: CSS-first configuration, zero-runtime tokens, accessible Radix UI primitives.
- **Tauri 2.0**: Rust-backed lightweight desktop and mobile cross-platform runtime.

### Backend
- **Hono**: Ultrafast, web-standards-based lightweight framework running seamlessly on Node.js, Bun, Deno, and Cloudflare Workers.
- **Fastify**: High-throughput JSON schema-compiled HTTP server for Node.js.
- **NestJS**: Enterprise TypeScript framework featuring modular architecture, DI, and decorators.
- **FastAPI**: Asynchronous Python microservice framework with automatic OpenAPI docs and Pydantic validation.

---

## 5. Databases, Vector Engines & Search

- **PostgreSQL + pgvector**: Universal relational database with integrated vector similarity search.
- **ClickHouse & DuckDB**: Ultra-fast columnar OLAP engines for high-volume analytics and local analytical queries.
- **Redis & Upstash**: Sub-millisecond latency caching, rate limiting, and ephemeral state management.
- **Qdrant & Weaviate**: Purpose-built high-scale vector databases supporting hybrid dense/sparse vector search and payload filtering.
