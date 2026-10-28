/**
 * Private Bostan native Windows QA directory-name admission.
 * Enforce exactly one three-digit wave for the checkout AND its TEMP.
 * This covers B086, B099 and B100 without admitting unrelated folders.
 * This is a basename check, never a substitute for existing disk and ownership
 * checks in the individual native-only runners.
 */
export function parsePrivateWindowsQaWave(name, role) {
  if (typeof name !== "string" || !["qa", "temp"].includes(role))
    return null;
  const match = /^Bostan-(B[0-9]{3})-(qa|temp)$/i.exec(name);
  return match && match[2].toLowerCase() === role
    ? match[1].toUpperCase() : null;
}

export function matchingPrivateWindowsQaWave(checkoutName, tempName) {
  const checkoutWave = parsePrivateWindowsQaWave(checkoutName, "qa");
  return checkoutWave !== null &&
    checkoutWave === parsePrivateWindowsQaWave(tempName, "temp");
}
