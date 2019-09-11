import marked from "marked";
import Vue from "vue";
import Component from "vue-class-component";
import intro from "../intro.md";

@Component
export default class Intro extends Vue {
    getCompiledMarkdown(): string {
        return marked(intro);
    }
}