# Publishing

Release checklist for maintainers.

## 1. Pre-flight

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
npm pack --dry-run   # inspect the tarball contents
```

The package ships only `dist/` + `README.md` + `LICENSE` + `CHANGELOG.md`. The
CLI entry (`dist/index.js`) carries a `#!/usr/bin/env node` shebang added by
tsup, so `npx practice-fusion-mcp` works.

## 2. Bump the version

Update `version` in `package.json` and `server.json`, and add a `CHANGELOG.md`
entry. The startup banner and `McpServer` version read from `package.json` at
runtime, so there is nothing to bump in `src/`.

## 3. Publish to npm

Publishing runs automatically. The [`Publish`](.github/workflows/publish.yml)
workflow fires on a published GitHub release (step 4) and runs
`npm publish --provenance`. It needs one repository secret, `NPM_TOKEN` — an npm
**automation** token from npmjs.com → Access Tokens.

To publish by hand instead:

```bash
npm login          # once, as the package owner
npm publish        # runs prepublishOnly (pnpm build) automatically
```

## 4. Tag a GitHub release

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file - < <changelog excerpt>
```

## 5. Publish to the MCP Registry (optional, after npm)

The registry validates ownership two ways: the npm package must contain
`"mcpName": "io.github.kushaim/practice-fusion-mcp"` in its `package.json` (it
does), and you authenticate to the registry via GitHub.

```bash
# install the publisher CLI (see https://github.com/modelcontextprotocol/registry)
mcp-publisher login github
mcp-publisher publish   # reads ./server.json
```

Keep `server.json`'s `version` and the npm package `version` in sync.
