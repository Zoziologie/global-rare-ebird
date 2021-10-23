// vue.config.js

/**
* @type {import('@vue/cli-service').ProjectOptions}
*/
/*
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require('path');
*/
module.exports = {
    runtimeCompiler:true,
    publicPath: process.env.NODE_ENV === 'production'
    ? '/global-rare-ebird/'
    : '/'
    /*entry: './src/main.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    configureWebpack: {
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, "src", "index.html")
            })
        ]
    }*/
  }