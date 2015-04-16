// **Github:** https://github.com/teambition/hirouter
//
// **License:** MIT

/* global module, define, setImmediate */
;(function(root, factory) {
  'use strict';
  var HiRouter = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = HiRouter;
  else if (typeof define === 'function' && define.amd) define([], function() { return HiRouter; });
  else root.HiRouter = HiRouter;
}(typeof window === 'object' ? window : this, function(root) {
  'use strict';

  function HiRouter(root, options) {
    if (!(this instanceof HiRouter)) return new HiRouter(root, options);
    if (typeof root !== 'string') {
      root = '';
      options = root;
    }
    this.root = root.replace(/^\//, '');
    this.trie = new _Trie();
    this.history.route(this);
  }

  HiRouter.prototype.when = function(pattern, handler) {
    var node = this.trie.define(pattern);
    node.handler = checkHandler(handler);
    return this;
  };

  HiRouter.prototype.otherwise = function(handler) {
    this.otherwiseHandler = checkHandler(handler);
    return this;
  };

  HiRouter.prototype.otherwiseHandler = null;

  HiRouter.prototype.route = function(fragment) {
    fragment = fragment.replace(/^\//, '');
    if (fragment.indexOf(this.root) !== 0) return false;
    if (this.root.length > 1) fragment = fragment.slice(this.root.length);
    var urlObj = this.parsePath(fragment);
    var matched = this.trie.match(urlObj.pathName);
    if (matched) {
      urlObj.params = matched.params;
      matched.node.handler(urlObj);
    } else if (this.otherwiseHandler) this.otherwiseHandler(urlObj);
    else return false;
    return true;
  };

  HiRouter.prototype.navigate = function(fragment, options) {
    this.history.navigate(fragment, options);
    return this;
  };

  HiRouter.prototype.parsePath = function(fragment) {
    var res = {fragment: fragment, pathName: '', search: ''};
    var index = fragment.indexOf('?');
    index = index !== -1 ? index : fragment.length;
    res.pathName = fragment.slice(0, index);
    res.search = fragment.slice(index).replace(/#.*$/, '');
    return res;
  };

  HiRouter.prototype.start = function(options) {
    this.history.start(options);
    return this;
  };

  function checkHandler(handler) {
    if (typeof handler === 'function') return handler;
    throw new Error('handler must be a function.');
  }

  var _Trie = (function() {
    'use strict';
    // Trie router
    // https://github.com/zensh/route-trie
    // ***************************************************************************

    var slugReg = /^[\w\.-]+$/;
    var parameterReg = /^\:\w+\b/;
    var multiSlashReg = /(\/){2,}/g;
    var trimSlashReg = /(^\/)|(\/$)/g;
    var EmptyBracketReg = /\(\)/g;

    function Trie(flags) {
      this.flags = flags ? 'i' : '';
      this.root = new Node('root');
    }

    Trie.prototype.define = function(pattern) {
      if (typeof pattern !== 'string') throw new TypeError('Only strings can be defined.');
      pattern = pattern
        .replace(multiSlashReg, '\/')
        .replace(trimSlashReg, '')
        .replace(EmptyBracketReg, '');

      return define(this.root, pattern.split('/'), this.flags);
    };

    Trie.prototype.match = function(path) {
      // the path should be normalized before match, just as path.normalize do in Node.js
      path = path
        .replace(multiSlashReg, '\/')
        .replace(trimSlashReg, '');
      var frags = path.split('/');
      var result = {
        params: {},
        node: null
      };
      var node = this.root;
      var child = null;
      var frag = '';

      while (frags.length) {
        frag = safeDecodeURIComponent(frags.shift());
        if (frag === false) return null;
        child = node._nodeState.childNodes[this.flags ? frag.toLowerCase() : frag];

        if (!child) {
          for (var i = 0, len = node._nodeState.regexChildNodes.length; i < len; i++) {
            var regex = node._nodeState.regexChildNodes[i];
            if (regex[2] && !regex[2].test(frag)) continue;
            if (regex[0]._nodeState.matchRemaining) {
              while (frags.length) {
                var _frag = safeDecodeURIComponent(frags.shift());
                if (_frag === false) return null;
                frag += '/' + _frag;
              }
            }
            if (regex[1]) result.params[regex[1]] = frag;
            child = regex[0];
            break;
          }
        }
        if (!child) return null;
        node = child;
      }
      if (!node._nodeState.endpoint) return null;

      result.node = node;
      return result;
    };

    function define(parentNode, frags, flags) {
      var frag = frags.shift();
      var child = parseNode(parentNode, frag, flags);
      if (!frags.length) {
        child._nodeState.endpoint = true;
        return child;
      }
      if (child._nodeState.matchRemaining) throw new Error('Can not define regex pattern after "*" pattern');
      return define(child, frags, flags);
    }

    function NodeState(frag, matchRemaining) {
      this.name = frag;
      this.endpoint = false;
      this.matchRemaining = matchRemaining;
      this.childNodes = Object.create(null);
      this.regexNames = Object.create(null);
      this.regexChildNodes = [];
    }

    function Node(frag, matchRemaining) {
      Object.defineProperty(this, '_nodeState', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: new NodeState(frag, matchRemaining)
      });
    }

    function parseNode(parentNode, frag, flags) {
      var node = null;
      var matchRemaining = false;
      var parameter = '';
      var childNodes = parentNode._nodeState.childNodes;
      var regexNames = parentNode._nodeState.regexNames;
      var regexChildNodes = parentNode._nodeState.regexChildNodes;
      var lastRegexChildNode = regexChildNodes[regexChildNodes.length - 1];

      lastRegexChildNode = lastRegexChildNode && lastRegexChildNode[0];

      // Is a simple string
      if (isValidSlug(frag)) {
        node = childNodes[frag] || new Node(frag);
        childNodes[frag] = node;
      } else {
        // Find a parameter name for the string
        frag = frag.replace(parameterReg, function(str) {
          parameter = str.slice(1);
          return '';
        });

        if (frag === '*' || frag === '(*)') {
          frag = '.*';
          matchRemaining = true;
        }

        if (frag) frag = wrapRegex(frag);

        if (regexNames[frag] >= 0) node = regexChildNodes[regexNames[frag]][0];
        else if (lastRegexChildNode && lastRegexChildNode._nodeState.matchRemaining) {
          throw new Error('Can not define more regex pattern while "*" pattern defined');
        } else {
          node = new Node(frag, matchRemaining);
          regexChildNodes.push([node, parameter, frag && new RegExp(frag, flags)]);
          regexNames[frag] = regexChildNodes.length - 1;
        }
      }

      return node;
    }

    function safeDecodeURIComponent(string) {
      try {
        return decodeURIComponent(string);
      } catch (err) {
        return false;
      }
    }

    function isValidSlug(str) {
      return str === '' || slugReg.test(str);
    }

    function wrapRegex(str) {
      return '^' + str.replace(/^\(?/, '(').replace(/\)?$/, ')') + '$';
    }

    Trie.safeDecodeURIComponent = safeDecodeURIComponent;
    return Trie;

  }());

  var _History = (function(global) {
    'use strict';
    /* global root */
    /* jshint -W107*/

    var hiS = global.history;
    var doC = global.document;
    var loC = global.location;
    var HistoryStarted = false;
    var hasOwnProperty = Object.prototype.hasOwnProperty;

    var addListener, removeListener;
    if (doC.addEventListener) {
      addListener = function(el, type, listener) {
        el.addEventListener(type, listener, false);
      };
      removeListener = function(el, type, listener) {
        el.removeEventListener(type, listener, false);
      };
    } else {
      addListener = function(el, type, listener) {
        el.attachEvent('on' + type, listener);
      };
      removeListener = function(el, type, listener) {
        el.detachEvent('on' + type, listener);
      };
    }

    // Modify from Backbone.History
    // ----------------
    function History() {
      this.options = {
        root: '/',
        hashChange: true,
        pushState: true,
        silent: false,
        interval: 50 // The default interval to poll for hash changes, if necessary.
      };
      this._handlers = [];
    }

    History.prototype.atRoot = function() {
      return loC.pathname.replace(/[^\/]$/, '$&/') === this.root;
    };

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    History.prototype.getHash = function(window) {
      var match = (window || global).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    };

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    History.prototype.getFragment = function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = decodeURI(loC.pathname + loC.search);
          var root = this.root.replace(/\/$/, '');
          if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
        } else fragment = this.getHash();
      }
      return fragment.replace(/^[#\/]|\s+$/g, '');
    };

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    History.prototype.start = function(options) {
      if (HistoryStarted) return;
      HistoryStarted = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      options = options || {};
      for (var key in this.options) {
        if (!hasOwnProperty.call(this.options, key)) continue;
        else if (hasOwnProperty.call(options, key)) this.options[key] = options[key];
      }

      this._wantsPushState = !!this.options.pushState;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasPushState = !!(this.options.pushState && hiS && hiS.pushState);
      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.options.root + '/').replace(/^\/+|\/+$/g, '/');

      var fragment = this.getFragment();
      var docMode = doC.documentMode;
      var oldIE = (/msie [\w.]+/.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      if (oldIE && this._wantsHashChange) {
        var iframe = doC.createElement('iframe');
        iframe.src = 'javascript:0';
        iframe.style.display = 'none';
        iframe.tabIndex = -1;
        doC.body.appendChild(iframe);
        this.iframe = iframe.contentWindow;
        this.navigate(fragment);
      }

      // Checks the current URL to see if it has changed, and if it has,
      // calls `loadUrl`, normalizing across the hidden iframe.
      var ctx = this;
      function checkUrl(e) {
        var current = ctx.getFragment();
        if (current === ctx.fragment && ctx.iframe)
          current = ctx.getFragment(ctx.getHash(ctx.iframe));
        if (current === ctx.fragment) return false;
        if (ctx.iframe) ctx.navigate(current);
        ctx.loadUrl();
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        addListener(global, 'popstate', checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in global) && !oldIE) {
        addListener(global, 'hashchange', checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(checkUrl, this.options.interval);
      }

      // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
      // but possibly useful for unit testing Routers.
      this.stop = function() {
        removeListener(global, 'popstate', checkUrl);
        removeListener(global, 'hashchange', checkUrl);
        if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
        HistoryStarted = false;
      };

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {
        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          this.fragment = this.getFragment(null, true);
          loC.replace(this.root + '#' + this.fragment);
          // Return immediately as browser will do redirect to new url
          return true;
          // Or if we've started out with a hash-based route, but we're currently
          // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot() && loC.hash) {
          this.fragment = this.getHash().replace(/^[#\/]|\s+$/g, '');
          hiS.replaceState({}, doC.title, this.root + this.fragment);
        }
      }
      if (!this.options.silent) return this.loadUrl();
    };

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    History.prototype.stop = function() {};

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    History.prototype.route = function(router) {
      this._handlers.push(router);
    };

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    History.prototype.loadUrl = function(fragment) {
      fragment = this.fragment = this.getFragment(fragment);
      var matched = false;
      for (var i = 0; i < this._handlers.length; i++)
        matched = this._handlers[i].route(fragment) || matched;
      return matched;
    };

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    History.prototype.navigate = function(fragment, options) {
      if (!HistoryStarted) return false;
      if (!options || options === true) options = {trigger: options};

      var url = this.root + (fragment = this.getFragment(fragment || ''));
      // Strip the hash for matching.
      fragment = fragment.replace(/#.*$/, '');
      if (this.fragment === fragment) return;
      this.fragment = fragment;
      // Don't include a trailing slash on the root.
      if (fragment === '' && url !== '/') url = url.slice(0, -1);

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        hiS[options.replace ? 'replaceState' : 'pushState']({}, doC.title, url);
      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(loC, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }
      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else return loC.assign(url);
      if (options.trigger !== false) return this.loadUrl(fragment);
    };

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    History.prototype._updateHash = function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    };

    return History;
  }(root));

  HiRouter.History = _History;
  HiRouter.prototype.history = new _History();

  HiRouter.NAME = 'HiRouter';
  HiRouter.VERSION = 'v0.1.0';
  return HiRouter;
}));
