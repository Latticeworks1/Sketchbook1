const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        static: { directory: require('path').resolve(__dirname) },
        port: 8080,
        hot: false,
        liveReload: false,
    },
});
