/*
 * Local-clone link adapter.
 *
 * The study clone contains the landing page only. Navigation entries whose
 * destination is a serverless or secondary page are pointed at the canonical
 * public site so the clone never leads to a dead local URL. In-page anchors
 * (#contents, #books, …) and the landing page itself stay local.
 *
 * This file is not part of the original site.
 */
(function () {
  'use strict';

  var CANONICAL = 'https://aiengineeringfromscratch.com';
  var ROUTES = {
    'about': 1,
    'assessment': 1,
    'blogs': 1,
    'catalog': 1,
    'certification': 1,
    'certifications': 1,
    'cheatsheets': 1,
    'contact': 1,
    'developer': 1,
    'docs': 1,
    'glossary': 1,
    'highlights': 1,
    'how-to-learn': 1,
    'inside-an-ai-agent': 1,
    'inside-a-decompiler': 1,
    'inside-an-llm-serving-gpu': 1,
    'interviews': 1,
    'learning-paths': 1,
    'lesson': 1,
    'manuals': 1,
    'practice': 1,
    'privacy': 1,
    'project': 1,
    'projects': 1,
    'roadmap': 1,
    'skills': 1,
    'sponsors': 1
  };

  function basePath() {
    var path = window.location.pathname || '/';
    return path.slice(0, path.lastIndexOf('/') + 1);
  }

  function canonicalHref(href) {
    if (!href || href.charAt(0) === '#') return href;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return href;

    var resolved;
    try {
      resolved = new URL(href, window.location.href);
    } catch (_) {
      return href;
    }
    if (resolved.origin !== window.location.origin) return href;

    var base = basePath();
    var path = resolved.pathname;
    if (path.indexOf(base) === 0) path = path.slice(base.length);
    path = path.replace(/^\/+/, '').replace(/\/+$/, '');

    var first = path.split('/')[0].replace(/\.html$/, '');
    if (!ROUTES[first] && first !== 'phase' && first !== 'glossary') return href;

    // `/glossary` is both a route and a hub prefix; `/glossary/term` stays on
    // the canonical site either way.
    if (!path) return href;

    return CANONICAL + '/' + path + resolved.search + resolved.hash;
  }

  function adapt(link) {
    if (!link || typeof link.getAttribute !== 'function') return;
    var before = link.getAttribute('href');
    var after = canonicalHref(before);
    if (after !== before) link.setAttribute('href', after);
  }

  function adaptTree(root) {
    if (!root) return;
    if (typeof root.matches === 'function' && root.matches('a[href]')) adapt(root);
    if (typeof root.querySelectorAll !== 'function') return;
    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i += 1) adapt(links[i]);
  }

  adaptTree(document);
  document.addEventListener('DOMContentLoaded', function () { adaptTree(document); });
  window.addEventListener('load', function () { adaptTree(document); });

  if (typeof MutationObserver === 'function') {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        if (mutations[i].type === 'attributes') adapt(mutations[i].target);
        var added = mutations[i].addedNodes || [];
        for (var j = 0; j < added.length; j += 1) adaptTree(added[j]);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['href'],
      childList: true,
      subtree: true
    });
  }
})();
