const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const { merge } = require("webpack-merge");
const views = require("./views.config");
const base = require("./webpack.config.base.js");

// Bundles all the client-side JS

// __dirname will be point to ./build 
const appRoot = "../";
const distRoot = appRoot + "dist";
const viewsRoot = appRoot + "src/views";

const createClientConfig = (bundle) => merge(base(), {
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
            // the output file
            filename: path.resolve(__dirname, distRoot, "views", bundle.template),
            // the html template for the view
            template: path.resolve(__dirname, viewsRoot, bundle.template)
        })
    ]
});

// create an array of webpack configs for each of the ssr client bundles
module.exports = () => views.bundles.ssrClient.map(bundle => createClientConfig(bundle));