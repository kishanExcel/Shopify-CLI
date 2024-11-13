import {takeRandomFromArray} from './array.js'
import {unstyled} from '../../public/node/output.js'
import {Token, TokenItem} from '../../private/node/ui/components/TokenizedText.js'
import {camelCase, constantCase, paramCase, snakeCase, pascalCase} from 'change-case'

const SAFE_RANDOM_BUSINESS_ADJECTIVES = [
  'commercial',
  'profitable',
  'amortizable',
  'branded',
  'integrated',
  'synergistic',
  'consolidated',
  'diversified',
  'lean',
  'niche',
  'premium',
  'luxury',
  'scalable',
  'optimized',
  'empowered',
  'international',
  'beneficial',
  'fruitful',
  'extensive',
  'lucrative',
  'modern',
  'stable',
  'strategic',
  'adaptive',
  'efficient',
  'growing',
  'sustainable',
  'innovative',
  'regional',
  'specialized',
  'focused',
  'pragmatic',
  'ethical',
  'flexible',
  'competitive',
]

const SAFE_RANDOM_CREATIVE_ADJECTIVES = [
  'bright',
  'impactful',
  'stylish',
  'colorful',
  'modern',
  'minimal',
  'trendy',
  'creative',
  'artistic',
  'spectacular',
  'glamorous',
  'luxury',
  'retro',
  'nostalgic',
  'comfy',
  'polished',
  'fabulous',
  'balanced',
  'monochrome',
  'glitched',
  'contrasted',
  'elegant',
  'textured',
  'vibrant',
  'harmonious',
  'versatile',
  'eclectic',
  'futuristic',
  'idealistic',
  'intricate',
  'bohemian',
  'abstract',
  'meticulous',
  'refined',
  'flamboyant',
]

const SAFE_RANDOM_BUSINESS_NOUNS = [
  'account',
  'consumer',
  'customer',
  'enterprise',
  'business',
  'venture',
  'marketplace',
  'revenue',
  'vertical',
  'portfolio',
  'negotiation',
  'shipping',
  'demand',
  'supply',
  'growth',
  'merchant',
  'investment',
  'shareholder',
  'conversion',
  'capital',
  'projection',
  'upside',
  'trade',
  'deal',
  'merchandise',
  'transaction',
  'sale',
  'franchise',
  'subsidiary',
  'logistics',
  'infrastructure',
  'sponsorship',
  'partnership',
  'tax',
  'policy',
  'outsource',
  'equity',
  'strategy',
  'valuation',
  'benchmark',
  'metrics',
  'duplication',
]

const SAFE_RANDOM_CREATIVE_NOUNS = [
  'vibe',
  'style',
  'moment',
  'mood',
  'flavor',
  'look',
  'appearance',
  'perspective',
  'aspect',
  'ambience',
  'quality',
  'backdrop',
  'focus',
  'tone',
  'inspiration',
  'imagery',
  'aesthetics',
  'palette',
  'ornamentation',
  'contrast',
  'colorway',
  'visuals',
  'typography',
  'composition',
  'scale',
  'symmetry',
  'gradients',
  'proportions',
  'textures',
  'harmony',
  'shapes',
  'patterns',
]

export type RandomNameFamily = 'business' | 'creative'

/**
 * Generates a random name by combining an adjective and noun.
 *
 * @param family - Theme to use for the random name (business or creative).
 * @returns A random name generated by combining an adjective and noun.
 */
export function getRandomName(family: RandomNameFamily = 'business'): string {
  const mapping = {
    business: {
      adjectives: SAFE_RANDOM_BUSINESS_ADJECTIVES,
      nouns: SAFE_RANDOM_BUSINESS_NOUNS,
    },
    creative: {
      adjectives: SAFE_RANDOM_CREATIVE_ADJECTIVES,
      nouns: SAFE_RANDOM_CREATIVE_NOUNS,
    },
  }
  return `${takeRandomFromArray(mapping[family].adjectives)}-${takeRandomFromArray(mapping[family].nouns)}`
}

/**
 * Given a string, it returns it with the first letter capitalized.
 *
 * @param str - String to capitalize.
 * @returns String with the first letter capitalized.
 */
export function capitalize(str: string): string {
  return str.substring(0, 1).toUpperCase() + str.substring(1)
}

/**
 * Given a list of items, it returns a pluralized string based on the amount of items.
 *
 * @param items - List of items.
 * @param plural - Supplier used when the list of items has more than one item.
 * @param singular - Supplier used when the list of items has a single item.
 * @param none - Supplier used when the list has no items.
 * @returns The {@link TokenItem} supplied by the {@link plural}, {@link singular}, or {@link none} functions.
 */
export function pluralize<
  T,
  TToken extends Token = Token,
  TPluralToken extends TToken = TToken,
  TSingularToken extends TToken = TToken,
  TNoneToken extends TToken = TToken,
