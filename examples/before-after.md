# AgentShell Before/After Demo

Use this flow for the 45-60 second launch demo.

```bash
# 0. Adoption setup: teach agents in this repo to prefer AgentShell.
aish init
aish doctor

# 1. Human-oriented project map can be noisy.
find . -maxdepth 3 -type f

# Agent-oriented map.
aish tree

# 2. Raw file dumps can destroy context.
cat src/agentshell/commands/view.py

# AgentShell shows exact line numbers for short files and outlines for long files.
aish view src/agentshell/commands/view.py

# 3. Search summary instead of every matching line.
rg "CommandResult" src tests
aish search CommandResult

# 4. Git status without prose.
git status
aish status

# 5. Test output summarized for the next decision.
python -m pytest
aish test -- python -m pytest
```

End the recording with:

```text
Built for AI agents: compact context, progressive disclosure.
```
