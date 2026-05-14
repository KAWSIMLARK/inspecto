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

  window.setTimeout(() => {
    const app = document.querySelector("#app");
    if (!app || app.dataset.ready) return;
    const loading = app.textContent.includes("Chargement d'Inspecto");
    if (!loading) return;
    app.innerHTML = `
      <main class="container">
        <section class="empty">
          <h2>Inspecto tarde a demarrer</h2>
          <p class="muted">Sur mobile, ce blocage arrive souvent quand le reseau coupe pendant le chargement de Supabase. Recharge la page; si ca revient, vide le cache de cet appareil.</p>
          <div class="topbar-actions">
            <button class="btn primary" type="button" data-reload-page>Recharger</button>
            <button class="btn ghost" type="button" data-clear-cache>Vider le cache</button>
          </div>
        </section>
      </main>
    `;
  }, 15000);

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-clear-cache]");
    if (trigger) {
      window.inspectoClearCache();
      return;
    }
    if (event.target.closest("[data-reload-page]")) location.reload();
  });
})();
