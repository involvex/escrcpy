// https://vitepress.dev/guide/custom-theme
import Layout from './Layout.vue'
import './gtag/index.js'

import './overrides.css'
import './rainbow.css'
import './vars.css'

/** @type {import('vitepress').Theme} */
export default {
	Layout,
	enhanceApp({app, router, siteData}) {
		// ...
	},
}
