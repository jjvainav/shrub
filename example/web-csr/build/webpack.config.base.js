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
        rules: [
            {
                test: /\.css$/,
                use: [
                    "vue-style-loader", 
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
                test: /\.md$/,
                use: "raw-loader"
            },
            {
                test: /\.vue$/,
                loader: "vue-loader",
                options: {
                    compilerOptions: {
                        whitespace: "condense"
                    }
                }
            }
        ]
    },
    plugins: [
        new VueLoaderPlugin()
    ]
};