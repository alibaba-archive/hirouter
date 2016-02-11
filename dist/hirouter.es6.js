import Trie from 'route-trie';

const WIN = window
const HIS = WIN.history
const DOC = WIN.document
const LOC = WIN.location
const hasOwnProperty = Object.prototype.hasOwnProperty

const addListener = DOC.addEventListener
  ? (el, type, listener) => el.addEventListener(type, listener, false)
  : (el, type, listener) => el.attachEvent('on' + type, listener)

const removeListener = DOC.addEventListener
  ? (el, type, listener) => el.removeEventListener(type, listener, false)
  : (el, type, listener) => el.detachEvent('on' + type, listener)

var HistoryStarted = false

// Modify from Backbone.History
// https://github.com/jashkenas/backbone
// ----------------

class History {
  constructor () {
    this.options = {
      root: '/',
      hashChange: true,
      pushState: true,
      silent: false,
      interval: 50 // The default interval to poll for hash changes, if necessary.
    }
    this._handlers = []
  }

  atRoot () {
    return LOC.pathname.replace(/[^\/]$/, '$&/') === this.root
  }

  // Gets the true hash value. Cannot use location.hash directly due to bug
  // in Firefox where location.hash will always be decoded.
  getHash (win) {
    let match = (win || WIN).location.href.match(/#(.*)$/)
    return match ? match[1] : ''
  }

  // Get the cross-browser normalized URL fragment, either from the URL,
  // the hash, or the override.
  getFragment (fragment, forcePushState) {
    if (fragment == null) {
      if (this._hasPushState || !this._wantsHashChange || forcePushState) {
        fragment = decodeURI(LOC.pathname + LOC.search)
        let root = this.root.replace(/\/$/, '')
        if (!fragment.indexOf(root)) fragment = fragment.slice(root.length)
      } else fragment = this.getHash()
    }
    return fragment.replace(/^[#\/]|\s+$/g, '')
  }

  // Start the hash change handling, returning `true` if the current URL matches
  // an existing route, and `false` otherwise.
  start (options) {
    if (HistoryStarted) return
    HistoryStarted = true

    // Figure out the initial configuration. Do we need an iframe?
    // Is pushState desired ... is it available?
    options = options || {}
    for (let key in this.options) {
      if (!hasOwnProperty.call(this.options, key)) continue
      else if (hasOwnProperty.call(options, key)) this.options[key] = options[key]
    }

    this._wantsPushState = !!this.options.pushState
    this._wantsHashChange = this.options.hashChange !== false
    this._hasPushState = !!(this.options.pushState && HIS && HIS.pushState)
    // Normalize root to always include a leading and trailing slash.
    this.root = ('/' + this.options.root + '/').replace(/^\/+|\/+$/g, '/')

    let fragment = this.getFragment()
    let docMode = DOC.documentMode
    let oldIE = (/msie [\w.]+/.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7))

    if (oldIE && this._wantsHashChange) {
      let iframe = DOC.createElement('iframe')
      iframe.src = 'javascript:0'
      iframe.style.display = 'none'
      iframe.tabIndex = -1
      DOC.body.appendChild(iframe)
      this.iframe = iframe.contentWindow
      this.navigate(fragment)
    }

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    let checkUrl = (e) => {
      let current = this.getFragment()
      if (current === this.fragment && this.iframe) current = this.getFragment(this.getHash(this.iframe))
      if (current === this.fragment) return false
      if (this.iframe) this.navigate(current)
      this.loadUrl()
    }

    // Depending on whether we're using pushState or hashes, and whether
    // 'onhashchange' is supported, determine how we check the URL state.
    if (this._hasPushState) {
      addListener(WIN, 'popstate', checkUrl)
    } else if (this._wantsHashChange && ('onhashchange' in WIN) && !oldIE) {
      addListener(WIN, 'hashchange', checkUrl)
    } else if (this._wantsHashChange) {
      this._checkUrlInterval = setInterval(checkUrl, this.options.interval)
    }

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    this.stop = () => {
      removeListener(WIN, 'popstate', checkUrl)
      removeListener(WIN, 'hashchange', checkUrl)
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval)
      HistoryStarted = false
    }

    // Determine if we need to change the base url, for a pushState link
    // opened by a non-pushState browser.
    this.fragment = fragment
    // Transition from hashChange to pushState or vice versa if both are
    // requested.
    if (this._wantsHashChange && this._wantsPushState) {
      // If we've started off with a route from a `pushState`-enabled
      // browser, but we're currently in a browser that doesn't support it...
      if (!this._hasPushState && !this.atRoot()) {
        this.fragment = this.getFragment(null, true)
        LOC.replace(this.root + '#' + this.fragment)
        // Return immediately as browser will do redirect to new url
        return true
      // Or if we've started out with a hash-based route, but we're currently
      // in a browser where it could be `pushState`-based instead...
      } else if (this._hasPushState && this.atRoot() && LOC.hash) {
        this.fragment = this.getHash().replace(/^[#\/]|\s+$/g, '')
        HIS.replaceState({}, DOC.title, this.root + this.fragment)
      }
    }
    if (!this.options.silent) return this.loadUrl()
  }

  // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
  // but possibly useful for unit testing Routers.
  stop () {}

  // Add a route to be tested when the fragment changes. Routes added later
  // may override previous routes.
  route (router) {
    this._handlers.push(router)
  }

  // Attempt to load the current URL fragment. If a route succeeds with a
  // match, returns `true`. If no defined routes matches the fragment,
  // returns `false`.
  loadUrl (fragment) {
    fragment = this.fragment = this.getFragment(fragment)
    for (let i = 0, len = this._handlers.length; i < len; i++) {
      if (this._handlers[i].route(fragment)) return true
    }
    return false
  }

  // Save a fragment into the hash history, or replace the URL state if the
  // 'replace' option is passed. You are responsible for properly URL-encoding
  // the fragment in advance.
  //
  // The options object can contain `trigger: true` if you wish to have the
  // route callback be fired (not usually desirable), or `replace: true`, if
  // you wish to modify the current URL without adding an entry to the history.
  navigate (fragment, options) {
    if (!HistoryStarted) return false
    if (!options || options === true) options = {trigger: options}

    let url = this.root + (fragment = this.getFragment(fragment || ''))
    // Strip the hash for matching.
    fragment = fragment.replace(/#.*$/, '')
    if (this.fragment === fragment) return
    this.fragment = fragment
    // Don't include a trailing slash on the root.
    if (fragment === '' && url !== '/') url = url.slice(0, -1)

    // If pushState is available, we use it to set the fragment as a real URL.
    if (this._hasPushState) {
      HIS[options.replace ? 'replaceState' : 'pushState']({}, DOC.title, url)
    // If hash changes haven't been explicitly disabled, update the hash
    // fragment to store history.
    } else if (this._wantsHashChange) {
      this._updateHash(LOC, fragment, options.replace)
      if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
        // Opening and closing the iframe tricks IE7 and earlier to push a
        // history entry on hash-tag change.  When replace is true, we don't
        // want this.
        if (!options.replace) this.iframe.document.open().close()
        this._updateHash(this.iframe.location, fragment, options.replace)
      }
    // If you've told us that you explicitly don't want fallback hashchange-
    // based history, then `navigate` becomes a page refresh.
    } else return LOC.assign(url)
    if (options.trigger !== false) return this.loadUrl(fragment)
  }

  // Update the hash location, either replacing the current entry, or adding
  // a new one to the browser history.
  _updateHash (location, fragment, replace) {
    if (replace) {
      let href = location.href.replace(/(javascript:|#).*$/, '')
      location.replace(href + '#' + fragment)
    } else {
      // Some browsers require that `hash` contains a leading #.
      location.hash = '#' + fragment
    }
  }
}

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

export default HiRouter;