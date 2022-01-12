import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
	input: 'index.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'CriticalCSSGenerator',
		file: 'dist/bundle.js',
	},

	plugins: [
		resolve( { browser: true, preferBuiltins: false } ),
		commonjs( {
			transformMixedEsModules: true,
		} ),
		nodePolyfills(),
		json(),
		terser(),
	],
	watch: {
		clearScreen: false,
	},
};
