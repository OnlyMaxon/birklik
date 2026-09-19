## Architecture

Read Architecture.md before making structural changes or answering design questions. It is the source of truth for design decisions and conventions. The graph shows what the code does; Architecture.md explains why. If they conflict, flag it instead of silently following either.

The filename is `Architecture.md` — that exact casing. Windows hides the difference (`core.ignorecase = true`), but on Linux and in CI a reference to `ARCHITECTURE.md` resolves to nothing.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

`graphify-out/` is **not** in git — it holds absolute machine paths and ~6 MB of regenerated output. A fresh clone has no graph. Build it with the `/graphify` skill; until it exists, the rules below do not apply and normal search tools are correct.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).