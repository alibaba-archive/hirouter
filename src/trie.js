(function() {
  'use strict';
  // Trie router v1.0.0
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
    if (typeof pattern !== 'string')
      throw new TypeError('Only strings can be defined.');

    var _pattern = pattern
      .replace(multiSlashReg, '\/')
      .replace(trimSlashReg, '')
      .replace(EmptyBracketReg, '');

    var node = define(this.root, _pattern.split('/'), this.flags);
    if (node._nodeState.pattern == null) node._nodeState.pattern = pattern;

    return node;
  };

  Trie.prototype.match = function(path, multiMatch) {
    // the path should be normalized before match, just as path.normalize do in Node.js
    path = path
      .replace(multiSlashReg, '\/')
      .replace(trimSlashReg, '');

    var frag = '';
    var node = this.root;
    var frags = path.split('/');
    var result = {params: {}};

    if (multiMatch) result.nodes = [];

    while (frags.length) {
      node = matchNode(node, frags, result.params, this.flags);
      if (node) {
        if (multiMatch && node._nodeState.endpoint) result.nodes.push(node);
        continue;
      }
      if (!multiMatch) return null;
      break;
    }

    if (multiMatch) return result;
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

  function matchNode(node, frags, params, flags) {
    var frag = safeDecodeURIComponent(frags.shift());
    if (frag === false) return null;
    var nodeState = node._nodeState;

    var child = nodeState.childNodes[flags ? frag.toLowerCase() : frag];
    if (child) return child;

    for (var i = 0, len = nodeState.regexChildNodes.length; i < len; i++) {
      var regex = nodeState.regexChildNodes[i];
      if (regex[2] && !regex[2].test(frag)) continue;
      if (regex[0]._nodeState.matchRemaining) {
        while (frags.length) {
          var _frag = safeDecodeURIComponent(frags.shift());
          if (_frag === false) return null;
          frag += '/' + _frag;
        }
      }
      if (regex[1]) params[regex[1]] = frag;
      child = regex[0];
      break;
    }

    return child;
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
      else if (lastRegexChildNode && lastRegexChildNode._nodeState.matchRemaining)
        throw new Error('Can not define more regex pattern while "*" pattern defined');
      else {
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
