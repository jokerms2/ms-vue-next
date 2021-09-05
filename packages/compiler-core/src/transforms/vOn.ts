import { camelize, toHandlerKey } from "@vue/shared";
import { createCompoundExpression, createObjectProperty, createSimpleExpression, DirectiveNode, ElementTypes, ExpressionNode, NodeTypes, SimpleExpressionNode } from "../ast";
import { createCompilerError, ErrorCodes } from "../errors";
import { TO_HANDLER_KEY } from "../runtimeHelpers";
import { DirectiveTransform, DirectiveTransformResult } from "../transform";
import { hasScopeRef, isMemberExpression } from "../utils";
import { validateBrowserExpression } from "../validateExpression";
import { processExpression } from "./transformExpression";


const fnExpRE = /\s*([\w$_]+|\([^)]*?\))\s*=>|^\s+function(?:\s+[\w$]+)?\s*\(/

export interface VOnDirectiveNode extends DirectiveNode {
  arg: ExpressionNode
  exp: SimpleExpressionNode | undefined
}

export const transformOn: DirectiveTransform = (
  dir,
  node,
  context,
  augmentor 
) => {
  const { loc, modifiers, arg} = dir as VOnDirectiveNode

  if (!dir.exp && !modifiers.length) {
    context.onError(createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc))
  }
  let eventName: ExpressionNode
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      const rawName = arg.content
      eventName = createSimpleExpression(
        toHandlerKey(camelize(rawName)),
        true,
        arg.loc
      )
    } else {
      eventName = createCompoundExpression([
        `${context.helperString(TO_HANDLER_KEY)}(`,
        arg,
        `)`
      ])
    }
  } else {
    eventName = arg
    eventName.children.unshift(`${context.helperString(TO_HANDLER_KEY)}(`)
    eventName.children.push(`)`)
  }

  let exp: ExpressionNode | undefined = dir.exp as
    | SimpleExpressionNode
    | undefined
  if (exp && !exp.content.trim()) {
    exp = undefined
  }
  let shouldCache: boolean = context.cacheHandlers && !exp && !context.inVOnce
  if (exp) {
    const isMemberExp = isMemberExpression(exp.content)
    const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content))
    const hasMultipleStatements = exp.content.includes(`;`)

    if (__BROWSER__ && context.prefixIdentifiers) {
      isInlineStatement && context.addIdentifiers(`$event`)
      exp = dir.exp = processExpression(
        exp,
        context,
        false,
        hasMultipleStatements
      )
      isInlineStatement && context.removeIdentifiers(`$event`)

      shouldCache =
        context.cacheHandlers &&
        !context.inVOnce &&
        !(exp.type === NodeTypes.SIMPLE_EXPRESSION && exp.constType > 0) &&
        !(isMemberExp && node.tagType === ElementTypes.COMPONENT) &&
        !hasScopeRef(exp, context.identifiers)
      
      if (shouldCache && isMemberExp) {
        if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
          exp.content = `${exp.content} && ${exp.content}(...args)`
        } else {
          exp.children = [...exp.children, ` && `, ...exp.children, `(...args)`]
        }
      }
    }

    if (__DEV__ && __BROWSER__) {
      validateBrowserExpression(
        exp as SimpleExpressionNode,
        context,
        false,
        hasMultipleStatements
      )
    }

    if (isInlineStatement || (shouldCache && isMemberExp)) {
      exp = createCompoundExpression([
        `${
          isInlineStatement
            ? !__BROWSER__ && context.isTS
              ? `($event: any)`
              : `$event`
            : `${
              !__BROWSER__ && context.isTS ? `\n//@ts-ignore\n` : ``
            }(...args)`
        } => ${hasMultipleStatements ? `{` : `(`}`,
        exp,
        hasMultipleStatements ? '}' : ')'
      ])
    }
  }

  let ret: DirectiveTransformResult = {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression(`() => {}`, false, loc)
      )
    ]
  }

  if (augmentor) {
    ret = augmentor(ret)
  }

  if (shouldCache) {
    ret.props[0].value = context.cache(ret.props[0].value)
  }
  
  ret.props.forEach(p => (p.key.isHandlerKey = true))
  return ret
}