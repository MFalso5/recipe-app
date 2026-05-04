export const GENERAL_SOURCE = 'General Recipes'

export function normalizeSource(source: string | null | undefined): string {
  if (!source || source === 'Unknown Source' || source.trim() === '') {
    return GENERAL_SOURCE
  }
  return source
}
