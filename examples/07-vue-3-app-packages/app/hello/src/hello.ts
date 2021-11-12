import { defineComponent } from "vue";

// intentionally empty to test/demonstrate separating the .vue and .ts files
export default defineComponent({
    setup: () => ({
        hello: () => "Hello"
    })
});