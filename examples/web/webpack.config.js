"use strict";

const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");

module.exports = {
    entry: {
        app: ["./src/public/js/app.js"]
    },
    output: {
        path: path.resolve(__dirname, "dist", "public", "js"),
        publicPath: "/js/",
        filename: "[name].bundle.js"
    },
    resolve: {
        extensions: [".js"],
        alias: {
            "vue$": "vue/dist/vue.esm.js"
        }
    },
    module: {
        rules: [
            {
                // note: for production look into using the mini-css-extract plugin so that the style loaders
                // aren't included in the bundle: https://stackoverflow.com/questions/53270649/why-webpack4-production-bundle-will-always-include-style-loader-css-loader-and
                test: /\.css$/,
                use: [
                    "style-loader", 
                    "css-loader"
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    "vue-style-loader", 
                    "css-loader", 
                    "sass-loader"
                ]
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2)$/,
                loader: "url-loader"
            },
            {
                test: /\.vue$/,
                loader: "vue-loader"
            }
        ]
    },
    plugins: [
        new VueLoaderPlugin()
      ]
};