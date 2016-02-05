'use strict'

const gulp = require('gulp')
const through2 = require('through2')
const gulpSequence = require('gulp-sequence')
const clean = require('gulp-rimraf')

gulp.task('clean', function () {
  return gulp.src('dist', {read: false})
    .pipe(clean({force: true}))
})

gulp.task('combine', function () {
  let files = {}
  let combine = through2.obj(function (file, enc, callback) {
    files[file.relative] = file
    callback()
  }, function (callback) {
    let target = files['router.js']
    let contents = target.contents.toString()
      .replace("'Trie_PLACEHOLDER'", () => toGracefulStr(files['trie.js'].contents))
      .replace("'History_PLACEHOLDER'", () => toGracefulStr(files['history.js'].contents))
    target.contents = new Buffer(contents)
    this.push(target)
    callback()
  })

  return gulp.src('src/*.js')
    .pipe(combine)
    .pipe(gulp.dest('./dist'))
})

function toGracefulStr (buf) {
  return buf.toString().replace(/^/gm, '  ').replace(/^\s+$/gm, '').trim()
}

gulp.task('default', gulpSequence('clean', 'combine'))
