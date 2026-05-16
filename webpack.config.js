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
				'reveal-controls/index': path.resolve(
					process.cwd(),
					'src/reveal-controls',
					'index.js'
				),
				'motion/reveal': path.resolve(
					process.cwd(),
					'src/motion',
					'reveal.js'
				),
			};
		},
	};
} );