(function(global) {
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
