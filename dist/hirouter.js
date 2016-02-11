(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.HiRouter = factory());
}(this, function () { 'use strict';

  var babelHelpers = {};

  babelHelpers.classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  babelHelpers.createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  babelHelpers;

  // **Github:** https://github.com/zensh/route-trie
  //
  // **License:** MIT

  var sepReg = /\|/;
  var multiSlashReg = /(\/){2,}/;
  var maybeRegex = /[?^{}()|[\]\\]/;
  var regexReg = /^([^\(\n\r\u2028\u2029]*)(\(.+\))$/;
  var parameterReg = /^(.*)(\:\w+\b)(.*)$/;
  var escapeReg = /[.*+?^${}()|[\]\\]/g;
  var trimSlashReg = /(^\/)|(\/$)/g;

  var Node = function Node(parentNode, frag, matchRemains) {
    babelHelpers.classCallCheck(this, Node);

    Object.defineProperty(this, '_nodeState', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: new NodeState(parentNode, frag, matchRemains)
    });
  };

  var NodeState = function NodeState(parentNode, frag, matchRemains) {
    babelHelpers.classCallCheck(this, NodeState);

    this.name = frag;
    this.pattern = null;
    this.endpoint = false;
    this.parentNode = parentNode;
    this.matchRemains = !!matchRemains;
    this.childNodes = Object.create(null);
    this.regexNames = Object.create(null);
    this.regexNodes = [];
  };

  var RegexNode = function RegexNode(node, prefix, param, regex) {
    babelHelpers.classCallCheck(this, RegexNode);

    this.node = node;
    this.prefix = prefix || '';
    this.param = param || '';
    this.regex = regex || null;
  };

  var TrieMatched = function TrieMatched() {
    babelHelpers.classCallCheck(this, TrieMatched);

    this.node = null;
    this.nodes = [];
    this.params = {};
  };

  var Trie = function () {
    function Trie(flags) {
      babelHelpers.classCallCheck(this, Trie);

      this.flags = flags ? 'i' : '';
      this.root = new Node(null, 'root');
    }

    babelHelpers.createClass(Trie, [{
      key: 'define',
      value: function define(pattern) {
        if (typeof pattern !== 'string') throw new TypeError('Pattern must be string.');
        if (multiSlashReg.test(pattern)) throw new Error('Multi-slash exist.');

        var _pattern = pattern.replace(trimSlashReg, '');
        var node = _define(this.root, _pattern.split('/'), this.flags);

        if (node._nodeState.pattern == null) node._nodeState.pattern = pattern;
        return node;
      }
    }, {
      key: 'match',
      value: function match(path, multiMatch) {
        // the path should be normalized before match, just as path.normalize do in Node.js
        if (typeof path !== 'string') throw new TypeError('Path must be string.');
        path = path.replace(trimSlashReg, '');

        var node = this.root;
        var frags = path.split('/');
        var matched = new TrieMatched();

        while (frags.length) {
          node = matchNode(node, frags, matched.params, this.flags);
          // matched
          if (node) {
            if (multiMatch && node._nodeState.endpoint) matched.nodes.push(node);
            continue;
          }
          // not match
          return multiMatch ? matched : null;
        }

        matched.node = node;
        if (!multiMatch && !node._nodeState.endpoint) return null;
        return matched;
      }
    }]);
    return Trie;
  }();

  function _define(parentNode, frags, flags) {
    var frag = frags.shift();
    var child = parseNode(parentNode, frag, flags);

    if (!frags.length) {
      child._nodeState.endpoint = true;
      return child;
    }
    if (child._nodeState.matchRemains) {
      throw new Error('Can not define regex pattern after "(*)" pattern.');
    }
    return _define(child, frags, flags);
  }

  function matchNode(node, frags, params, flags) {
    var frag = safeDecodeURIComponent(frags.shift());
    if (frag === false) return null;

    var childNodes = node._nodeState.childNodes;
    var child = childNodes[flags ? frag.toLowerCase() : frag];
    if (child) return child;

    var regexNodes = node._nodeState.regexNodes;

    for (var fragCopy, regexNode, i = 0, len = regexNodes.length; i < len; i++) {
      fragCopy = frag;
      regexNode = regexNodes[i];

      if (regexNode.prefix) {
        if (fragCopy.indexOf(regexNode.prefix) !== 0) continue;
        fragCopy = fragCopy.slice(regexNode.prefix.length);
      }

      if (regexNode.regex && !regexNode.regex.test(fragCopy)) continue;
      if (regexNode.node._nodeState.matchRemains) {
        while (frags.length) {
          var remain = safeDecodeURIComponent(frags.shift());
          if (remain === false) return null;
          fragCopy += '/' + remain;
        }
      }
      if (regexNode.param) params[regexNode.param] = fragCopy;
      child = regexNode.node;
      break;
    }

    return child;
  }

  function parseNode(parentNode, frag, flags) {
    var res = null;
    var regex = '';
    var prefix = '';
    var parameter = '';
    var matchRemains = false;
    var childNodes = parentNode._nodeState.childNodes;
    var regexNames = parentNode._nodeState.regexNames;
    var regexNodes = parentNode._nodeState.regexNodes;

    if (childNodes[frag]) return childNodes[frag];
    checkMatchRegex(frag, '', parentNode._nodeState);

    if (res = parameterReg.exec(frag)) {
      // case: `prefix:name(regex)`
      prefix = res[1];
      parameter = res[2].slice(1);
      regex = res[3];
      if (regex && !regexReg.test(regex)) {
        throw new Error('Can not parse "' + regex + '" as regex pattern');
      }
    } else if (res = regexReg.exec(frag)) {
      // case: `prefix(regex)`
      prefix = res[1];
      regex = res[2];
    } else if (sepReg.test(frag)) {
      // case: `a|b|c`
      regex = wrapSepExp(frag);
    } else if (maybeRegex.test(frag)) {
      throw new Error('Can not parse "' + frag + '"');
    } else {
      // case: other simple string node
      childNodes[frag] = new Node(parentNode, frag);
      return childNodes[frag];
    }

    if (regex === '(*)') {
      regex = '(.*)';
      matchRemains = true;
    }

    if (regex) regex = '^' + regex + '$';
    // normalize frag as regex node name
    var regexName = prefix + ':' + regex;
    // if regex node exist
    if (regexNames[regexName]) return regexNodes[regexNames[regexName]].node;

    if (prefix) checkMatchRegex(frag, prefix, parentNode._nodeState);
    var node = new Node(parentNode, regexName, matchRemains);
    if (regex) regex = new RegExp(regex, flags);
    regexNames[regexName] = '' + regexNodes.length;
    regexNodes.push(new RegexNode(node, prefix, parameter, regex));
    return node;
  }

  function checkMatchRegex(frag, prefix, parentNodeState) {
    var regexNode = parentNodeState.regexNames[prefix + ':^(.*)$'];
    if (regexNode) {
      var pattern = parentNodeState.regexNodes[regexNode].node._nodeState.pattern;
      throw new Error('Can not define "' + frag + '" after "' + pattern + '".');
    }
  }

  function wrapSepExp(str) {
    var res = str.split('|');
    for (var i = 0, len = res.length; i < len; i++) {
      if (!res[i]) throw new Error('Can not parse "' + str + '" as separated pattern');
      res[i] = res[i].replace(escapeReg, '\\$&');
    }
    return '(' + res.join('|') + ')';
  }

  function safeDecodeURIComponent(string) {
    try {
      return decodeURIComponent(string);
    } catch (err) {
      return false;
    }
  }

  Trie.NAME = 'Trie';
  Trie.VERSION = 'v1.2.4';
  Trie.safeDecodeURIComponent = safeDecodeURIComponent;

  var WIN = window;
  var HIS = WIN.history;
  var DOC = WIN.document;
  var LOC = WIN.location;
  var hasOwnProperty = Object.prototype.hasOwnProperty;

  var addListener = DOC.addEventListener ? function (el, type, listener) {
    return el.addEventListener(type, listener, false);
  } : function (el, type, listener) {
    return el.attachEvent('on' + type, listener);
  };

  var removeListener = DOC.addEventListener ? function (el, type, listener) {
    return el.removeEventListener(type, listener, false);
  } : function (el, type, listener) {
    return el.detachEvent('on' + type, listener);
  };

  var HistoryStarted = false;

  // Modify from Backbone.History
  // https://github.com/jashkenas/backbone
  // ----------------

  var History = function () {
    function History() {
      babelHelpers.classCallCheck(this, History);

      this.options = {
        root: '/',
        hashChange: true,
        pushState: true,
        silent: false,
        interval: 50 // The default interval to poll for hash changes, if necessary.
      };
      this._handlers = [];
    }

    babelHelpers.createClass(History, [{
      key: 'atRoot',
      value: function atRoot() {
        return LOC.pathname.replace(/[^\/]$/, '$&/') === this.root;
      }

      // Gets the true hash value. Cannot use location.hash directly due to bug
      // in Firefox where location.hash will always be decoded.

    }, {
      key: 'getHash',
      value: function getHash(win) {
        var match = (win || WIN).location.href.match(/#(.*)$/);
        return match ? match[1] : '';
      }

      // Get the cross-browser normalized URL fragment, either from the URL,
      // the hash, or the override.

    }, {
      key: 'getFragment',
      value: function getFragment(fragment, forcePushState) {
        if (fragment == null) {
          if (this._hasPushState || !this._wantsHashChange || forcePushState) {
            fragment = decodeURI(LOC.pathname + LOC.search);
            var root = this.root.replace(/\/$/, '');
            if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
          } else fragment = this.getHash();
        }
        return fragment.replace(/^[#\/]|\s+$/g, '');
      }

      // Start the hash change handling, returning `true` if the current URL matches
      // an existing route, and `false` otherwise.

    }, {
      key: 'start',
      value: function start(options) {
        var _this = this;

        if (HistoryStarted) return;
        HistoryStarted = true;

        // Figure out the initial configuration. Do we need an iframe?
        // Is pushState desired ... is it available?
        options = options || {};
        for (var key in this.options) {
          if (!hasOwnProperty.call(this.options, key)) continue;else if (hasOwnProperty.call(options, key)) this.options[key] = options[key];
        }

        this._wantsPushState = !!this.options.pushState;
        this._wantsHashChange = this.options.hashChange !== false;
        this._hasPushState = !!(this.options.pushState && HIS && HIS.pushState);
        // Normalize root to always include a leading and trailing slash.
        this.root = ('/' + this.options.root + '/').replace(/^\/+|\/+$/g, '/');

        var fragment = this.getFragment();
        var docMode = DOC.documentMode;
        var oldIE = /msie [\w.]+/.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7);

        if (oldIE && this._wantsHashChange) {
          var iframe = DOC.createElement('iframe');
          iframe.src = 'javascript:0';
          iframe.style.display = 'none';
          iframe.tabIndex = -1;
          DOC.body.appendChild(iframe);
          this.iframe = iframe.contentWindow;
          this.navigate(fragment);
        }

        // Checks the current URL to see if it has changed, and if it has,
        // calls `loadUrl`, normalizing across the hidden iframe.
        var checkUrl = function checkUrl(e) {
          var current = _this.getFragment();
          if (current === _this.fragment && _this.iframe) current = _this.getFragment(_this.getHash(_this.iframe));
          if (current === _this.fragment) return false;
          if (_this.iframe) _this.navigate(current);
          _this.loadUrl();
        };

        // Depending on whether we're using pushState or hashes, and whether
        // 'onhashchange' is supported, determine how we check the URL state.
        if (this._hasPushState) {
          addListener(WIN, 'popstate', checkUrl);
        } else if (this._wantsHashChange && 'onhashchange' in WIN && !oldIE) {
          addListener(WIN, 'hashchange', checkUrl);
        } else if (this._wantsHashChange) {
          this._checkUrlInterval = setInterval(checkUrl, this.options.interval);
        }

        // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
        // but possibly useful for unit testing Routers.
        this.stop = function () {
          removeListener(WIN, 'popstate', checkUrl);
          removeListener(WIN, 'hashchange', checkUrl);
          if (_this._checkUrlInterval) clearInterval(_this._checkUrlInterval);
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
            LOC.replace(this.root + '#' + this.fragment);
            // Return immediately as browser will do redirect to new url
            return true;
            // Or if we've started out with a hash-based route, but we're currently
            // in a browser where it could be `pushState`-based instead...
          } else if (this._hasPushState && this.atRoot() && LOC.hash) {
              this.fragment = this.getHash().replace(/^[#\/]|\s+$/g, '');
              HIS.replaceState({}, DOC.title, this.root + this.fragment);
            }
        }
        if (!this.options.silent) return this.loadUrl();
      }

      // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
      // but possibly useful for unit testing Routers.

    }, {
      key: 'stop',
      value: function stop() {}

      // Add a route to be tested when the fragment changes. Routes added later
      // may override previous routes.

    }, {
      key: 'route',
      value: function route(router) {
        this._handlers.push(router);
      }

      // Attempt to load the current URL fragment. If a route succeeds with a
      // match, returns `true`. If no defined routes matches the fragment,
      // returns `false`.

    }, {
      key: 'loadUrl',
      value: function loadUrl(fragment) {
        fragment = this.fragment = this.getFragment(fragment);
        for (var i = 0, len = this._handlers.length; i < len; i++) {
          if (this._handlers[i].route(fragment)) return true;
        }
        return false;
      }

      // Save a fragment into the hash history, or replace the URL state if the
      // 'replace' option is passed. You are responsible for properly URL-encoding
      // the fragment in advance.
      //
      // The options object can contain `trigger: true` if you wish to have the
      // route callback be fired (not usually desirable), or `replace: true`, if
      // you wish to modify the current URL without adding an entry to the history.

    }, {
      key: 'navigate',
      value: function navigate(fragment, options) {
        if (!HistoryStarted) return false;
        if (!options || options === true) options = { trigger: options };

        var url = this.root + (fragment = this.getFragment(fragment || ''));
        // Strip the hash for matching.
        fragment = fragment.replace(/#.*$/, '');
        if (this.fragment === fragment) return;
        this.fragment = fragment;
        // Don't include a trailing slash on the root.
        if (fragment === '' && url !== '/') url = url.slice(0, -1);

        // If pushState is available, we use it to set the fragment as a real URL.
        if (this._hasPushState) {
          HIS[options.replace ? 'replaceState' : 'pushState']({}, DOC.title, url);
          // If hash changes haven't been explicitly disabled, update the hash
          // fragment to store history.
        } else if (this._wantsHashChange) {
            this._updateHash(LOC, fragment, options.replace);
            if (this.iframe && fragment !== this.getFragment(this.getHash(this.iframe))) {
              // Opening and closing the iframe tricks IE7 and earlier to push a
              // history entry on hash-tag change.  When replace is true, we don't
              // want this.
              if (!options.replace) this.iframe.document.open().close();
              this._updateHash(this.iframe.location, fragment, options.replace);
            }
            // If you've told us that you explicitly don't want fallback hashchange-
            // based history, then `navigate` becomes a page refresh.
          } else return LOC.assign(url);
        if (options.trigger !== false) return this.loadUrl(fragment);
      }

      // Update the hash location, either replacing the current entry, or adding
      // a new one to the browser history.

    }, {
      key: '_updateHash',
      value: function _updateHash(location, fragment, replace) {
        if (replace) {
          var href = location.href.replace(/(javascript:|#).*$/, '');
          location.replace(href + '#' + fragment);
        } else {
          // Some browsers require that `hash` contains a leading #.
          location.hash = '#' + fragment;
        }
      }
    }]);
    return History;
  }();

  var State = function State(fragment) {
    babelHelpers.classCallCheck(this, State);

    var index = fragment.indexOf('?');
    index = index !== -1 ? index : fragment.length;

    this.fragment = fragment;
    this.pathName = fragment.slice(0, index);
    this.search = fragment.slice(index).replace(/#.*$/, '');
    this.params = null;
  };

  var HiRouter = function () {
    function HiRouter(root, options) {
      babelHelpers.classCallCheck(this, HiRouter);

      if (typeof root !== 'string') {
        root = '';
        options = root;
      }
      this.root = root.replace(/^\//, '');
      this.otherwiseHandler = null;
      this.trie = new Trie();
      this.history.route(this);
    }

    babelHelpers.createClass(HiRouter, [{
      key: 'when',
      value: function when(pattern, handler) {
        var node = this.trie.define(pattern);
        node.handler = checkHandler(handler);
        return this;
      }
    }, {
      key: 'otherwise',
      value: function otherwise(handler) {
        this.otherwiseHandler = checkHandler(handler);
        return this;
      }
    }, {
      key: 'route',
      value: function route(fragment) {
        fragment = fragment.replace(/^\//, '');
        if (fragment.indexOf(this.root) !== 0) return false;
        if (this.root.length > 1) fragment = fragment.slice(this.root.length);
        var state = this.parsePath(fragment);
        var matched = this.trie.match(state.pathName);
        if (matched) {
          state.params = matched.params;
          matched.node.handler(state);
        } else if (this.otherwiseHandler) {
          this.otherwiseHandler(state);
        } else return false;
        return true;
      }
    }, {
      key: 'navigate',
      value: function navigate(fragment, options) {
        this.history.navigate(fragment, options);
        return this;
      }
    }, {
      key: 'parsePath',
      value: function parsePath(fragment) {
        return new State(fragment);
      }
    }, {
      key: 'start',
      value: function start(options) {
        this.history.start(options);
        return this;
      }
    }]);
    return HiRouter;
  }();

  function checkHandler(handler) {
    if (typeof handler === 'function') return handler;
    throw new Error('handler must be a function.');
  }

  HiRouter.NAME = 'HiRouter';
  HiRouter.VERSION = 'v0.2.0';
  HiRouter.Trie = Trie;
  HiRouter.History = History;
  HiRouter.prototype.history = new History();

  return HiRouter;

}));