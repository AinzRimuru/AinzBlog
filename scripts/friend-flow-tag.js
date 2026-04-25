'use strict';

/**
 * Friend Flow Tag Plugin
 * Usage: {% friendflow %}
 * Config: _config.yml -> friend_flow
 */

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

  var css = [
    '.ff-container{margin:16px 0}',
    '.ff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
    '.ff-card{background:#fff;border:1px solid #eaecef;border-radius:6px;overflow:hidden;transition:box-shadow .3s ease,transform .2s ease}',
    '.ff-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.08);transform:translateY(-1px)}',
    '.ff-card-header{display:flex;align-items:center;padding:10px 12px;gap:10px}',
    '.ff-card-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0}',
    '.ff-card-info{flex:1;min-width:0;overflow:hidden}',
    '.ff-card-name{display:block;font-size:14px;font-weight:600;color:#333;text-decoration:none}',
    '.ff-card-name:hover{color:#4a90d9}',
    '.ff-card-desc{font-size:12px;color:#888;line-height:1.3;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ff-card-articles{border-top:1px solid #f0f0f0;padding:6px 12px 8px}',
    '.ff-article-item{display:flex;align-items:baseline;padding:2px 0;text-decoration:none;color:#555;font-size:13px;line-height:1.5}',
    '.ff-article-item:hover{color:#4a90d9}',
    '.ff-article-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px}',
    '.ff-article-time{font-size:11px;color:#bbb;flex-shrink:0;white-space:nowrap}',
    '.ff-spinner{display:inline-block;width:24px;height:24px;border:3px solid #eaecef;border-top-color:#999;border-radius:50%;animation:ff-spin .8s linear infinite}',
    '@keyframes ff-spin{to{transform:rotate(360deg)}}',
    '.ff-loading{display:flex;justify-content:center;align-items:center;min-height:120px}',
    '.ff-error{text-align:center;padding:40px 0;color:#999}',
  ].join('');

  var js = '(function(id,api,self,max){' +
    'var c=document.getElementById(id);' +
    'if(!c)return;' +
    'function esc(s){if(!s)return"";var d=document.createElement("div");d.textContent=s;return d.innerHTML}' +
    'function resIcon(i){if(!i)return"";if(i.indexOf("http")===0)return i;return api+i}' +
    'function fmtDate(s){try{return new Date(s).toLocaleDateString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit"})}catch(e){return s}}' +
    'function render(data){' +
    'var list=data.slice().sort(function(){return Math.random()-0.5});' +
    'var h="<div class=\\"ff-grid\\">";' +
    'for(var i=0;i<list.length;i++){' +
    'var f=list[i];var ic=resIcon(f.icon);var arts=f.recentArticles||[];' +
    'h+="<div class=\\"ff-card\\"><div class=\\"ff-card-header\\">";' +
    'h+="<a target=\\"_blank\\" href=\\""+esc(f.url)+"\\" rel=\\"noopener\\"><img class=\\"ff-card-avatar\\" src=\\""+esc(ic)+"\\" alt=\\""+esc(f.name)+"\\" loading=\\"lazy\\"/></a>";' +
    'h+="<div class=\\"ff-card-info\\"><a class=\\"ff-card-name\\" target=\\"_blank\\" href=\\""+esc(f.url)+"\\" rel=\\"noopener\\">"+esc(f.name)+"</a>";' +
    'h+="<div class=\\"ff-card-desc\\">"+esc(f.description)+"</div></div></div>";' +
    'if(arts.length>0){' +
    'h+="<div class=\\"ff-card-articles\\">";' +
    'var n=Math.min(arts.length,max);' +
    'for(var j=0;j<n;j++){var a=arts[j];var t=a.publishTime?fmtDate(a.publishTime):"";' +
    'h+="<a class=\\"ff-article-item\\" target=\\"_blank\\" href=\\""+esc(a.url)+"\\" rel=\\"noopener\\"><span class=\\"ff-article-title\\">"+esc(a.title)+"</span>";' +
    'if(t)h+="<span class=\\"ff-article-time\\">"+t+"</span>";' +
    'h+="</a>";}' +
    'h+="</div>";}' +
    'h+="</div>";}' +
    'h+="</div>";c.innerHTML=h;}' +
    'var url=api+"/api/friend-links";' +
    'if(self)url+="?exclude="+encodeURIComponent(self);' +
    'fetch(url)' +
    '.then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})' +
    '.then(render)' +
    '.catch(function(e){console.error("Friend Flow:",e);c.innerHTML="<div class=\\"ff-error\\">"+(e.message||"Fetch failed")+"</div>"});' +
    '})("' + id + '","' + apiBase + '","' + selfUrl + '",' + maxArticles + ');';

  return '<style>' + css + '</style>' +
    '<div id="' + id + '" class="ff-container">' +
    '<div class="ff-loading"><span class="ff-spinner"></span></div>' +
    '</div>' +
    '<script>' + js + '</script>';
});
