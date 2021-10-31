import { Text, VNode } from "vue";

/** Checks if a VNode is a plain text element; the text can be found through the VNode children property. */
export function isTextVNode(vnode: VNode): vnode is { children: string } & VNode {
    return vnode.type === Text;
}