>(
  items: T[],
  plural: (items: T[]) => TokenItem<TPluralToken>,
  singular: (item: T) => TokenItem<TSingularToken>,
  none?: () => TokenItem<TNoneToken>,
): TokenItem<TPluralToken | TSingularToken | TNoneToken> | string {
  if (items.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return singular(items[0]!)
  }

  if (items.length > 1) {
    return plural(items)
  }

  if (none) {
    return none()
  }

  return ''
}

/**
 * Try to convert a string to an int, falling back to undefined if unable to.
 *
 * @param maybeInt - String to convert to an int.
 * @returns The int if it was able to convert, otherwise undefined.
 */
export function tryParseInt(maybeInt: string | undefined): number | undefined {
  let asInt: number | undefined
  if (maybeInt !== undefined) {
    asInt = parseInt(maybeInt, 10)
    if (isNaN(asInt)) {
      asInt = undefined
    }
  }
  return asInt
}

/**
 * Transforms a matrix of strings into a single string with the columns aligned.
 *
 * @param lines - Array of rows, where each row is an array of strings (representing columns).
 * @returns A string with the columns aligned.
 */
export function linesToColumns(lines: string[][]): string {
  const widths: number[] = []
  for (let i = 0; lines[0] && i < lines[0].length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const columnRows = lines.map((line) => line[i]!)
    widths.push(Math.max(...columnRows.map((row) => unstyled(row).length)))
  }
  const paddedLines = lines
    .map((line) => {
      return line
        .map((col, index) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return `${col}${' '.repeat(widths[index]! - unstyled(col).length)}`
        })
        .join('   ')
        .trimEnd()
    })
    .join('\n')
  return paddedLines
}

/**
 * Given a string, it transforms it to a slug (lowercase, hyphenated, no special chars, trimmed...).
 *
 * @param str - String to slugify.
 * @returns The slugified string.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Given a string, it returns it with the special regex characters escaped.
 * More info: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping.
 *
 * @param str - String to escape.
 * @returns The escaped string.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Transform a string to camelCase.
 *
 * @param input - String to escape.
 * @returns The escaped string.
 */
export function camelize(input: string): string {
  return camelCase(input)
}

/**
 * Transform a string to param-case.
 *
 * @param input - String to transform.
 * @returns The transformed string.
 */
export function hyphenate(input: string): string {
  return paramCase(input)
}

/**
 * Transform a string to snake_case.
 *
 * @param input - String to transform.
 * @returns The transformed string.
 */
export function underscore(input: string): string {
  return snakeCase(input)
}

/**
 * Transform a string to CONSTANT_CASE.
 *
 * @param input - String to transform.
 * @returns The transformed string.
 */
export function constantize(input: string): string {
  return constantCase(input)
}

/**
 * Given a date, return a formatted string like "2021-01-01 12:00:00".
 *
 * @param date - Date to format.
 * @returns The transformed string.
 */
export function formatDate(date: Date): string {
  const components = date.toISOString().split('T')
  const dateString = components[0] ?? date.toDateString()
  const timeString = components[1]?.split('.')[0] ?? date.toTimeString()
  return `${dateString} ${timeString}`
}

/**
 * Given a date in UTC ISO String format, return a formatted string in local time like "2021-01-01 12:00:00".
 *
 * @param dateString - UTC ISO Date String.
 * @returns The transformed string in local system time.
 */
export function formatLocalDate(dateString: string): string {
  const dateObj = new Date(dateString)
  const localDate = new Date(
    Date.UTC(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      dateObj.getHours(),
      dateObj.getMinutes(),
      dateObj.getSeconds(),
    ),
  )
  return formatDate(localDate)
}

/**
 * Given a list of items, it returns a string with the items joined by commas and the last item joined by "and".
 * All items are wrapped in double quotes.
 * For example: ["a", "b", "c"] returns "a", "b" and "c".
 *
 * @param items - List of items.
 * @returns The joined string.
 */
export function joinWithAnd(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return `"${items[0]}"`

  return `${items
    .slice(0, -1)
    .map((item) => `"${item}"`)
    .join(', ')} and "${items[items.length - 1]}"`
}

/**
 * Given a string, it returns the PascalCase form of it.
 * Eg: "pascal_case" returns "PascalCase".
 *
 * @param str - String to PascalCase.
 * @returns String with all the first letter capitalized with no spaces.
 */
export function pascalize(str: string): string {
  return pascalCase(str)
}

/**
 * Given a string that represents a list of delimited tokens, it returns the normalized string representing the same
 * list, without empty elements, sorted, and with no duplicates.
 *
 * @param delimitedString - String to normalize.
 * @param delimiter - Delimiter used to split the string into tokens.
 * @returns String with the normalized list of tokens.
 */
export function normalizeDelimitedString(delimitedString?: string, delimiter = ','): string | undefined {
  if (!delimitedString) return

  const items = delimitedString.split(delimiter).map((value) => value.trim())
  const nonEmptyItems = items.filter((value) => value !== '')
  const sortedItems = nonEmptyItems.sort()
  const uniqueSortedItems = [...new Set(sortedItems)]

  return uniqueSortedItems.join(delimiter)
}