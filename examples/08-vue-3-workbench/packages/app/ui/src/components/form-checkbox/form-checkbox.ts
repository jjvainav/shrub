import { defineComponent, h, SetupContext, VNodeArrayChildren } from "vue";

export function handleInput(context: SetupContext<any>, checked: boolean, modelValue?: Array<any> | Boolean, value?: string): void {
    if (typeof modelValue === "boolean") {
        context.emit("input", checked);
    }
    else if (Array.isArray(modelValue)) {
        if (checked) {
            context.emit("input", [...modelValue, value]);
        }
        else {
            context.emit("input", modelValue.filter(item => item !== value));
        }
    }
}

export function isChecked(modelValue: Array<any> | Boolean, value?: string): boolean {
    if (Array.isArray(modelValue)) {
        return !!value && modelValue.includes(value);
    }

    if (typeof modelValue === "boolean") {
        return modelValue;
    }

    return false;
}

export default defineComponent({
    model: {
        prop: "modelValue",
        event: "input"
    },
    props: {
        id: { required: false, type: String },
        label: { required: false, type: String },
        // the prop for Vue v-model to bind to -- Vue supports a boolean or array for an input checkbox
        modelValue: { required: false, type: [Array, Boolean] },
        // the HTML input element's value attribute for the checkbox
        value: { required: false, type: String },
        checked: { required: false, type: Boolean, default: false },
        disabled: { required: false, type: Boolean, default: false },
        switch: { required: false, type: Boolean, default: false }
    },
    emits: ["input"],
    setup: (props, context) => {
        const children: VNodeArrayChildren = [];
        children.push(h("input", {
            id: props.id, 
            type: "checkbox",
            class: ["form-check-input"],
            checked: props.checked || isChecked(<any>props.modelValue, props.value),
            disabled: props.disabled,
            value: props.value,
            onInput: (event: InputEvent) => handleInput(
                context, 
                (<HTMLInputElement>event.target).checked, 
                props.modelValue, 
                props.value)
        }));

        const slot = context.slots.default && context.slots.default();
        const labelContent = slot && slot.length ? slot : props.label || "";

        if (labelContent) {
            children.push(h("label", {
                attrs: { for: props.id },
                staticClass: "form-check-label"
            },
            labelContent));
        }

        return h("div", { 
            staticClass: "form-check",
            class: { "form-switch": props.switch }
        }, 
        children);
    }
});