import { DirectiveTransform } from '@vue/compiler-core';

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.onError(
      createDOM
    )
  } 
}