export const normalizeName = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
