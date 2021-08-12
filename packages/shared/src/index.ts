export const extend = Object.assign

export const isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> => 
  toTypeString(val) === '[object Map]'

export const isSet = (val: unknown): val is Set<any> => 
  toTypeString(val) === '[object Set]'

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


export const def = (obj?: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    value
  })
}


