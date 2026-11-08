---
title: Bostan database — migration and reliability review
summary: PostgreSQL-backed state requires native stress and recovery qualification
---

**Bostan is not release-qualified.** The data layer is not approved for customer or persistent production records.

## Current design

The repository includes embedded PostgreSQL development paths and external PostgreSQL configuration. Different source generations may retain inherited database names, environment keys or data directories for compatibility. Treat these as internal implementation details, not an instruction to connect a donor database or apply migrations to an existing instance.

## Required database evidence

- Repeated Windows embedded PostgreSQL startup, shutdown and forced-crash recovery with no orphan processes (open engineering issue #234).
- Schema migration/rollback on fresh and existing **synthetic-only** databases.
- Tenant isolation, backup/restore integrity and secret-redacted logs.
- Bound resource usage, file ownership and clean termination on Windows, macOS and Linux.

Do not run direct schema-push commands, containerized databases, destructive migrations or real backups based on unverified historical tutorials. Review [source-development preview](/start/quickstart) and [storage planning](/deploy/storage).
