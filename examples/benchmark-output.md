# Node Benchmark Output

Captured July 9, 2026 from the packed npm artifact:

```text
AgentShell benchmark
cases=5 evidence=preserved

git_diff raw_lines=42 raw_chars=1258 compact_lines=10 compact_chars=287 shrink=77.2% evidence=preserved
pytest_failure raw_lines=22 raw_chars=871 compact_lines=4 compact_chars=234 shrink=73.1% evidence=preserved
build_log raw_lines=19 raw_chars=683 compact_lines=7 compact_chars=269 shrink=60.6% evidence=preserved
tree raw_lines=20 raw_chars=327 compact_lines=5 compact_chars=201 shrink=38.5% evidence=preserved
search raw_lines=7 raw_chars=212 compact_lines=5 compact_chars=146 shrink=31.1% evidence=preserved
```

Evidence checks fail closed: a case is marked missing if either its raw marker
or compact counterpart is absent. The Node benchmark now uses the same complete
fixtures, summaries, metrics, and evidence markers as the Python implementation.
