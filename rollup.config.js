import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import typescript from '@rollup/plugin-typescript';

export default {
	input: 'index.ts',
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
		typescript( {
			sourceMap: true,
			inlineSources: false,
		} ),
		nodePolyfills(),
		json(),
		terser(),
	],
	watch: {
		clearScreen: false,
	},
};
