/**
 * Bostan's private CLI preview intentionally does not implement
 * auth bootstrap-ceo or execute any third-party npx package.
 * Do not advertise a legacy donor executable as a supported setup path.
 */
export const BOSTAN_BOOTSTRAP_PREVIEW_NOTICE =
  "The Bostan CLI preview does not provide a first-admin bootstrap command. Ask the instance operator to use the supported local setup process.";
