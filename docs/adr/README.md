# Architecture decisions

Short records of the decisions that shaped this server, in the format popularised
by Michael Nygard. Each captures the context, the decision, and the trade-offs
accepted — so the reasoning survives past the commit that made it.

| #                                           | Decision                                       |
| ------------------------------------------- | ---------------------------------------------- |
| [0001](0001-read-only-fhir.md)              | Build on the free Open FHIR API, read-only     |
| [0002](0002-smart-backend-services-auth.md) | Authenticate with SMART backend-services       |
| [0003](0003-demo-fixtures.md)               | Ship a credential-free demo mode over fixtures |
| [0004](0004-shaped-summaries.md)            | Return shaped summaries, not raw FHIR          |
