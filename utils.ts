export function groupBy<T, K>(items: T[], getKey: (item: T) => K): [K, T[]][] {
  const groupedMap = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (groupedMap.has(key)) {
      groupedMap.get(key).push(item);
    } else {
      groupedMap.set(key, [item]);
    }
  }
  return Array.from(groupedMap.entries());
}
