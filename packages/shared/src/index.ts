import { makeMap } from "./makeMap"

export { makeMap }

export * from './globalsWhitelist'
export * from './patchFlags'
export * from './slotFlags'
export * from './normalizeProp'
export * from './domAttrConfig'

export const babelParserDefaultPlugins = [
  'bigInt',
  'optionalChaining',
  'nullishCoalescingOperator'
] as const

export const EMPTY_OBJ: { readonly [key: string]: any} = __DEV__
  ? Object.freeze({})
  : {}

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object, 
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const NOOP = () => {}

export const extend = Object.assign

export const isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> => 
  toTypeString(val) === '[object Map]'

export const isSet = (val: unknown): val is Set<any> => 
  toTypeString(val) === '[object Set]'

export const isDate = (val: unknown): val is Date => val instanceof Date

export const isFunction = (val: unknown): val is Function => 
  typeof val === 'function'

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> => 
  val != null && typeof val === 'object'

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

export const isIntegerKey = (key: unknown) => 
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '_' &&
  '' + parseInt(key, 10) === key


export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    value
  })
}

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}


const camelizeRE = /-(\w)/g
export const camelize = cacheStringFunction((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase(): ''))
})

const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cacheStringFunction((str: string): string => 
  str.replace(hyphenateRE, '-$1').toLowerCase()
)

export const capitalize = cacheStringFunction(
  (str: string) => str.charAt(0).toUpperCase + str.slice(1)
)

export const toHandlerKey = cacheStringFunction((str: string) => 
  str ? `on${capitalize(str)}` : ``
)


export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)


export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1)
} 
