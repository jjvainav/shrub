const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
 
const appRoot = "./";
const distRoot = appRoot + "dist";
const distPublic = distRoot + "/public";

module.exports = {
    entry: { 
        test: path.resolve(__dirname, "src/public/main.js")
    },
    output: {
        path: path.resolve(__dirname, distPublic),
        publicPath: "/public/",
        filename: "[name].[chunkhash].js"
    },
    resolve: {
        extensions: [".js"]
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
            filename: path.resolve(__dirname, distPublic, "index.html"),
            // the input file
            template: path.resolve(__dirname, "src/public/index.html")
        })
    ]
};