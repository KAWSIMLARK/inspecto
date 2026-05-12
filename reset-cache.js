(function () {
  async function clearInspectoCache() {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      location.replace(location.pathname + "?refresh=" + Date.now());
    }
  }

  window.inspectoClearCache = clearInspectoCache;

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-clear-cache]");
    if (!trigger) return;
    window.inspectoClearCache();
  });
})();
