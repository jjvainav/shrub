/** Defines assets used by the build process when building/copying views to the output folder. */
module.exports = {
    /** 
     * Each bundle item represents a js file that will get bundled by webpack: 
     * - csrClient client bundles for client-side SPA views.
     */
    bundles: {
        csrClient: [{ name: "workbench", template: "./workbench/index.html", entry: "./workbench/main.js" }]
    }
};