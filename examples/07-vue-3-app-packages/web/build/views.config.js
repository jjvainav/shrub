/** Defines assets used by the build process when building/copying views to the output folder. */
module.exports = {
    views: [
        { name: "hello", template: "./hello/index.html", entry: "./hello/main.js" },
        { name: "world", template: "./world/index.html", entry: "./world/main.js" }
    ]
};