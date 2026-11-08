---
title: Bostan storage — development contract
summary: Local assets and remote storage integrations remain unqualified
---

**Bostan is not release-qualified.** No shared, production or customer-data storage configuration is approved.

The source contains local-disk and potential object-storage adapters for uploads, workspace files and execution artifacts. A legacy data-root identifier may persist for backward compatibility; do not rename, delete or move any existing data directory until safe migration and rollback tests are available.

Before qualifying an adapter, test path traversal prevention, tenant authorization, secret handling, encrypted storage as applicable, retention, cleanup ownership, backup/restore and crash recovery. Provider-backed object stores also require an explicit permission and billing review.

This document provides no command that writes data or enables a cloud provider. See [database qualification](/deploy/database) and [deployment overview](/deploy/overview).
