import config from './rollup.config'
import nodeResolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'

config.format = 'umd'
config.dest = 'dist/hirouter.js'
config.moduleName = 'HiRouter'
config.plugins.push(nodeResolve({jsnext: true, main: true}), babel())

export default config
