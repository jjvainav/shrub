const path = require("path");
const VueSSRServerPlugin = require("vue-server-renderer/server-plugin");
const webpack = require("webpack");
const merge = require("webpack-merge");
const nodeExternals = require("webpack-node-externals");
const views = require("./views.config");
const base = require("./webpack.config.base.js");

// Bundles all the server-side SSR javascript stuff.

// the web app root folder relative to __dirname
const appRoot = "../";
// root to app in the dist folder
const distAppRoot = appRoot + "dist/app";
// the main node_modules folder at the root of the repo relative to __dirname
const nodeModulesRoot = "../../../node_modules";
// the views folder relative to the web app root
const viewsRoot = "./src/app/views";

const createServerConfig = (name) => merge(base, {
    target: "node",
    output: {
        path: path.resolve(__dirname, distAppRoot, "views", name),
        filename: "server-bundle.js",
        libraryTarget: "commonjs2"
    },
    externals: nodeExternals({
        modulesDir: path.resolve(__dirname, nodeModulesRoot),
        // TODO: currently need to include the @app packages because they are being generated as esnext modules and Vue SSR doesn't seem to support that 
        // - if this changes and they are being generated as commonjs modules then the @app packages can probably be removed from the whitelist
        whitelist: [/\.css$/, /\?vue&type=style/, /^@app\//]
    }),
    plugins: [
        new VueSSRServerPlugin({
            filename: "server-bundle.json"
        }),
        new webpack.DefinePlugin({
            "process.env.VUE_ENV": JSON.stringify("server")
        })
    ]
});

// create an array of webpack configs for each of the ssr server bundles
module.exports = () => views.bundles.ssrServer.map(item => merge(createServerConfig(item.name), { 
    entry: path.resolve(__dirname, appRoot, viewsRoot, item.entry) 
}));