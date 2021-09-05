
import { CompilerError } from './errors'
import { DirectiveTransform, NodeTransform, TransformContext } from './transform'
import { CompilerCompatOptions } from './compat/compatConfig'
import { ParserPlugin } from '@babel/parser'
import { ElementNode, Namespace, TemplateChildNode } from './ast'
import { TextModes } from './parse'

export interface ErrorHandingOptions {
  onWarn?: (warning: CompilerError) => void
  onError?: (error: CompilerError) => void
}

export interface ParserOptions
  extends ErrorHandingOptions,
    CompilerCompatOptions {

  isNativeTag?: (tag: string) => boolean

  isVoidTag?: (tag: string) => boolean

  isPreTag?: (tag: string) => boolean

  isBuildInComponent?: (tag: string) => symbol | void

  isCustomElement?: (tag: string) => boolean | void

  getNamespace?: (tag: string, parent: ElementNode | undefined) => Namespace

  getTextMode?: (
    node: ElementNode,
    parent: ElementNode | undefined
  ) => TextModes

  delimiters?: [string, string],
  whitespace?: 'preserve' | 'condense'
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  comments?: boolean
}

export type HoistTransform = (
  children: TemplateChildNode[],
  context: TransformContext,
  parent: ParentNode
) => void

export const enum BindingTypes {
  DATA = 'data',

  PROPS = 'props',

  SETUP_LET = 'setup-let',

  SETUP_CONST = 'setup-const',

  SETUP_MAYBE_REF = 'setup-maybe-ref',

  SETUP_REF = 'setup-ref',

  OPTIONS = 'options'
}

export type BindingMetadata = {
  [key: string]: BindingTypes | undefined
} & {
  __isScriptSetup?: boolean
}


interface SharedTransformCodegenOptions {
  prefixIdentifiers?: boolean

  ssr?: boolean

  inSSR?: boolean

  bindingMetadata?: BindingMetadata

  inline?: boolean

  isTS?: boolean

  filename?: string
}

export interface TransformOptions
  extends SharedTransformCodegenOptions,
    ErrorHandingOptions,
    CompilerCompatOptions {
  nodeTransforms?: NodeTransform[]
  
  directiveTransforms?: Record<string, DirectiveTransform  | undefined>
  
  transformHoist?: HoistTransform | null

  isBuiltInComponent?: (tag: string) => symbol | void

  isCustomElement?: (tag: string) => boolean | void

  prefixIdentifiers?: boolean

  hoistStatic?: boolean

  cacheHandlers?: boolean

  expressionPlugins?: ParserPlugin[]

  scopeId?: string | null

  slotted?: boolean

  ssrCssVars?: string
}

export interface CodegenOptions extends SharedTransformCodegenOptions {
  /**
   * - `module` mode will generate ES module import statements for helpers
   * and export the render function as the default export.
   * - `function` mode will generate a single `const { helpers... } = Vue`
   * statement and return the render function. It expects `Vue` to be globally
   * available (or passed by wrapping the code with an IIFE). It is meant to be
   * used with `new Function(code)()` to generate a render function at runtime.
   * @default 'function'
   */
  mode?: 'module' | 'function'
  /**
   * Generate source map?
   * @default false
   */
  sourceMap?: boolean
  /**
   * SFC scoped styles ID
   */
  scopeId?: string | null
  /**
   * Option to optimize helper import bindings via variable assignment
   * (only used for webpack code-split)
   * @default false
   */
  optimizeImports?: boolean
  /**
   * Customize where to import runtime helpers from.
   * @default 'vue'
   */
  runtimeModuleName?: string
  /**
   * Customize the global variable name of `Vue` to get helpers from
   * in function mode
   * @default 'Vue'
   */
  runtimeGlobalName?: string
}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions