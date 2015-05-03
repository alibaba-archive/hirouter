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
    } else if (this.otherwiseHandler)
      this.otherwiseHandler(urlObj);
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

  var _Trie = "Trie_PLACEHOLDER";

  var _History = "History_PLACEHOLDER";

  HiRouter.History = _History;
  HiRouter.prototype.history = new _History();

  HiRouter.NAME = 'HiRouter';
  HiRouter.VERSION = 'v0.1.2';
  return HiRouter;
}));
