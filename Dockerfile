# Dockerfile — boots practice-fusion-mcp so MCP clients, registries, and Glama
# can introspect it (initialize + tools/list) without live Practice Fusion access.
#
# The PF_* values baked below are NON-FUNCTIONAL placeholders. They exist only to
# satisfy startup config validation so the stdio server can start and answer
# tools/list. They are NOT credentials and grant no access. For real use, override
# every PF_* variable at runtime, e.g.:
#   docker run -i --rm \
#     -e PF_CLIENT_ID=your-client-id \
#     -e PF_PRIVATE_KEY="$(cat pf-private.pem)" \
#     -e PF_FHIR_BASE_URL=https://fhir.practicefusion.com/r4 \
#     -e PF_TOKEN_URL=https://auth.practicefusion.com/token \
#     practice-fusion-mcp
FROM node:22-slim

WORKDIR /app

# Repo ships a pnpm v9 lockfile.
RUN npm install -g pnpm@9

# Install against the frozen lockfile first for better layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build TypeScript -> dist/ (needs devDependencies from the step above).
COPY . .
RUN pnpm build

# Placeholder config so the server boots for introspection. Override in production.
ENV PF_FHIR_BASE_URL="https://fhir.practicefusion.com/r4" \
    PF_TOKEN_URL="https://auth.practicefusion.com/token" \
    PF_CLIENT_ID="introspection-placeholder" \
    PF_PRIVATE_KEY="introspection-placeholder" \
    PF_SCOPES="system/*.read"

# MCP servers communicate over stdio (JSON-RPC).
ENTRYPOINT ["node", "dist/index.js"]
