const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackTagsPlugin = require("html-webpack-tags-plugin");
const path = require("path");
const webpack = require("webpack");
const merge = require("webpack-merge");
const views = require("./views.config");
const base = require("./webpack.config.base.js");

// Bundles all the client-side JS

// __dirname will be ./examples/web/build
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
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            // the output file
            filename: path.resolve(__dirname, distRoot, "views", bundle.template),
            // the html template for the view
            template: path.resolve(__dirname, viewsRoot, bundle.template)
        }),
        new HtmlWebpackTagsPlugin({
            tags: [{ path: "", glob: "vendor_*.js", globPath: path.resolve(__dirname, distRoot, "public") }],
            append: false
        }),
        new webpack.DllReferencePlugin({
            manifest: path.resolve(__dirname, distRoot, "public/vendor.manifest.json")
        })
    ]
});

// create an array of webpack configs for each of the csr client bundles
module.exports = () => views.bundles.csrClient.map(bundle => createClientConfig(bundle));