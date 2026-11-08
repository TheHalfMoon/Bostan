---
title: What is Bostan?
summary: A governed control plane for autonomous teams and AI agents
---

**Bostan** is an open development project for coordinating people and AI agents through company goals, assigned work, approvals, budgets, and auditable results.

The project combines a React interface, a Node.js API, PostgreSQL-backed state, and adapters connecting supported agent runtimes. Its goal is to make autonomous work observable and subject to human policy and authorization.

> **Development status:** Source code exists, but Bostan is not yet a qualified, installable product. Supported platforms, agent permissions, privacy, networking and deployment behavior require further verification. The repository is private and there is no public release.

## What Bostan is designed to do

- **Organize work:** Track goals, projects, agents, roles and assigned tasks.
- **Make autonomy governable:** Provide approval gates, budgets and an activity history.
- **Connect runtimes:** Coordinate agents that execute through adapters rather than hiding their actions.
- **Review outcomes:** Connect work records with decisions, costs and human oversight.

These are the intended capabilities and architectural building blocks, **not a claim that every integration has passed qualification**.

## Control plane and execution

The **control plane** owns company structures, task state, approvals and visibility. Execution happens through separately governed adapters for local processes and supported agent providers.

Security and approval boundaries must hold across both layers. Real customer data, paid providers, external side effects and public deployment are outside the current qualification scope.

## Read more

See the [development quickstart](/start/quickstart), [core concepts](/start/core-concepts), and [architecture](/start/architecture). Development status and release blockers are tracked in the private repository.
