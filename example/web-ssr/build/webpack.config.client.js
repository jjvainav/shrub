const HtmlWebpackExcludeAssetsPlugin = require("html-webpack-exclude-assets-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const VueSSRClientPlugin = require("vue-server-renderer/client-plugin");
const webpack = require("webpack");
const merge = require("webpack-merge");
const views = require("./views.config");
const base = require("./webpack.config.base.js");

// Bundles all the client-side JS

// __dirname will be ./example/web/build
const appRoot = "../";
const distRoot = appRoot + "dist";
const viewsRoot = appRoot + "src/views";

const createClientConfig = (bundle) => merge(base, {
    entry: { 
        [bundle.name]: path.resolve(__dirname, viewsRoot, bundle.entry)
    },
    optimization: {
        splitChunks: {
            cacheGroups: {
                common: {
                    chunks: "all",
                    test: /[\\/]node_modules[\\/]/
                }
            }
        },
        runtimeChunk: "single"
    },
    plugins: [
        new HtmlWebpackPlugin({
            // exclude the .js assets because they will get injected by vue SSR
            excludeAssets: [/.*.js/],
            // the output file
            filename: path.resolve(__dirname, distRoot, "views", bundle.template),
            // the html template for the view
            template: path.resolve(__dirname, viewsRoot, bundle.template)
        }),
        new HtmlWebpackExcludeAssetsPlugin(),
        new webpack.DefinePlugin({
            "process.env.VUE_ENV": JSON.stringify("client")
        })
    ]
});

// create an array of webpack configs for each of the ssr client bundles
module.exports = () => ([
    // create configs for ssr-clients
    ...views.bundles.ssrClient.map(bundle => merge(createClientConfig(bundle), { 
        plugins: [
            new VueSSRClientPlugin({
                filename: bundle.name + "-client-manifest.json"
            })
        ]
    }))
]);