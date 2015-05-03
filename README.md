HiRouter
====
HTML5 history and router, simple, powerful and no framework.

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

**It is a implementation of [route-trie](https://github.com/zensh/route-trie)**

## Demo

```js
var HiRouter = require('hirouter');
var router = new HiRouter();

// define router handler:
router
  .when('/projects/:id', function(state) {
    // body...
    console.log(state)
    // {
    //   fragment: '/projects/xxxxxxxId?debug=true',
    //   pathName: '/projects/xxxxxxxId',
    //   search: '?debug=true',
    //   params: {
    //     id: 'xxxxxxxId'
    //   }
    // }
  })
  .when('/organizations/:id', function(state) {
    // body...
    console.log(state)
  })
  .otherwise(function(state) {
    // body...
  })
// start listen
router.start();

// navigate to a url
router.navigate('/organizations/xxxId')

// navigate to a url and don't trigger route handler
router.navigate('/organizations/xxxId', {trigger: false})
```

## API

### new HiRouter(rootPath, options)
### HiRouter.prototype.when(pattern, handler)
### HiRouter.prototype.otherwise(handler)
### HiRouter.prototype.navigate(fragment, options)
### HiRouter.prototype.start(options)
### HiRouter.prototype.route(fragment)
### HiRouter.prototype.parsePath(fragment)

### Object: HiRouter.prototype.history

[npm-url]: https://npmjs.org/package/hirouter
[npm-image]: http://img.shields.io/npm/v/hirouter.svg

[travis-url]: https://travis-ci.org/teambition/hirouter
[travis-image]: http://img.shields.io/travis/teambition/hirouter.svg
