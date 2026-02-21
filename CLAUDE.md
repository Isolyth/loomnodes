# Loomnodes

A visual node-based interface for exploring AI-generated text through a force-directed graph. Users write prompts at nodes and generate completions, building an interactive tree of text expansions with physics-based layout.

## Tech Stack

- **Framework**: Svelte 5 + SvelteKit 2 (using runes: `$state`, `$derived`, `$effect`)
- **Build**: Vite 7, TypeScript 5.9
- **Styling**: Tailwind CSS 4
- **Graph**: D3-Force (physics simulation), @dagrejs/dagre (hierarchical layout), @xyflow/svelte (node/edge types)
- **Testing**: Vitest + @testing-library/svelte + jsdom
- **IDs**: nanoid (12-char)

## Commands

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run test         # Run all tests (vitest run)
npm run test:watch   # Tests in watch mode
npm run check        # TypeScript + Svelte type checking
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── LoomCanvas.svelte      # Main interactive viewport (pan/zoom/physics)
│   │   │   ├── LoomNode.svelte        # Individual node card with editable text
│   │   │   └── NodeToolbar.svelte     # Generate/copy/delete action buttons
│   │   ├── settings/
│   │   │   └── SettingsPanel.svelte   # Slide-out config drawer (20+ params)
│   │   └── ui/
│   │       └── Spinner.svelte
│   ├── graph/
│   │   ├── layout.ts                  # Dagre hierarchical layout computation
│   │   └── tree.ts                    # Tree traversal utilities
│   ├── services/
│   │   └── completion.ts             # API client → /api/completions proxy
│   ├── stores/
│   │   ├── graph.svelte.ts           # Core graph state (nodes, edges, CRUD)
│   │   ├── generation.svelte.ts      # AI generation orchestration
│   │   └── settings.svelte.ts        # User settings with persistence
│   ├── types/
│   │   ├── node.ts                   # LoomNodeData interface
│   │   ├── api.ts                    # CompletionRequest/Response types
│   │   └── settings.ts              # LoomSettings + DEFAULT_SETTINGS
│   └── utils/
│       ├── id.ts                     # nanoid wrapper
│       └── persistence.ts           # localStorage save/load
├── routes/
│   ├── +page.svelte                  # Main page (stats, toolbar, canvas)
│   ├── +layout.svelte                # Root layout
│   └── api/completions/+server.ts    # Server proxy to external LLM APIs
└── tests/                            # Integration and unit tests
```

## Architecture

### State Management (Svelte 5 Runes)

Three singleton stores created via closure pattern:

- **`graphStore`** (`graph.svelte.ts`): Nodes/edges, CRUD operations, import/export. Persists to `loomnodes:graph` in localStorage. Tracks `structureVersion` counter to trigger re-layouts.
- **`generationStore`** (`generation.svelte.ts`): Manages concurrent API requests with configurable parallelism. Supports single-node and bulk "generate all leaves" modes.
- **`settingsStore`** (`settings.svelte.ts`): API config, display, and physics parameters. Persists to `loomnodes:settings`.

### Data Flow

1. User interacts with LoomNode → triggers store action
2. Store mutates state immutably (spread patterns on `$state.raw`)
3. Store persists to localStorage
4. Reactive updates re-render affected components
5. `structureVersion` changes trigger layout recomputation in LoomCanvas

### Physics Simulation

LoomCanvas runs a continuous D3-force simulation with configurable forces:
- Link force (connected nodes), charge/repulsion, collision detection, center gravity
- Positions update via `updatePositionsSilent()` (no persist on tick, only on structure changes)

### API Integration

Client (`completion.ts`) → SvelteKit server route (`/api/completions`) → External LLM API

The server route acts as a CORS proxy. Supports:
- **OpenAI-compatible** APIs (response: `choices[0].text`)
- **llama.cpp** native format (response: `content`)
- **OpenRouter** (with provider filtering)
- Any endpoint accepting Bearer token auth

### Key Data Types

**LoomNodeData**: `{ id, text, parentId, childIds[], isRoot, isGenerating, generatedTextStart }`
- `generatedTextStart`: char index where AI-generated text begins (for visual highlighting)

**LoomSettings**: API config (key, baseUrl, model, provider, temperature, topP, maxTokens, penalties), generation params (numGenerations, maxParallelRequests, maxLeafGenerations), display (nodeSize, fontSize), physics forces

## Conventions

- Stores use Svelte 5 rune-based reactivity (`$state`, `$state.raw`, `$derived`)
- Immutable state updates (spread into new arrays/objects, reassign)
- Node types from `@xyflow/svelte` (`Node<LoomNodeData>`, `Edge`)
- `$lib/` alias for `src/lib/`
- Components use `<script lang="ts">` with Svelte 5 syntax
- Tests in `src/tests/` directory and colocated `.test.ts` files in `src/lib/graph/`
