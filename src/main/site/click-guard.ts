export function assertAllowedClick(
  selector: string,
  label: string,
  onClaimPage: boolean,
  resolvesToForbiddenControl: boolean,
  forbiddenSelectors: readonly string[]
): void {
  if (
    forbiddenSelectors.includes(selector) ||
    resolvesToForbiddenControl ||
    (onClaimPage && /^(next|submit)$/i.test(label.trim()))
  ) {
    throw new Error('Click refused for safety.')
  }
}
