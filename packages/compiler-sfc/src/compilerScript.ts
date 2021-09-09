import { ParserPlugin } from '@babel/parser'
import MagicString from 'magic-string'
import { BindingTypes } from 'packages/compiler-core/src/options'
import { makeMap } from '@vue/shared'



const DEFINE_PROPS = 'defineProps'
const DEFINE_EMITS = 'defineEmits'
const DEFINE_EXPORTS = 'defineExpose'
const WITH_DEFAULTS = 'withDefaults'

const $REF = `$ref`
const $COMPUTED = `$computed`
const $FROM_REFS = `$fromRefs`
const $RAW = `$raw`

const isBuiltInDir = makeMap(
  `once,memo,if,else,else-if,slot,text,html,on,bind,model,show,cloak,is`
)

export interface SFCScriptCompileOptions {
  id: string

  isProd?: boolean

  babelParserPlugins?: ParserPlugin[]
  refSugar?: boolean
  inineTemplate?: boolean
  templateOptions?: Partial<SFCTemplateCompileOptions>
  parseOnly?: boolean
}

interface ImportBinding {
  isType: boolean
  imported: string
  source: string
  rangeNode: Node
  isFromSetup: boolean
  isUsedInTemplate: boolean
}

interface VariableBinding {
  type: BindingTypes
  rangeNode: Node
}