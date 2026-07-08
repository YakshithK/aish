# AgentShell Before/After Demo

Use this flow for the 45-60 second launch demo.

```bash
# 0. Adoption setup: teach agents in this repo to prefer AgentShell.
aish init
aish doctor

# 1. Agent-native repo inspection workflow.
aish inspect

# 2. Human-oriented project map can be noisy.
find . -maxdepth 3 -type f

# Agent-oriented map.
aish tree

# 3. Raw file dumps can destroy context.
cat src/agentshell/commands/view.py

# AgentShell shows exact line numbers for short files and outlines for long files.
aish view src/agentshell/commands/view.py

# 4. Search summary instead of every matching line.
rg "CommandResult" src tests
aish search CommandResult

# 5. Git status without prose.
git status
aish status

# 6. Test output summarized for the next decision.
python -m pytest
aish test -- python -m pytest
```

End the recording with:

```text
Built for AI agents: compact context, progressive disclosure.
```
