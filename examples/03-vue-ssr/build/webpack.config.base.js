const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");

// when using __dirname to build a path this will 'back out' the path to the app root
const distPublic = "../dist/public";

module.exports = {
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
    module: {
        rules: [{
            test: /\.vue$/,
            loader: "vue-loader",
            options: {
                compilerOptions: {
                    whitespace: "condense"
                }
            }
        }]
    },
    plugins: [
        new VueLoaderPlugin()
    ]
};