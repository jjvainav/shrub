const path = require("path");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const { merge } = require("webpack-merge");
const nodeExternals = require("webpack-node-externals");
const views = require("./views.config");
const base = require("./webpack.config.base.js");

// Bundles all the server-side SSR javascript stuff.

// the web app root folder relative to __dirname
const appRoot = "../";
// root to app in the dist folder
const distAppRoot = appRoot + "dist";
// the main node_modules folder at the root of the repo relative to __dirname
const nodeModulesRoot = "../node_modules";
// the views folder relative to the web app root
const viewsRoot = "./src/views";

const createServerConfig = (bundle) => merge(base({ isServer: true }), {
    entry: { app: path.resolve(__dirname, appRoot, viewsRoot, bundle.entry) },
    target: "node",
    output: {
        path: path.resolve(__dirname, distAppRoot, "views", bundle.name),
        filename: "manifest.js",
        publicPath: "",
        libraryTarget: "commonjs2"
    },
    externals: nodeExternals({
        modulesDir: path.resolve(__dirname, nodeModulesRoot),
        allowlist: [/\.(sa|sc|c)ss$/, /\?vue&type=style/]
    }),
    plugins: [
        new WebpackManifestPlugin({
            fileName: "manifest.json"
        })
    ]
});

// create an array of webpack configs for each of the ssr server bundles
module.exports = () => views.bundles.ssrServer.map(bundle => createServerConfig(bundle));