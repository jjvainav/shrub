import { defineComponent, h, VNodeArrayChildren } from "vue";

export type ButtonSize = "large" | "normal" | "small";
export type ButtonStyle = "default" | "muted";
export type ButtonType = "button" | "default" | "link" | "reset" | "submit";
export type ButtonVariant = 
    "primary" | 
    "secondary" | 
    "success" | 
    "info" | 
    "warning" | 
    "danger" | 
    "light" | 
    "dark" | 
    "link" |
    "none" |
    "outline-primary" | 
    "outline-secondary" | 
    "outline-success" | 
    "outline-info" | 
    "outline-warning" | 
    "outline-danger" | 
    "outline-light" | 
    "outline-dark";

interface IButtonProps {
    readonly buttonStyle: ButtonStyle | string;
    readonly type: ButtonType | string;
    readonly variant: ButtonVariant | string;
    readonly size: ButtonSize | string;
    readonly icon?: string;
    readonly link?: string;
    readonly text?: string;
    /** True to show the button active/focus shadow or false to hide it; the default is true. */
    readonly shadow: boolean;
    readonly disabled: boolean;
}

function getButtonVisualCSS(props: IButtonProps): object {
    // build an object for all the btn-* CSS classes that give the button its visual appearance
    const buttonClass: any = {
        "btn": true,
        "btn-sm": props.size === "small",
        "btn-lg": props.size === "large",
        "shadow-none": !props.shadow
    };

    if (props.buttonStyle === "default") {
        buttonClass[`btn-${props.variant}`] = props.variant !== "none";
    }
    else if (props.buttonStyle === "muted") {
        const hasOutline = props.variant.startsWith("outline");

        buttonClass["btn-muted"] = !hasOutline;
        buttonClass["btn-muted-outline"] = hasOutline;
        // ignore if variant is a link or none
        buttonClass[`btn-muted-${props.variant}`] = props.variant !== "link" && props.variant !== "none";
    }

    return buttonClass;
}

export default defineComponent({
    props: {
        buttonStyle: { type: String, default: "default" },
        type: { type: String, default: "default" },
        variant: { type: String, default: "primary" },
        size: { type: String, default: "normal" },
        icon: { type: String },
        link: { type: String },
        text: { type: String },
        // True to show the button active/focus shadow or false to hide it; the default is true.
        shadow: { type: Boolean, default: true },
        disabled: { type: Boolean, default: false }
    },
    setup: (props, context) => {
        const children: VNodeArrayChildren = [];

        // if custom content is provided for the button ignore the icon/text properties
        if (context.slots.default) {
            children.push(...context.slots.default());
        }
        else {
            if (props.icon) {
                children.push(h("i", {
                    staticClass: props.icon,
                    class: { "pe-1": !!props.text }
                }));
            }

            if (props.text) {
                children.push(props.text);
            }
        }

        const type = props.type === "default" 
            ? props.link ? "link" : "button"
            : props.type;

        const cssClass = getButtonVisualCSS(props);

        if (type === "link") {
            const link = props.link || "#";
            let attrs: any = {
                href: link,
                role: link[0] === "#" ? "button" : "link"
            };

            if (props.disabled) {
                attrs = { 
                    ...attrs,
                    "aria-disabled": "true",
                    "tabindex": "-1"
                };
            }

            return h("a", {
                attrs,
                class: { ...cssClass, "disabled": props.disabled }
            }, 
            children);
        }

        return h("button", {
            attrs: {
                disabled: props.disabled,
                type 
            },
            class: cssClass
        }, 
        children);
    }
});