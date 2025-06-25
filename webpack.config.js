const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');          // ← NEW

module.exports = {
  entry: {
    code: './src/code.ts',      // plugin backend
    // ui:   './src/ui/ui.ts'   // uncomment if you have TS for the UI
  },
  target: 'web',           // Figma plugin runtime behaves like a browser
  devtool: 'source-map',
  module: {
    rules: [
      { test: /\.html$/, loader: 'html-loader' },               // <-- new
      { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }
    ]
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    globalObject: 'this'                     // ← make webpack use `this`
  },
  plugins: [
    // prepend shim => defines self & importScripts before webpack runtime runs
    new webpack.BannerPlugin({
      raw: true,
      banner: `
/* Figma VM shim */
var self = (typeof globalThis !== 'undefined' ? globalThis : this);
if (typeof self.importScripts === 'undefined') self.importScripts = function () {};
`
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/ui', to: '.' } // copies src/ui/**/* → dist/
      ]
    })
  ]
};
