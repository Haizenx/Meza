---
description: Executes a multi-agent team sprint. You act as the Reviewer while the agents work in parallel.
---

# Workflow: startcycle

1. **Planning (Architect)**:
   - The `@architect` analyzes the user input and generates the system design and implementation steps.
   - The `@architect` automatically passes the plan to `@developer`.

2. **Implementation (Developer)**:
   - `@developer` reads the specification and writes/updates the required files.
   - `@developer` passes the completed code to `@qa`.

3. **Validation (QA)**:
   - `@qa` executes tests and audits the changes.
   - If tests pass, `@qa` completes the cycle. If they fail, `@qa` refers the logs back to `@developer`.