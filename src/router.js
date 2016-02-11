// **Github:** https://github.com/teambition/hirouter
//
// **License:** MIT

import Trie from 'route-trie'
import History from './history'

class State {
  constructor (fragment) {
    let index = fragment.indexOf('?')
    index = index !== -1 ? index : fragment.length

    this.fragment = fragment
    this.pathName = fragment.slice(0, index)
    this.search = fragment.slice(index).replace(/#.*$/, '')
    this.params = null
  }
}

class HiRouter {
  constructor (root, options) {
    if (typeof root !== 'string') {
      root = ''
      options = root
    }
    this.root = root.replace(/^\//, '')
    this.otherwiseHandler = null
    this.trie = new Trie()
    this.history.route(this)
  }

  when (pattern, handler) {
    let node = this.trie.define(pattern)
    node.handler = checkHandler(handler)
    return this
  }

  otherwise (handler) {
    this.otherwiseHandler = checkHandler(handler)
    return this
  }

  route (fragment) {
    fragment = fragment.replace(/^\//, '')
    if (fragment.indexOf(this.root) !== 0) return false
    if (this.root.length > 1) fragment = fragment.slice(this.root.length)
    let state = this.parsePath(fragment)
    let matched = this.trie.match(state.pathName)
    if (matched) {
      state.params = matched.params
      matched.node.handler(state)
    } else if (this.otherwiseHandler) {
      this.otherwiseHandler(state)
    } else return false
    return true
  }

  navigate (fragment, options) {
    this.history.navigate(fragment, options)
    return this
  }

  parsePath (fragment) {
    return new State(fragment)
  }

  start (options) {
    this.history.start(options)
    return this
  }
}

function checkHandler (handler) {
  if (typeof handler === 'function') return handler
  throw new Error('handler must be a function.')
}

HiRouter.NAME = 'HiRouter'
HiRouter.VERSION = 'v0.2.0'
HiRouter.Trie = Trie
HiRouter.History = History
HiRouter.prototype.history = new History()

export default HiRouter
