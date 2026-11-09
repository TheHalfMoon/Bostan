/**
 * Bostan has no published npm package or release channel. The inherited
 * install/update code resolves the upstream `paperclipai` package and the
 * `paperclipai/paperclip` repository, which would install a different product
 * from upstream infrastructure. Those targets are refused; source checkouts
 * update with git, and git installs need an explicit non-upstream repository.
 */
export const UPSTREAM_DISTRIBUTION_REFUSED =
  "Bostan has no published package or release channel yet, so installing or updating from the upstream "
  + "Paperclip npm package or GitHub repository is disabled. Update a source checkout with git, or install "
  + "a specific build with --repo <owner/name> --ref <ref>.";

export class UpstreamDistributionRefusedError extends Error {
  constructor() {
    super(UPSTREAM_DISTRIBUTION_REFUSED);
    this.name = "UpstreamDistributionRefusedError";
  }
}

/** Test seam only: production callers never pass `true`, and no CLI flag reaches it. */
export type PublishedPackagePolicy = { allowPublishedPackage?: boolean };

export function assertPublishedPackageAllowed(policy: PublishedPackagePolicy = {}): void {
  if (policy.allowPublishedPackage !== true) throw new UpstreamDistributionRefusedError();
}

export function isUpstreamRepository(repo: string): boolean {
  return /^paperclipai\//i.test(repo.trim());
}

export function assertNotUpstreamRepository(repo: string): void {
  if (isUpstreamRepository(repo)) throw new UpstreamDistributionRefusedError();
}
