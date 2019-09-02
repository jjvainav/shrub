// this declaration is needed to import .vue files in the .ts scripts.
declare module "*.vue" {
    import Vue from "vue";
    export default Vue;
}