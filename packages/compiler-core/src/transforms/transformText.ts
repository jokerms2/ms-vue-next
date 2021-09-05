import { PatchFlagName, PatchFlags } from "packages/shared/src/patchFlags";
import { CallExpression, CompoundExpressionNode, ConstantTypes, createCallExpression, ElementTypes, NodeTypes } from "../ast";
import { CREATE_TEXT } from "../runtimeHelpers";
import { NodeTransform } from "../transform";
import { isText } from "../utils";
import { getConstantType } from "./hoistStatic";

export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  loc: child.loc,
                  children: [child]
                }
              }
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          } 
        }
      }

      if (
        !hasText ||
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT || 
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT &&
              !node.props.find(
                p => 
                  p.type === NodeTypes.DIRECTIVE &&
                  !context.directiveTransforms[p.name]
              ) && 
              !(__COMPAT__ && node.tag === 'template'))))
      ) {
        return
      }

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: CallExpression['arguments'] = []

          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }

          if (
            !context.ssr &&
            getConstantType(child, context) === ConstantTypes.NOT_CONSTANT
          ) {
            callArgs.push(
              PatchFlags.TEXT +
              (__DEV__ ? ` /* ${PatchFlagName[PatchFlags.TEXT]} */` : ``)
            )
          }

          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs
            )
          }
        }
      }
    }
  }
}