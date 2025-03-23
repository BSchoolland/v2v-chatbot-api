const path = require('path');
// mode is passed in from the command line
const mode = process.argv[3] || 'development';
console.log('mode', mode);

module.exports = {
  entry: './src/component.js',
  output: {
    filename: 'chatbot.min.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: mode,
  devtool: mode === 'production' ? false : 'eval-source-map',
  watch: mode !== 'production',
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