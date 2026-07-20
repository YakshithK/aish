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
cat src/commands/view.js

# AgentShell shows exact line numbers for short files and outlines for long files.
aish view src/commands/view.js

# 4. Search summary instead of every matching line.
rg "requireFile" src test
aish search requireFile

# 5. Git status without prose.
git status
aish status

# 6. Diff summary before patch detail.
git diff
aish diff
aish diff src/commands/view.js

# 7. Test output summarized for the next decision.
node --test
aish test -- node --test

# 8. Build/install logs summarized for root cause.
npm install
aish build -- npm install
```

End the recording with:

```text
Built for AI agents: compact context, progressive disclosure.
```
