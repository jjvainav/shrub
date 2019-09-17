const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");
const views = require("./views.config").views;

// Bundles all the client-side JS

// __dirname will be point to ./build 
const appRoot = "../";
const distRoot = appRoot + "dist";
const distPublic = distRoot + "/public";
const viewsRoot = appRoot + "src/views";

const createClientConfig = (bundle) => ({
    entry: { 
        [bundle.name]: path.resolve(__dirname, viewsRoot, bundle.entry)
    },
    output: {
        path: path.resolve(__dirname, distPublic),
        publicPath: "/public/",
        filename: "[name].[chunkhash].js"
    },
    resolve: {
        extensions: [".js", ".vue"],
        alias: {
            "vue$": "vue/dist/vue.esm.js"
        }
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
    module: {
        rules: [{
            test: /\.vue$/,
            loader: "vue-loader"
        }]
    },
    plugins: [
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            // the output file
            filename: path.resolve(__dirname, distRoot, "views", bundle.template),
            // the html for the view
            template: path.resolve(__dirname, viewsRoot, bundle.template)
        })
    ]
});

// create an array of webpack configs for each view
module.exports = () => views.map(bundle => createClientConfig(bundle));