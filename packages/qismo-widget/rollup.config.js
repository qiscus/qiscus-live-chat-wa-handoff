import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

// Compile-time switch read by FullWidget.svelte: local origins (localhost,
// 127.0.0.1) are accepted as ?baseUrl= / ?iframeUrl= only in dev builds.
const defineDevBuild = () => ({
	name: 'define-dev-build',
	transform(code, id) {
		if (!id.endsWith('FullWidget.svelte')) return null;
		return { code: code.replace(/__QISMO_DEV_BUILD__/g, String(!production)), map: null };
	}
});

export default [
{
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'umd',
		name: 'Qismo',
		file: '../public/js/qismo-v5.js'
	},
	plugins: [
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file — better for performance
			css: css => {
				css.write('../public/css/qismo-v5.css');
			}
		}),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/plugins/tree/master/packages/commonjs
		resolve({
			browser: true,
			dedupe: importee => importee === 'svelte' || importee.startsWith('svelte/')
		}),
		commonjs(),

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('public'),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser()
	],
	watch: {
		clearScreen: false
	}
},
{
	// Bundle FULL — halaman chat berdiri sendiri: hanya iframe #qcw-iframe,
	// tanpa welcome/login/trigger. Dua jalur identitas: token invite (spec §3
	// langkah 7, handoff WA -> Live Chat, join room via /live-handover-room) atau
	// query/props (dev/demo, join room via /full-widget). Lihat kepala
	// FullWidget.svelte. Dipakai halaman qismo-widget/public/full.html DAN
	// sebagai snippet embed di panel Installation Code (Handoff to Live Chat).
	input: 'src/FullWidget.svelte',
	output: {
		sourcemap: true,
		format: 'umd',
		exports: 'default',
		name: 'QismoFull',
		file: '../public/js/qismo-full-v5.js'
	},
	plugins: [
		defineDevBuild(),
		svelte({ dev: !production }),
		resolve({
			browser: true,
			dedupe: importee => importee === 'svelte' || importee.startsWith('svelte/')
		}),
		commonjs(),
		production && terser()
	],
	watch: {
		clearScreen: false
	}
}
];

function serve() {
	let started = false;

	return {
		writeBundle() {
			if (!started) {
				started = true;

				require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
					stdio: ['ignore', 'inherit', 'inherit'],
					shell: true
				});
			}
		}
	};
}
