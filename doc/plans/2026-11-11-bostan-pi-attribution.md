# Bostan Runner Pi attribution continuation

Pi profile 29 binds the Runner copy of Bostan's OpenRouter attribution policy. Runner and shared policy source bytes now match. Bostan sends its product title/categories, strips caller attribution case-insensitively, and sends no HTTP-Referer because it has no public site. Authentication and routing headers survive replacement; destination matching is unchanged.

Profile 28 and all historical receipts remain untouched. Only agentProfileVersion and openRouterAttributionSourceSha256 change in the declaration. Profile 29's command digest is sha256:1d2adf6d88bde4971a009821dd68774da6067dd0ab9680816b7a2aff2f4311ef. Manifest, generated TypeScript/Rust and current installed-consumer probe agree. Recovery rejects saved profile 28 sessions under the changed execution identity without modifying the saved record. Users must reopen those sessions; no data rewrite is performed.

Local Windows validation: server attribution suite 9 PASS; Runner Pi installation/recovery suites 48 PASS, 1 SKIP and 1 FAIL. The failure is an existing test's unprivileged directory symlink creation (EPERM), before the rejection assertion; the skip is disclosed by the suite. Profile generation check and probe syntax check PASS. Offline Rust focused test did not execute because arc-swap 1.9.2 is not cached. Full typecheck/build/CI and installed native qualification remain separate gates. Independent fresh correctness/parsimony/product and security reviews found no actionable findings.

Runner TypeScript typechecks and protocol generation checks PASS. The aggregate typecheck stopped before Rust compilation because this machine's Rust 1.97.1 toolchain has no applicable rustfmt component. The missing offline dependency and rustfmt are local verification limits, not waived gates; hosted CI must run the Rust checks.

This is offline source/profile identity evidence, not a new live OpenRouter qualification. No paid provider call, new native platform support, publication or release was performed. Pi's qualified native platform set remains unchanged and does not include Windows. Related: #512.
