/**
 * 服务展示页 - 实时可用性检测
 *
 * 通过全局 after_footer 注入，保证直接加载与 PJAX 无刷新跳转都能运行。
 * 原理：对每个 [data-check-url] 节点以 no-cors 模式发起一次轻量请求。
 * no-cors 无法读取响应体，但请求被解析即说明端点可达（在线），
 * 抛错或超时则判定为离线。状态点会自动从「检测中」切换为「在线 / 离线」。
 */
(function () {
  "use strict";

  // 防止脚本被重复加载时多次注册监听器
  if (window.__servicesStatusLoaded) return;
  window.__servicesStatusLoaded = true;

  var TIMEOUT_MS = 6000;

  function setStatus(el, state, label) {
    el.classList.remove("is-checking", "is-online", "is-offline");
    el.classList.add("is-" + state);
    el.removeAttribute("data-svc-pending");
    var text = el.querySelector(".svc-status-text");
    if (text) text.textContent = label;
  }

  function checkOne(el) {
    // 同一节点正在检测中则跳过，避免重复发请求
    if (el.getAttribute("data-svc-pending")) return;
    el.setAttribute("data-svc-pending", "1");

    var url = el.getAttribute("data-check-url");
    if (!url) {
      setStatus(el, "offline", "未知");
      return;
    }

    var controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    })
      .then(function () {
        clearTimeout(timer);
        setStatus(el, "online", "在线");
      })
      .catch(function () {
        clearTimeout(timer);
        setStatus(el, "offline", "离线");
      });
  }

  function run() {
    // 仅处理尚未出结果的节点（is-checking）
    var nodes = document.querySelectorAll(
      ".svc-status.is-checking[data-check-url]"
    );
    for (var i = 0; i < nodes.length; i++) {
      // 稍微错开请求，避免瞬时并发
      (function (el, idx) {
        setTimeout(function () {
          checkOne(el);
        }, idx * 250);
      })(nodes[i], i);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // 支持 Kratos-Rebirth 的 PJAX 无刷新切换
  window.addEventListener("pjax:complete", run);
})();
