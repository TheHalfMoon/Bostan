---
title: Environment configuration boundaries (private preview)
summary: No public runtime or credential setup is qualified
---

# Environment configuration boundaries

Bostan is **not release-qualified**. This private engineering note is not an executable deployment or environment configuration guide.

**Do not enter API keys, credentials, or tokens. No paid providers or services.** No production secrets, real customer data, hosted models, public ingress, remote runner endpoints, or shared network bindings are authorized.

Source compatibility names including PAPERCLIP_HOME, PAPERCLIP_BIND, PAPERCLIP_API_URL, PAPERCLIP_API_KEY, DATABASE_URL, ANTHROPIC_API_KEY and OPENAI_API_KEY are inherited internal details, not approved Bostan environment settings or evidence of safe operation. Do not treat them as a deployment recipe.

Qualification still requires full source-native tests, genuine Linux rootless Bubblewrap isolation, Windows PostgreSQL teardown and repeated stress, installed macOS/Windows/Linux verification, explicit agent-effect consent, filesystem/network containment, privacy redaction, and third-party LICENSE/NOTICE/provenance. No runnable commands are provided. Release **NO-GO**.
