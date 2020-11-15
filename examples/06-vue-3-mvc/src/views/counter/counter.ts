import { defineComponent } from "vue";

export default defineComponent({
    // TODO: for some reason the composition API is not reactive here
    // setup() {
    //     const count = ref(0);
    //     const increment = () => {
    //         count.value++;
    //     };

    //     return { count, increment };
    // }
    data: () => ({ count: 0 }),
    methods: {
        increment(): void {
            this.count++;
        }
    }
});