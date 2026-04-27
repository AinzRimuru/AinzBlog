(function (id, api, self, max) {
  var c = document.getElementById(id);
  if (!c) return;

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function resIcon(i) {
    if (!i) return "";
    if (i.indexOf("http") === 0) return i;
    return api + i;
  }

  function fmtDate(s) {
    try {
      return new Date(s).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch (e) {
      return s;
    }
  }

  function render(data) {
    var list = data.slice().sort(function () {
      return Math.random() - 0.5;
    });

    var h = '<div class="ff-grid">';

    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var ic = resIcon(f.icon);
      var arts = f.recentArticles || [];

      h += '<div class="ff-card"><div class="ff-card-header">';
      h +=
        '<a target="_blank" href="' +
        esc(f.url) +
        '" rel="noopener">' +
        '<img class="ff-card-avatar" src="' +
        esc(ic) +
        '" alt="' +
        esc(f.name) +
        '" loading="lazy"/></a>';
      h +=
        '<div class="ff-card-info">' +
        '<a class="ff-card-name" target="_blank" href="' +
        esc(f.url) +
        '" rel="noopener">' +
        esc(f.name) +
        "</a>";
      h +=
        '<div class="ff-card-desc">' + esc(f.description) + "</div></div></div>";

      if (arts.length > 0) {
        h += '<div class="ff-card-articles">';
        var n = Math.min(arts.length, max);
        for (var j = 0; j < n; j++) {
          var a = arts[j];
          var t = a.publishTime ? fmtDate(a.publishTime) : "";
          h +=
            '<a class="ff-article-item" target="_blank" href="' +
            esc(a.url) +
            '" rel="noopener">' +
            '<span class="ff-article-title">' +
            esc(a.title) +
            "</span>";
          if (t) h += '<span class="ff-article-time">' + t + "</span>";
          h += "</a>";
        }
        h += "</div>";
      }

      h += "</div>";
    }

    h += "</div>";
    c.innerHTML = h;
  }

  var url = api + "/api/friend-links";
  if (self) url += "?exclude=" + encodeURIComponent(self);

  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (e) {
      console.error("Friend Flow:", e);
      c.innerHTML =
        '<div class="ff-error">' + (e.message || "Fetch failed") + "</div>";
    });
});
