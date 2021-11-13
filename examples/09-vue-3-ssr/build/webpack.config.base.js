const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");

// when using __dirname to build a path this will 'back out' the path to the app root
const distPublic = "../dist/public";

module.exports = function (options) {
    const isServer = options && options.isServer;

    const rules = [{
        test: /\.vue$/,
        loader: "vue-loader",
        options: {
            compilerOptions: {
                whitespace: "condense"
            }
        }
    }];

    if (isServer) {
        rules.unshift({
            test: /\.(sa|sc|c)ss$/,
            // need to use vue-style-loader because 'style-loader' uses document
            // https://github.com/vuejs/vue-style-loader/issues/46#issuecomment-670624576
            use: [
                { loader: "vue-style-loader" },
                { 
                    loader: "css-loader",
                    options: { esModule: false } 
                },
                { loader: "sass-loader" }
            ]
        });
    }
    else{
        rules.unshift({
            test: /\.(sa|sc|c)ss$/,
            use: [
                { loader: "style-loader" },
                { loader: "css-loader" },
                { loader: "sass-loader" }
            ]
        });
    }

    return {
        output: {
            path: path.resolve(__dirname, distPublic),
            publicPath: "/public/",
            filename: "[name].[chunkhash].js"
        },
        resolve: {
            extensions: [".js", ".vue"],
            alias: {
                "vue$": "vue/dist/vue.esm-bundler.js"
            }
        },
        module: { rules },
        plugins: [
            new VueLoaderPlugin()
        ]
    };
}