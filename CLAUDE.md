## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- Nesta máquina o comando `graphify` NÃO está no PATH: use `"C:/Users/godra/AppData/Local/Programs/Python/Python312/python.exe" -m graphify <subcomando>` (o mesmo interpretador de `graphify-out/.graphify_python`).
- O grafo se reconstrói sozinho a cada `git commit` (gancho `post-commit` instalado por `graphify hook install`) — só código, por AST, sem custo de tokens.
