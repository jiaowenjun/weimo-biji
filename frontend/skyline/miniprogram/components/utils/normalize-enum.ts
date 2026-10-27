export function normalizeEnumValue<T extends string>(
  value: string,
  validValues: T[],
  fallback: T,
): T {
  return validValues.includes(value as T) ? (value as T) : fallback
}
