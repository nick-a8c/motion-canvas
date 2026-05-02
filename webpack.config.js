const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

const configs = Array.isArray( defaultConfig ) ? defaultConfig : [ defaultConfig ];

module.exports = configs.map( ( config ) => {
	if ( ! config.entry || typeof config.entry !== 'function' ) {
		return config;
	}

	return {
		...config,
		entry: ( ...args ) => {
			const original = config.entry( ...args );
			return {
				...original,
				'motion-layout-builder/index': path.resolve(
					process.cwd(),
					'src/motion-layout-builder',
					'index.js'
				),
				'rive-spline-block/reveal': path.resolve(
					process.cwd(),
					'src/rive-spline-block',
					'reveal.js'
				),
			};
		},
	};
} );