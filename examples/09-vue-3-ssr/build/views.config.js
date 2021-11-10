/** Defines assets used by the build process when building/copying views to the output folder. */
module.exports = {
    /** 
     * Each bundle item represents a js file that will get bundled by webpack: 
     * - ssrClient client bundles are for Vue server-side rendered views.
     * - ssrServer server bundles are for Vue server-side rendered views.
     */
    bundles: {
        ssrClient: [{ name: "app", template: "./app/index.hbs", entry: "./app/main-client.js" }],
        ssrServer: [{ name: "app", entry: "./app/main-server.js" }]
    }
};