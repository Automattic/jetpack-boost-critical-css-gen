const express = require( 'express' );
const webpack = require( 'webpack' );
const webpackDevMiddleware = require( 'webpack-dev-middleware' );

/**
 * Test server with webpack middleware, used to test client-side / iframe version
 * of Critical CSS generation.
 */
class TestServer {

	constructor( staticPaths ) {
		this.port = null;
		this.app = null;
		this.server = null;
		this.middleware = null;
		this.staticPaths = staticPaths || [];
	}

	async start() {
		const compiler = webpack( require( '../data/webpack-wrap/webpack.config.js' ) );
		this.middleware = webpackDevMiddleware( compiler, { serverSideRender: true } );

		this.app = express();
		this.app.use( this.middleware );

		for ( const [ virtualPath, realDirectory ] of Object.entries( this.staticPaths ) ) {
			console.log( virtualPath, realDirectory );
			this.app.use( '/' + virtualPath, express.static( realDirectory ) )
		}

		this.app.use( ( req, res ) => res.send( '<html><head><script src="main.min.js"></script></head><body></body></html>' ) );

		return new Promise( ( resolve ) => {
			this.server = this.app.listen( () => {
				this.port = this.server.address().port;
				resolve();
			} );
		} );
	}

	async stop() {
		if ( this.middleware ) {
			this.middleware.close();
		}

		if ( this.app && this.server ) {
			this.server.close();
		}
	}

	getUrl() {
		return 'http://localhost:' + this.port;
	}

}

module.exports = TestServer;
