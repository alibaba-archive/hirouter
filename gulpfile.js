'use strict';

var gulp = require('gulp');
var through2 = require('through2');
var gulpSequence = require('gulp-sequence');
var jshint = require('gulp-jshint');
var clean = require('gulp-rimraf');

gulp.task('clean', function() {
  return gulp.src('dist', {read: false})
  .pipe(clean({force: true}));
});

gulp.task('jshint', function() {
  return gulp.src(['gulpfile.js', 'src/*.js', 'examples/*.js', 'test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('combine', function() {
  var files = {};
  var combine = through2.obj(function(file, enc, callback) {
    files[file.relative] = file;
    callback();
  }, function(callback) {
    var target = files['router.js'];
    var contents = target.contents.toString()
      .replace('"Trie_PLACEHOLDER";', function() {
        return toGracefulStr(files['trie.js'].contents);
      })
      .replace('"History_PLACEHOLDER";', function() {
        return toGracefulStr(files['history.js'].contents);
      });
    target.contents = new Buffer(contents);
    this.push(target);
    callback();
  });

  return gulp.src('src/*.js')
    .pipe(combine)
    .pipe(gulp.dest('./dist'));
});

function toGracefulStr(buf) {
  return buf.toString().replace(/^/gm, '  ').replace(/^\s+$/gm, '').trim();
}

gulp.task('default', gulpSequence('test', 'clean', 'combine'));

gulp.task('test', gulpSequence('jshint'));
