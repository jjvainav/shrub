import marked from "marked";
import Vue from "vue";
import Component from "vue-class-component";

@Component
export default class Intro extends Vue {
    markdown: string | undefined = "";

    created(): void {
        this.setCompiledMarkdown();
    }

    setCompiledMarkdown(): void {
        import(/* webpackChunkName: "intro.[request].md" */ `../intro.${this.$i18n.locale}.md`)
            .then(value => this.markdown = marked(value.default));
    }
}