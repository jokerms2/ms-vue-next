import { 
  hasOwn, 
  isString, 
  makeMap,
  babelParserDefaultPlugins,
  isGloballyWhitelisted
} from "@vue/shared";
import { CompoundExpressionNode, ConstantTypes, createCompoundExpression, createSimpleExpression, ExpressionNode, NodeTypes, SimpleExpressionNode } from "../ast";
import {
  Node,
  Function,
  Identifier,
  ObjectProperty,
  AssignmentExpression,
  UpdateExpression
} from '@babel/types'
import { NodeTransform, TransformContext } from "../transform";
import { BindingTypes } from "../options";
import { parse } from '@babel/parser'
import { walk } from 'estree-walker'
import { IS_REF, UNREF } from "../runtimeHelpers";
import { advancePositionWithClone, isSimpleIdentifier } from "../utils";
import { createCompilerError, ErrorCodes } from "../errors";
import { validateBrowserExpression } from "../validateExpression";

const isLiteralWhitelisted = makeMap('true,false,null,this')

export const transformExpression: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(
      node.content as SimpleExpressionNode,
      context
    )
  } else if (node.type === NodeTypes.ELEMENT) {
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      if (dir.type === NodeTypes.DIRECTIVE && dir.name !== 'for') {
        const exp = dir.exp
        const arg = dir.arg
        if (
          exp &&
          exp.type ===  NodeTypes.SIMPLE_EXPRESSION &&
          !(dir.name === 'on' && arg)
        ) {
          dir.exp = processExpression(
            exp,
            context,
            dir.name === 'slot'
          )
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          dir.arg = processExpression(arg, context)
        }
      }
    }
  }
}

interface PrefixMeta {
  prefix?: string
  isConstant: boolean
  start: number
  end: number
  scopeIds?: Set<string>
}

