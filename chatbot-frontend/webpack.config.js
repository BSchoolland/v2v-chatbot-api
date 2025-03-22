const path = require('path');

module.exports = {
  entry: './src/component.js',
  output: {
    filename: 'chatbot.min.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'eval-source-map',
  watch: process.env.NODE_ENV !== 'production',
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: 'css-loader',
            options: {
              exportType: 'string'
            }
          }
        ],
      },
      {
        test: /\.html$/,
        use: 'raw-loader',
      },
      {
        test: /\.(png|jpg|gif)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192, // Convert images < 8kb to base64 strings
              encoding: true
            },
          },
        ],
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
              encoding: true,
              mimetype: 'image/svg+xml'
            },
          },
        ],
      },
    ],
  },
}; 