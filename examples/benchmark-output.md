# Node Benchmark Output

Captured July 9, 2026 from the packed npm artifact:

```text
AgentShell benchmark
cases=5 evidence=preserved

git_diff raw_lines=8 raw_chars=199 compact_lines=5 compact_chars=130 shrink=34.7% evidence=preserved
pytest_failure raw_lines=3 raw_chars=147 compact_lines=2 compact_chars=170 shrink=0.0% evidence=preserved
build_log raw_lines=6 raw_chars=169 compact_lines=4 compact_chars=154 shrink=8.9% evidence=preserved
tree raw_lines=5 raw_chars=77 compact_lines=2 compact_chars=116 shrink=0.0% evidence=preserved
search raw_lines=4 raw_chars=88 compact_lines=4 compact_chars=136 shrink=0.0% evidence=preserved
```

Evidence checks fail closed: a case is marked missing if either its raw marker
or compact counterpart is absent. These small rewrite fixtures validate parity;
the larger Python launch fixtures remain the source of the published reduction
claim until the Node fixture corpus is expanded.