export function processExpression(
  node: SimpleExpressionNode,
  context: TransformContext,
  asParams = false,
  asRawStatements = false
): ExpressionNode {
  if (__BROWSER__) {
    if (__DEV__) {
      validateBrowserExpression(node, context, asParams, asRawStatements)
    }
    return node
  }

  if (!context.prefixIdentifiers || !node.content.trim()) {
    return node
  }  

  const { inline, bindingMetadata } = context
  const rewriteIdentifier = (raw: string, parent?: Node, id?: Identifier) => {
    const type = hasOwn(bindingMetadata, raw) && bindingMetadata[raw]
    if (inline) {
      const isAssignmentLVal =
        parent && parent.type === 'AssignmentExpression' && parent.left === id

      const isUpdateArg =
        parent && parent.type === 'UpdateExpression' && parent.argument === id
      
      const isDestructureAssignment =
        parent && isInDestructureAssignment(parent, parentStack)
      
      if (type === BindingTypes.SETUP_CONST) {
        return raw
      } else if (type === BindingTypes.SETUP_REF) {
        return `${raw}.value`
      } else if (type === BindingTypes.SETUP_MAYBE_REF) {
        return isAssignmentLVal || isUpdateArg || isDestructureAssignment
          ? `${raw}.value`
          : `${context.helperString(UNREF)}(${raw})`
      } else if (type === BindingTypes.SETUP_LET) {
        if (isAssignmentLVal) {
          const { right: rVal, operator } = parent as AssignmentExpression
          const rExp = rawExp.slice(rVal.start! - 1, rVal.end! - 1)
          const rExpString = stringifyExpression(
            processExpression(createSimpleExpression(rExp, false), context)
          )
          return `${context.helperString(IS_REF)}(${raw})${
            context.isTS ? ` //@ts-ignore\n` : ``
          } ? ${raw}.value ${operator} ${rExpString} : ${raw}`
        } else if (isUpdateArg) {
          id!.start = parent!.start
          id!.end = parent!.end
          const { prefix: isPrefix, operator } = parent as UpdateExpression
          const prefix = isPrefix ? operator : ``
          const postfix = isPrefix ? `` : operator
          return `${context.helperString(IS_REF)}(${raw})${
            context.isTS ? ` //@ts-ignore\n` : ``
          } ? ${prefix}${raw}.value${postfix} : ${prefix}${raw}${postfix}`
        } else if (isDestructureAssignment) {
          return raw
        } else {
          return `${context.helperString(UNREF)}(${raw})`
        }
      } else if (type === BindingTypes.PROPS) {
        return `__props.${raw}`
      }
    } else {
      if (type && type.startsWith('setup')) {
        return `$setup.${raw}`
      } else if (type) {
        return `${type}.${raw}`
      }
    }
    return `_ctx.${raw}`
  }

  const rawExp = node.content
  const bailConstant = rawExp.indexOf(`(`) > -1 || rawExp.indexOf('.') > 0

  if (isSimpleIdentifier(rawExp)) {
    const isScopeVarRenference = context.identifiers[rawExp]
    const isAllowedGlobal = isGloballyWhitelisted(rawExp)
    const isLiteral = isLiteralWhitelisted(rawExp)
    if (!asParams && !isScopeVarRenference && !isAllowedGlobal && !isLiteral) {
      if (bindingMetadata[node.content] === BindingTypes.SETUP_CONST) {
        node.constType = ConstantTypes.CAN_SKIP_PATCH
      }
      node.content = rewriteIdentifier(rawExp)
    } else if (!isScopeVarRenference) {
      if (isLiteral) {
        node.constType = ConstantTypes.CAN_STRINGIFY
      } else {
        node.constType = ConstantTypes.CAN_HOIST
      }
    }
    return node
  }
  let ast: any

  const source = asRawStatements
    ? ` ${rawExp} `
    : `(${rawExp})`

  try {
    ast = parse(source, {
      plugins: [...context.expressionPlugins, ...babelParserDefaultPlugins]
    }).program
  } catch(e) {
    context.onError(
      createCompilerError(
        ErrorCodes.X_INVALID_EXPRESSION,
        node.loc,
        undefined,
        e.message
      )
    )
    return node 
  }

  const ids: (Identifier & PrefixMeta)[] = []
  const knownIds = Object.create(context.identifiers)
  const isDuplicate = (node: Node & PrefixMeta): boolean =>
    ids.some(id => id.start === node.start)
  const parentStack: Node[] = []

  ;(walk as any)(ast, {
    enter(node: Node & PrefixMeta, parent: Node | undefined) {
      parent && parentStack.push(parent)
      if (node.type === 'Identifier') {
        if (!isDuplicate(node)) {
          if (__COMMIT__ && node.name.startsWith('_filter_')) {
            return
          }

          const needPrefix = shouldPrefix(node, parent!, parentStack)
          if (!knownIds[node.name] && needPrefix) {
            if (isStaticProperty(parent!) && parent.shorthand) {
              node.prefix = `${node.name}`
            }
            node.name = rewriteIdentifier(node.name, parent, node)
            ids.push(node)
          } else if (!isStaticPropertyKey(node, parent!)) {
            if (!(needPrefix && knownIds[node.name] && !bailConstant)) {
              node.isConstant = true
            }
            ids.push(node)
          }
        }
      } else if (isFunction(node)) {
        node.params.forEach(p => {
          (walk as any)(p, {
            enter(child: Node, parent: Node) {
              if (
                child.type === 'Identifier' &&
                !isStaticPropertyKey(child, parent) &&
                !(
                  parent &&
                  parent.type === 'AssignmentPattern' &&
                  parent.right === child
                )
              ) {
                const { name } = child
                if (node.scopeIds && node.scopeIds.has(name)) {
                  return
                }
                if (name in knownIds) {
                  knownIds[name]++
                } else {
                  knownIds[name] = 1
                }
                ;(node.scopeIds || (node.scopeIds = new Set())).add(name)
              }
            }
          })
        })
      }
    },
    leave(node: Node & PrefixMeta, parent: Node | undefined) {
      parent && parentStack.pop()
      if (node !== ast.body[0].expression && node.scopeIds) {
        node.scopeIds.forEach((id: string) => {
          knownIds[id]--
          if (knownIds[id] === 0) {
            delete knownIds[id]
          }
        })
      }
    }
  })

  const children: CompoundExpressionNode['children'] = []
  ids.sort((a, b) => a.start - b.start)
  ids.forEach((id, i) => {
    const start = id.start - 1
    const end = id.end - 1
    const last = ids[i - 1]
    const leadingText = rawExp.slice(last ? last.end - 1: 0, start)
    if (leadingText.length || id.prefix) {
      children.push(leadingText + (id.prefix || ``))
    }
    const source = rawExp.slice(start, end)
    children.push(
      createSimpleExpression(
        id.name,
        false,
        {
          source,
          start: advancePositionWithClone(node.loc.start, source, start),
          end: advancePositionWithClone(node.loc.end, source, end)
        },
        id.isConstant ? ConstantTypes.CAN_STRINGIFY : ConstantTypes.NOT_CONSTANT
      )
    )
    if (i === ids.length - 1 && end < rawExp.length) {
      children.push(rawExp.slice(end))
    }
  })

  let ret
  if (children.length) {
    ret = createCompoundExpression(children, node.loc)
  } else {
    ret = node
    ret.constType = bailConstant
      ? ConstantTypes.NOT_CONSTANT
      : ConstantTypes.CAN_STRINGIFY
  }

  ret.identifiers = Object.keys(knownIds)
  return ret
}

const isFunction = (node: Node): node is Function => {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}

const isStaticProperty = (node: Node): node is ObjectProperty =>
  node &&
  (node.type === 'ObjectProperty' || node.type === 'ObjectMethod') &&
  !node.computed


const isStaticPropertyKey = (node: Node, parent: Node) =>
  isStaticProperty(parent) && parent.key === node

function shouldPrefix(id: Identifier, parent: Node, parentStack: Node[]) {
  if (
    (parent.type === 'VariableDeclarator' ||
      parent.type === 'ClassDeclaration') &&
    parent.id === id 
  ) {
    return false
  }

  if (isFunction(parent)) {
    if ((parent as any).id === id) {
      return false
    }
    if (parent.params.includes(id)) {
      return false
    }
  }

  if (isStaticPropertyKey(id, parent)) {
    return false
  }

  if (
    parent.type === 'ArrayPattern' &&
    !isInDestructureAssignment(parent, parentStack)
  ) {
    return false
  }

  if (
    (parent.type === 'MemberExpression' ||
      parent.type === 'OptionalMemberExpression') &&
    parent.property === id &&
    !parent.computed
  ) {
    return false
  }

  if (id.name === 'arguments') {
    return false
  }

  if (isGloballyWhitelisted(id.name)) {
    return false
  }

  if (id.name === 'require') {
    return false
  }

  return true
}


function isInDestructureAssignment(parent: Node, parentStack: Node[]): boolean {
  if (
    parent &&
    (parent.type === 'ObjectProperty' || parent.type === 'ArrayPattern')
  ) {
    let i = parentStack.length
    while(i--) {
      const p = parentStack[i]
      if (p.type === 'AssignmentExpression') {
        return true
      } else if (p.type !== 'ObjectProperty' && !p.type.endsWith('Pattern')) {
        break
      }
    }
  }
  return false
}


function stringifyExpression(exp: ExpressionNode | string): string {
  if (isString(exp)) {
    return exp
  } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    return exp.content
  } else {
    return (exp.children as (ExpressionNode | string)[])
      .map(stringifyExpression)
      .join('')
  }
}