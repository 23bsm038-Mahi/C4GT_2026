let nextId = 1;

export function createLocalId(prefix = 'id') {
  nextId += 1;
  return `${prefix}-${nextId}`;
}
