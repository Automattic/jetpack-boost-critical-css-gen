import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	output: [
		{
			sourcemap: true,
			format: 'iife',
			name: 'CriticalCSSGenerator',
			file: 'dist/bundle.js',
		},
		{
			sourcemap: true,
			format: 'iife',
			name: 'CriticalCSSGenerator',
			file: 'dist/bundle.min.js',
			plugins: [ terser() ],
		},
	],

	plugins: [
		resolve( { browser: true, preferBuiltins: false } ),
		typescript( {
			sourceMap: true,
			inlineSources: false,
		} ),
		commonjs( {
			transformMixedEsModules: true,
		} ),
		nodePolyfills(),
		json(),
	],
	watch: {
		clearScreen: false,
	},
};
