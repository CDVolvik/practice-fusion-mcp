# 2. Authenticate with SMART backend-services

Status: accepted

## Context

The server runs without a user present, so it needs machine-to-machine access to
the FHIR API. The options were a static API key, an OAuth client-credentials grant
with a shared secret, or the SMART **backend-services** profile, which exchanges a
short-lived, asymmetrically-signed JWT assertion for a short-lived access token.

## Decision

Use SMART backend-services. On each token request the server signs a JWT assertion
with a locally-held private key (via `jose`), posts it to the token endpoint, and
caches the returned access token until shortly before it expires.

## Consequences

- No long-lived shared secret ever crosses the wire; only a signed assertion and a
  short-lived bearer token do.
- The signing key lives with the deployer and rotates independently of the server.
  It is passed in as configuration and never logged.
- It is the profile Practice Fusion's Open FHIR program expects, so there is no
  bespoke auth to maintain.
- The cost is a registration step (the app's public key must be registered with
  Practice Fusion) and the JWT-signing machinery, which is isolated in
  `auth/backend-auth.ts`.
