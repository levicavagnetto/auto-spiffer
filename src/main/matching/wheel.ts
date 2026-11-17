/** Saved-match key for a wheel row: its words without size, bolt pattern, offset or bare numbers. */
export function wheelSignature(description: string): string {
  const words = description
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        !/^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/.test(word) &&
        !/^[+-]?\d+(?:\.\d+)?(?:mm)?$/.test(word)
    )
  return `wheel|${words.join(' ')}`
}
