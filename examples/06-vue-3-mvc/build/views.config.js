/** Defines assets used by the build process when building/copying views to the output folder. */
module.exports = {
    views: [
        { name: "counter", template: "./counter/index.html", entry: "./counter/main.js" },
        { name: "hello", template: "./hello/index.html", entry: "./hello/main.js" }
    ]
};