const path = require('path');

module.exports = {
  entry: './trade.js',        // 你的主程式檔
  output: {
    filename: 'bundle.js',    // 打包後輸出檔名
    path: path.resolve(__dirname, 'dist'), // 輸出資料夾
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false, 
        },
      },
    ],
  },
};