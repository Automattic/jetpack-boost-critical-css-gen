/**
 * Webpack configuration used with webpack-dev-middleware to serve
 * bundled version of this lib for testing.
 */

const webpack = require( 'webpack' );

module.exports = {
	entry: __dirname + '/main.ts',
	output: {
		filename: 'main.js',
	},
	module: {
		rules: [
			{
			  test: /\.ts?$/,
			  use: 'ts-loader',
			  exclude: /node_modules/,
			},
		],
	},
	target: 'web',
	performance: {
		hints: false,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000,
	},
	mode: 'production',
	resolve: {
		extensions: [ '.ts', '.js' ],
		alias: {
			process: 'process/browser',
		},
		fallback: {
			fs: false,
			http: require.resolve( 'stream-http' ),
			https: require.resolve( 'https-browserify' ),
			path: require.resolve( 'path-browserify' ),
			os: require.resolve( 'os-browserify/browser' ),
			url: false,
		}
	},
	optimization: {
		minimize: false,
	},
	plugins: [
		new webpack.ProvidePlugin( {
				process: 'process/browser',
		} ),
	],
	stats: 'errors-only',
};
