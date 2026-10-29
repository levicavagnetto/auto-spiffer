export function similarity(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (!left.length && !right.length) return 100
  let previous = Array<number>(right.length + 1).fill(0)
  for (const char of left) {
    const current = Array<number>(right.length + 1).fill(0)
    for (let index = 1; index <= right.length; index++) {
      current[index] =
        char === right[index - 1]
          ? previous[index - 1]! + 1
          : Math.max(previous[index]!, current[index - 1]!)
    }
    previous = current
  }
  return (200 * previous[right.length]!) / (left.length + right.length)
}
