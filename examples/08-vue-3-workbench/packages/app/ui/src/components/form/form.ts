import { defineComponent, h } from "vue";

export default defineComponent({
    props: {
        inline: { required: false, type: Boolean, default: false },
        validated: { required: false, type: Boolean, default: false }
    },
    setup: (props, context) => h("form", {
        class: {
            "form-inline": props.inline,
            "was-validated": props.validated
        }
    },
    context.slots)
});