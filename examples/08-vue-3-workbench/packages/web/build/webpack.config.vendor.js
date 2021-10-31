const path = require("path");
const webpack = require("webpack");

const distPublic = "../dist/app/public";

module.exports = {
    entry: {
        vendor: [
            "vue", 
            "vue-i18n"
        ]
    },
    output: {
        path: path.resolve(__dirname, distPublic),
        filename: "[name]_[hash].js",
        library: "[name]_[hash]"
    },
    resolve: {
        alias: {
            "vue$": "vue/dist/vue.esm.js",
        }
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    "vue-style-loader", 
                    "css-loader"
                ]
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2)$/,
                loader: "url-loader"
            }
        ]
    },
    plugins: [
        new webpack.DllPlugin({
            name: "[name]_[hash]",
            path: path.resolve(__dirname, distPublic, "vendor.manifest.json")
        })
    ]
};