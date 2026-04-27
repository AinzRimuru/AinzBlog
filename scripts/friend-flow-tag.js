'use strict';

var fs = require('fs');
var path = require('path');

var DIR = path.join(__dirname, 'friend-flow');
var CSS = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8');
var JS_TEMPLATE = fs.readFileSync(path.join(DIR, 'template.js'), 'utf8');

hexo.extend.tag.register('friendflow', function () {
  var config = hexo.config.friend_flow || {};
  var apiBase = (config.api_base || '').replace(/\/+$/, '');
  var selfUrl = (config.self_url || '').replace(/\/+$/, '');
  var maxArticles = config.articles_per_card || 5;

  if (!apiBase) {
    return '<div style="text-align:center;color:#999;padding:40px 0">' +
      'Friend Flow: please set friend_flow.api_base in _config.yml</div>';
  }

  var id = 'ff-' + Math.random().toString(36).substr(2, 8);

  // 将模板 IIFE 转为立即执行，注入运行时参数
  var js = JS_TEMPLATE
    .replace(/^\(function\s*/, '(function ')
    .replace(/\}\);$/, '})("' + id + '","' + apiBase + '","' + selfUrl + '",' + maxArticles + ');');

  return '<style>' + CSS + '</style>' +
    '<div id="' + id + '" class="ff-container">' +
    '<div class="ff-loading"><span class="ff-spinner"></span></div>' +
    '</div>' +
    '<script>' + js + '</script>';
});
