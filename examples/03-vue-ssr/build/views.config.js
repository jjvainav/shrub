/** Defines assets used by the build process when building/copying views to the output folder. */
module.exports = {
    /** 
     * Each bundle item represents a js file that will get bundled by webpack: 
     * - ssrClient client bundles are for Vue server-side rendered views.
     * - ssrServer server bundles are for Vue server-side rendered views.
     */
    bundles: {
        ssrClient: [{ name: "hello", template: "./hello/index.html", entry: "./hello/main-client.js" }],
        ssrServer: [{ name: "hello", entry: "./hello/main-server.js" }]
    }
};