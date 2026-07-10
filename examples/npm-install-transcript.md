# npm Install Proof

Verified July 10, 2026 from the packed `@yakshith/agentshell@0.1.0` tarball in a disposable
prefix and repository:

```text
$ npm pack --pack-destination /tmp
yakshithk-agentshell-0.1.0.tgz
package size: 17.5 kB
unpacked size: 51.9 kB
total files: 27

$ npm install --prefix /tmp/aish-node-smoke /tmp/yakshithk-agentshell-0.1.0.tgz
added 1 package

$ /tmp/aish-node-smoke/node_modules/.bin/aish inspect /tmp/aish-node-repo
inspect=ok path=/tmp/aish-node-repo
project: project=unknown files=0 dirs=0 important=-
git: branch=master changed=0 staged=0 unstaged=0 untracked=0
rules: agent_rules=missing present=0 missing=3
next: aish init
```

Both packaged binaries are present: `aish` and `agentshell`.
