import marked from "marked";
import Vue from "vue";
import Component from "vue-class-component";

@Component
export default class Intro extends Vue {
    markdown: string | undefined = "";

    created(): void {
        this.loadMarkdown(this.$i18n.locale);
    }

    loadMarkdown(locale: string): void {
        import(/* webpackChunkName: "[request]" */ `../intro.${locale}.md`)
            .then(value => this.markdown = marked(value.default))
            .catch(() => this.loadMarkdown("en-US"));
    }
}