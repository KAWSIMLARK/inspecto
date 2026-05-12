import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://itabonpgzpokcdfcyhdx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YWJvbnBnenBva2NkZmN5aGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjI3MDksImV4cCI6MjA5MzgzODcwOX0.FGR5Ol7H8Ln7zEhCG_gbKqfRL-lEoQg2BFPlCVGLwSs";
const PHOTO_BUCKET = "inspection-photos";
const REMEMBER_KEY = "inspecto.rememberSession";
const DEFAULT_PROPERTY_TYPE = "single_family";
const SIGNED_PHOTO_URL_TTL = 60 * 60 * 24;
const MAX_PHOTO_SIZE = 1600;
const PHOTO_QUALITY = 0.78;

const propertyTypes = [
  ["unspecified", "Non precise"],
  ["single_family", "Maison unifamiliale"],
  ["condo", "Condo"],
  ["duplex", "Duplex"],
  ["triplex", "Triplex"],
  ["multi_unit", "Multilogement"],
  ["commercial", "Commercial"],
  ["cottage", "Chalet"],
  ["other", "Autre"],
];

const inspectionSchema = [
  {
    title: "Exterieur",
    items: [
      ["Fondation", "Y a-t-il des fissures actives ou anciennes? De l'humidite visible au sous-sol? Bloc ou coule?"],
      ["Revetement exterieur", "Annee d'installation? Zones deja reparees? Section endommagee? Possibilite d'infiltration d'eau? Composition bien faite?"],
      ["Portes / Fenetres", "Sont-elles toutes fonctionnelles? Sont-elles toutes Egress? Infiltration? Morceaux manquants?"],
      ["Balcons / Escaliers / Garde-corps", "Solides et conformes au code? Rouille ou bois pourri? Etriers? Ils sont assis sur quoi?"],
      ["Drainage du terrain, stationnement, trottoirs", "L'eau s'eloigne-t-elle bien du batiment? Stationnement ou trottoirs fissures?"],
    ],
  },
  {
    title: "Toiture",
    items: [
      ["Revetement (bardeaux/tole)", "Date de la derniere refection? Annees de garantie restantes? Materiaux? Compagnie?"],
      ["Gouttieres et descentes", "Fonctionnelles ou obstruees? L'eau s'eloigne-t-elle des fondations? Sections manquantes?"],
      ["Solins, emergences", "Ont-ils ete entretenus recemment? Y a-t-il des fissures?"],
      ["Traces d'infiltration", "Y a-t-il eu des reparations de plafond liees a des fuites?"],
    ],
  },
  {
    title: "Structure",
    items: [
      ["Planchers (denivellation)", "Y a-t-il du denivellement ou du craquement?"],
      ["Murs porteurs (fissures/humidite)", "Presence de fissures traversantes ou d'humidite?"],
      ["Poutres / Colonnes / Solives", "Renforcements ou reparations visibles? Nouvel footing, etc."],
    ],
  },
  {
    title: "Plomberie",
    items: [
      ["Entree d'eau principale", "Equipee d'un clapet antiretour? Reparation visible ou refection?"],
      ["Chauffe-eau (age, fuite, soupape)", "Quelle est l'annee? Fuites ou corrosion? Piece manquante?"],
      ["Tuyauterie visible", "Materiau utilise (cuivre, PEX, poly-B)? Sections deja remplacees?"],
      ["Salle de bain", "Ventilation efficace? Scellant en bon etat?"],
    ],
  },
  {
    title: "Electricite",
    items: [
      ["Panneaux", "Annee, capacite en amperes, conformite aux normes actuelles, marque?"],
      ["Prises DDFT (GFCI)", "Presentes et fonctionnelles dans la cuisine et salle de bain?"],
      ["Eclairage / Interrupteurs / plinthe", "Tous fonctionnels? Trace de surchauffe?"],
      ["Detecteurs fumee / CO", "Fonctionnels? Manquants?"],
    ],
  },
  {
    title: "Chauffage & Ventilation",
    items: [
      ["Systeme de chauffage (type/etat)", "Type, age, etat general et entretien visible."],
      ["Ventilation sdb et cuisine", "Sortie vers l'exterieur ou seulement recirculation?"],
      ["Conduit secheuse", "Propre et bien raccorde vers l'exterieur?"],
    ],
  },
  {
    title: "Interieur",
    items: [
      ["Planchers / Murs / Plafonds", "Signes de degat des eaux ou de moisissure?"],
      ["Armoires / Comptoirs", "Age et etat general? Besoin de remplacement?"],
      ["Odeurs / humidite", "Odeur persistante (moisi, cigarette, animaux)?"],
    ],
  },
  {
    title: "Autres",
    items: [
      ["Isolation / Entretoit", "Acces facile? Isolant uniforme?"],
      ["Insectes / Vermine", "Traces de presence (excrements, trous, nids, trappes)?"],
    ],
  },
];

const TOTAL_INSPECTION_ITEMS = inspectionSchema.reduce((sum, category) => sum + category.items.length, 0);
const $app = document.querySelector("#app");
const adaptiveAuthStorage = {
  getItem(key) {
    return getRememberPreference() ? localStorage.getItem(key) : sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (getRememberPreference()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: adaptiveAuthStorage,
  },
});
const state = {
  user: null,
  inspections: [],
  propertyTypeFilter: "all",
  newPropertyType: DEFAULT_PROPERTY_TYPE,
  saveTimers: new Map(),
  saveQueues: new Map(),
  savingIds: new Set(),
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function getRememberPreference() {
  return localStorage.getItem(REMEMBER_KEY) === "true";
}

function setRememberPreference(remember) {
  if (remember) localStorage.setItem(REMEMBER_KEY, "true");
  else localStorage.removeItem(REMEMBER_KEY);
}

window.inspectoClearCache = async function inspectoClearCache() {
  try {
    await supabaseClient.auth.signOut();
  } catch {
    // Continue clearing browser storage even if Supabase is unavailable.
  }
  localStorage.clear();
  sessionStorage.clear();
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  location.replace(location.pathname + "?refresh=" + Date.now());
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function buildEmptyInspection() {
  const answers = {};
  inspectionSchema.forEach((category, categoryIndex) => {
    category.items.forEach((item, itemIndex) => {
      answers[`${categoryIndex}-${itemIndex}`] = { ok: false, note: "", photos: [] };
    });
  });

  const now = new Date().toISOString();
  return {
    id: uid(),
    address: "",
    propertyType: DEFAULT_PROPERTY_TYPE,
    createdAt: now,
    updatedAt: now,
    answers,
  };
}

function propertyTypeLabel(value) {
  return propertyTypes.find(([key]) => key === value)?.[1] || "Non precise";
}

function renderPropertyTypeOptions(selected = DEFAULT_PROPERTY_TYPE, includeAll = false) {
  const options = includeAll ? [["all", "Tous les types"], ...propertyTypes] : propertyTypes;
  return options.map(([value, label]) => `
    <option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>
  `).join("");
}

function getInspectionMetrics(inspection) {
  const answers = Object.values(inspection.answers || {});
  const completed = answers.filter((answer) => answer.ok || answer.note || answer.photos.length).length;
  const checked = answers.filter((answer) => answer.ok).length;
  const notes = answers.filter((answer) => answer.note).length;
  const photos = answers.reduce((sum, answer) => sum + answer.photos.length, 0);
  const progress = TOTAL_INSPECTION_ITEMS ? Math.round((completed / TOTAL_INSPECTION_ITEMS) * 100) : 0;
  return { completed, checked, notes, photos, progress };
}

function getCategoryMetrics(categoryIndex, inspection) {
  const category = inspectionSchema[categoryIndex];
  const answers = category.items.map((_, itemIndex) => inspection.answers[`${categoryIndex}-${itemIndex}`] || { ok: false, note: "", photos: [] });
  const completed = answers.filter((answer) => answer.ok || answer.note || answer.photos.length).length;
  const photos = answers.reduce((sum, answer) => sum + answer.photos.length, 0);
  return { completed, total: category.items.length, photos };
}

function getArchiveMetrics(allInspections, visibleInspections) {
  const visible = visibleInspections.length;
  const totalPhotos = allInspections.reduce((sum, inspection) => sum + getInspectionMetrics(inspection).photos, 0);
  const averageProgress = allInspections.length
    ? Math.round(allInspections.reduce((sum, inspection) => sum + getInspectionMetrics(inspection).progress, 0) / allInspections.length)
    : 0;
  const activeThisWeek = allInspections.filter((inspection) => {
    const updated = new Date(inspection.updatedAt).getTime();
    return Date.now() - updated < 7 * 24 * 60 * 60 * 1000;
  }).length;
  return { visible, total: allInspections.length, totalPhotos, averageProgress, activeThisWeek };
}

async function render() {
  try {
    await renderApp();
  } catch (error) {
    renderFatalError(error);
  }
}

async function renderApp() {
  if (!supabaseClient) {
    renderAuth("login", "Supabase n'a pas pu charger. Recharge la page quand la connexion internet est disponible.");
    return;
  }

  const { data } = await supabaseClient.auth.getUser();
  state.user = data.user || null;
  if (!state.user) {
    renderAuth();
    return;
  }

  const loaded = await loadInspections();
  if (!loaded) return;
  const params = new URLSearchParams(location.hash.replace("#", ""));
  if (params.get("view") === "form") return renderForm(params.get("id"));
  if (params.get("view") === "detail") return renderDetail(params.get("id"));
  renderArchive();
}

function renderFatalError(error) {
  $app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">I</span><span>Inspecto</span></div>
      </header>
      <main class="container">
        <section class="empty">
          <h2>Inspecto n'a pas pu charger</h2>
          <p class="muted">Recharge la page. Si le probleme reste, voici l'erreur a corriger:</p>
          <p class="error">${escapeHtml(error?.message || String(error))}</p>
          <button class="btn primary" type="button" data-clear-cache>Vider le cache et recommencer</button>
        </section>
      </main>
    </div>
  `;
}

async function loadInspections() {
  const { data, error } = await supabaseClient
    .from("inspections")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    renderSetupError(error);
    state.inspections = [];
    return false;
  }

  state.inspections = await Promise.all(data.map(async (row) => hydrateInspectionPhotos(fromDbInspection(row))));
  return true;
}

async function hydrateInspectionPhotos(inspection) {
  const photos = Object.values(inspection.answers).flatMap((answer) => answer.photos || []);
  await Promise.all(photos.map(async (photo) => {
    if (!photo.path) return;
    const { data, error } = await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(photo.path, SIGNED_PHOTO_URL_TTL);
    if (!error && data?.signedUrl) photo.data = data.signedUrl;
  }));
  return inspection;
}

function fromDbInspection(row) {
  const inspection = buildEmptyInspection();
  const payload = row.payload || {};
  return {
    ...inspection,
    ...payload,
    id: row.id,
    address: row.address || payload.address || "",
    propertyType: payload.propertyType || "unspecified",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    answers: { ...inspection.answers, ...(payload.answers || {}) },
  };
}

function toDbPayload(inspection) {
  return {
    address: inspection.address,
    propertyType: inspection.propertyType || DEFAULT_PROPERTY_TYPE,
    answers: inspection.answers,
  };
}

function renderSetupError(error) {
  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(state.user)}
      <main class="container">
        <section class="empty">
          <h2>Configuration Supabase requise</h2>
          <p class="muted">La connexion fonctionne, mais la table ou le bucket n'est pas encore cree.</p>
          <p class="error">${escapeHtml(error.message)}</p>
          <p>Ouvre Supabase, va dans <strong>SQL Editor</strong>, puis execute le fichier <strong>supabase-schema.sql</strong> du projet.</p>
          <button class="btn ghost" type="button" data-clear-cache>Vider le cache</button>
        </section>
      </main>
    </div>
  `;
  bindTopbar();
}

function renderAuth(mode = "login", message = "") {
  $app.innerHTML = `
    <main class="auth-layout">
      <section class="auth-visual">
        <div class="brand"><span class="brand-mark">I</span><span>Inspecto</span></div>
        <h1>Compiler une inspection sans perdre le fil.</h1>
        <p>Un espace simple pour creer un dossier par immeuble, joindre les photos au bon endroit et retrouver l'historique lie a ton profil.</p>
      </section>
      <section class="auth-panel">
        <div class="panel">
          <div class="panel-inner">
            <div class="tabs">
              <button class="tab ${mode === "login" ? "active" : ""}" data-auth-tab="login">Connexion</button>
              <button class="tab ${mode === "signup" ? "active" : ""}" data-auth-tab="signup">Creer un compte</button>
            </div>
            <form id="authForm">
              ${mode === "signup" ? `
                <div class="field">
                  <label for="name">Nom complet</label>
                  <input id="name" autocomplete="name" required />
                </div>` : ""}
              <div class="field">
                <label for="email">Courriel</label>
                <input id="email" type="email" autocomplete="email" required />
              </div>
              <div class="field">
                <label for="password">Mot de passe</label>
                <input id="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required minlength="6" />
              </div>
              <label class="remember-row">
                <input id="rememberSession" type="checkbox" ${getRememberPreference() ? "checked" : ""} />
                <span>Se souvenir de moi sur cet appareil</span>
              </label>
              <button class="btn primary full" type="submit">${mode === "login" ? "Se connecter" : "Creer le compte"}</button>
              ${message ? `<div class="error">${escapeHtml(message)}</div>` : ""}
              <p class="muted">Les comptes, inspections et photos sont synchronises avec Supabase.</p>
              <button class="btn ghost full" type="button" data-clear-cache>Vider le cache de connexion</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  `;

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => renderAuth(button.dataset.authTab));
  });

  document.querySelector("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    const remember = document.querySelector("#rememberSession").checked;
    setRememberPreference(remember);

    if (mode === "signup") {
      const name = document.querySelector("#name").value.trim();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return renderAuth("signup", error.message);
      if (!data.session) {
        return renderAuth("login", "Compte cree. Confirme ton courriel si Supabase te l'a demande, puis connecte-toi.");
      }
      location.hash = "";
      await render();
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return renderAuth("login", error.message);
    location.hash = "";
    await render();
  });
}

function renderTopbar(user) {
  const name = user?.user_metadata?.name || user?.email || "";
  return `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">I</span><span>Inspecto</span></div>
      <div class="topbar-actions">
        <span class="user-chip">${escapeHtml(name)}</span>
        <button class="btn ghost" id="archiveBtn">Archives</button>
        <button class="btn danger" id="logoutBtn">Deconnexion</button>
      </div>
    </header>
  `;
}

function bindTopbar() {
  document.querySelector("#logoutBtn")?.addEventListener("click", async (event) => {
    const saved = await runButtonAction(event.currentTarget, saveOpenFormIfPresent);
    if (!saved) return;
    await supabaseClient.auth.signOut();
    location.hash = "";
    await render();
  });
  document.querySelector("#archiveBtn")?.addEventListener("click", async (event) => {
    const saved = await runButtonAction(event.currentTarget, saveOpenFormIfPresent);
    if (!saved) return;
    location.hash = "";
    render();
  });
}

async function saveOpenFormIfPresent() {
  const form = document.querySelector("#inspectionForm");
  if (!form) return;
  const params = new URLSearchParams(location.hash.replace("#", ""));
  const id = params.get("id");
  if (!id) return;
  await flushInspectionAutosave(id);
  await saveInspectionFromForm(id);
}

function renderArchive() {
  const filtered = state.propertyTypeFilter === "all"
    ? state.inspections
    : state.inspections.filter((inspection) => (inspection.propertyType || DEFAULT_PROPERTY_TYPE) === state.propertyTypeFilter);
  const inspections = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const archiveMetrics = getArchiveMetrics(state.inspections, inspections);
  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(state.user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <span class="eyebrow">Registre synchronise</span>
            <h1>Archives d'inspection</h1>
            <p>${inspections.length} dossier${inspections.length > 1 ? "s" : ""} affiche${inspections.length > 1 ? "s" : ""} sur ${state.inspections.length} au total.</p>
          </div>
          <div class="archive-controls">
            <label>
              <span>Filtrer</span>
              <select id="propertyTypeFilter">${renderPropertyTypeOptions(state.propertyTypeFilter, true)}</select>
            </label>
            <label>
              <span>Nouveau dossier</span>
              <select id="newPropertyType">${renderPropertyTypeOptions(state.newPropertyType)}</select>
            </label>
            <button class="btn primary" id="newInspectionBtn" type="button">+ Nouvelle inspection</button>
          </div>
        </section>
        ${renderOpsStrip(archiveMetrics)}
        ${inspections.length ? `
          <section class="archive-workspace">
            <div class="archive-main">
              <div class="workspace-heading">
                <div>
                  <span class="eyebrow">Dossiers</span>
                  <h2>File de travail</h2>
                </div>
                <span class="muted">${state.propertyTypeFilter === "all" ? "Tous les types" : propertyTypeLabel(state.propertyTypeFilter)}</span>
              </div>
              <div class="archive-grid">
                ${inspections.map((inspection) => renderInspectionCard(inspection)).join("")}
              </div>
            </div>
            ${renderPropertyTypeRail(state.inspections)}
          </section>
        ` : `
          <section class="empty">
            <h2>${state.inspections.length ? "Aucune inspection pour ce filtre" : "Aucune inspection enregistree"}</h2>
            <p class="muted">${state.inspections.length ? "Change le type de propriete filtre ou cree un nouveau dossier avec ce type." : "Cree un premier dossier, ajoute l'adresse, tes notes et les photos question par question."}</p>
          </section>
        `}
      </main>
    </div>
  `;
  bindTopbar();
  document.querySelector("#propertyTypeFilter").addEventListener("change", (event) => {
    state.propertyTypeFilter = event.target.value;
    renderArchive();
  });
  document.querySelector("#newPropertyType").addEventListener("change", (event) => {
    state.newPropertyType = event.target.value;
  });
  document.querySelector("#newInspectionBtn").addEventListener("click", (event) => runButtonAction(event.currentTarget, createInspection));
  document.querySelectorAll("[data-filter-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.propertyTypeFilter = button.dataset.filterType;
      renderArchive();
    });
  });
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `view=form&id=${button.dataset.edit}`;
      render();
    });
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `view=detail&id=${button.dataset.view}`;
      render();
    });
  });
  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", (event) => runButtonAction(event.currentTarget, () => deleteInspection(button.dataset.delete)));
  });
}

function renderOpsStrip(metrics) {
  const items = [
    ["Dossiers visibles", metrics.visible, `${metrics.total} au total`],
    ["Photos archivees", metrics.totalPhotos, "Annexes PDF incluses"],
    ["Progression moyenne", `${metrics.averageProgress}%`, `${TOTAL_INSPECTION_ITEMS} points par dossier`],
    ["Actifs 7 jours", metrics.activeThisWeek, "Dernieres interventions"],
  ];
  return `
    <section class="ops-strip" aria-label="Etat des archives">
      ${items.map(([label, value, detail]) => `
        <article class="metric-tile">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(detail)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderPropertyTypeRail(inspections) {
  const rows = [["all", "Tous les types"], ...propertyTypes].map(([type, label]) => {
    const count = type === "all"
      ? inspections.length
      : inspections.filter((inspection) => (inspection.propertyType || DEFAULT_PROPERTY_TYPE) === type).length;
    const active = state.propertyTypeFilter === type ? "active" : "";
    return `
      <button class="${active}" type="button" data-filter-type="${type}">
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
  return `
    <aside class="ops-rail">
      <div class="workspace-heading compact">
        <div>
          <span class="eyebrow">Tri rapide</span>
          <h2>Types</h2>
        </div>
      </div>
      <div class="type-list">${rows}</div>
    </aside>
  `;
}

function renderInspectionCard(inspection) {
  const metrics = getInspectionMetrics(inspection);
  return `
    <article class="inspection-card">
      <div>
        <h2 class="card-title">${escapeHtml(inspection.address || "Adresse a completer")}</h2>
        <p class="muted">Modifie le ${formatDate(inspection.updatedAt)}</p>
      </div>
      <div class="progress-meter" aria-label="Progression ${metrics.progress}%">
        <span style="width:${metrics.progress}%"></span>
      </div>
      <div class="card-meta">
        <span class="badge">${escapeHtml(propertyTypeLabel(inspection.propertyType))}</span>
        <span class="badge">${metrics.completed}/${TOTAL_INSPECTION_ITEMS} elements</span>
        <span class="badge">${metrics.photos} photo${metrics.photos > 1 ? "s" : ""}</span>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" data-view="${inspection.id}">Consulter</button>
        <button class="btn primary" data-edit="${inspection.id}">Modifier</button>
        <button class="btn danger" data-delete="${inspection.id}">Supprimer</button>
      </div>
    </article>
  `;
}

async function createInspection() {
  const inspection = buildEmptyInspection();
  inspection.propertyType = state.newPropertyType || DEFAULT_PROPERTY_TYPE;
  const { data, error } = await supabaseClient
    .from("inspections")
    .insert({
      user_id: state.user.id,
      address: inspection.address,
      payload: toDbPayload(inspection),
    })
    .select()
    .single();

  if (error) return showToast(error.message);
  location.hash = `view=form&id=${data.id}`;
  await render();
}

async function deleteInspection(id) {
  if (!confirm("Supprimer cette inspection?")) return;
  const { error } = await supabaseClient.from("inspections").delete().eq("id", id);
  if (error) return showToast(error.message);
  await render();
}

function findInspection(id) {
  return state.inspections.find((inspection) => inspection.id === id);
}

function renderDetail(id) {
  const inspection = findInspection(id);
  if (!inspection) {
    location.hash = "";
    return renderArchive();
  }

  const metrics = getInspectionMetrics(inspection);

  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(state.user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <h1>${escapeHtml(inspection.address || "Inspection sans adresse")}</h1>
            <p>Cree le ${formatDate(inspection.createdAt)} - Modifie le ${formatDate(inspection.updatedAt)}</p>
          </div>
          <div class="topbar-actions">
            <button class="btn ghost" id="backToArchiveBtn">Archives</button>
            <button class="btn ghost" id="notionExportBtn">Exporter Notion</button>
            <button class="btn ghost" id="pdfExportBtn">Exporter PDF</button>
            <button class="btn primary" id="editFromDetailBtn">Modifier</button>
          </div>
        </section>
        <section class="summary-strip detail-summary">
          <article>
            <span>Type</span>
            <strong>${escapeHtml(propertyTypeLabel(inspection.propertyType))}</strong>
          </article>
          <article>
            <span>Progression</span>
            <strong>${metrics.completed}/${TOTAL_INSPECTION_ITEMS}</strong>
          </article>
          <article>
            <span>Photos</span>
            <strong>${metrics.photos}</strong>
          </article>
          <article>
            <span>Notes</span>
            <strong>${metrics.notes}</strong>
          </article>
        </section>
        <section class="detail-content">
          ${inspectionSchema.map((category, categoryIndex) => renderDetailCategory(category, categoryIndex, inspection)).join("")}
        </section>
      </main>
    </div>
  `;

  bindTopbar();
  document.querySelector("#backToArchiveBtn").addEventListener("click", () => {
    location.hash = "";
    render();
  });
  document.querySelector("#editFromDetailBtn").addEventListener("click", () => {
    location.hash = `view=form&id=${inspection.id}`;
    render();
  });
  document.querySelector("#notionExportBtn").addEventListener("click", async () => exportInspectionForNotion(inspection));
  document.querySelector("#pdfExportBtn").addEventListener("click", () => exportInspectionPdf(inspection));
  bindPhotoViewer(inspection);
}

function renderDetailCategory(category, categoryIndex, inspection) {
  return `
    <section class="category">
      <header class="category-header"><h2>${categoryIndex + 1}) ${escapeHtml(category.title)}</h2></header>
      ${category.items.map((item, itemIndex) => renderDetailQuestion(item, categoryIndex, itemIndex, inspection)).join("")}
    </section>
  `;
}

function renderDetailQuestion([title, help], categoryIndex, itemIndex, inspection) {
  const key = `${categoryIndex}-${itemIndex}`;
  const answer = inspection.answers[key] || { ok: false, note: "", photos: [] };
  return `
    <article class="question detail-question">
      <div class="detail-heading">
        <span class="status-dot ${answer.ok ? "done" : ""}">${answer.ok ? "OK" : "-"}</span>
        <div>
          <p class="question-title">${escapeHtml(title)}</p>
          <p class="question-help">${escapeHtml(help)}</p>
        </div>
      </div>
      <div class="note-box">${answer.note ? escapeHtml(answer.note) : "<span class=\"muted\">Aucune note inscrite.</span>"}</div>
      ${answer.photos.length ? `
        <div class="detail-photos">
          ${answer.photos.map((photo) => `
            <button type="button" class="detail-photo" data-open-photo="${photo.id}">
              <img src="${photo.data}" alt="${escapeHtml(photo.name)}" />
            </button>
          `).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderForm(id) {
  const inspection = findInspection(id);
  if (!inspection) {
    location.hash = "";
    return renderArchive();
  }
  const metrics = getInspectionMetrics(inspection);

  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(state.user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <span class="eyebrow">Saisie terrain</span>
            <h1>Formulaire d'inspection</h1>
            <p>Les changements sont sauvegardes automatiquement pendant que tu travailles.</p>
          </div>
          <div class="form-head-metrics">
            <span>${metrics.completed}/${TOTAL_INSPECTION_ITEMS} documentes</span>
            <strong>${metrics.photos} photo${metrics.photos > 1 ? "s" : ""}</strong>
          </div>
        </section>
        <form id="inspectionForm" class="form-shell">
          <nav class="side-nav">
            <div class="side-progress">
              <span>Progression</span>
              <strong>${metrics.progress}%</strong>
              <div class="progress-meter"><span style="width:${metrics.progress}%"></span></div>
            </div>
            ${inspectionSchema.map((category, index) => `
              <button type="button" data-jump="${index}" class="${index === 0 ? "active" : ""}">
                <span>${index + 1}. ${escapeHtml(category.title)}</span>
                <span>${getCategoryMetrics(index, inspection).completed}/${category.items.length}</span>
              </button>
            `).join("")}
          </nav>
          <section class="form-content">
            <div class="panel">
              <div class="panel-inner">
                <div class="field" style="margin-top:0">
                  <label for="address">Adresse</label>
                  <input id="address" value="${escapeHtml(inspection.address)}" placeholder="123 rue Principale, Montreal" required />
                </div>
                <div class="field">
                  <label for="propertyType">Type de propriete</label>
                  <select id="propertyType">${renderPropertyTypeOptions(inspection.propertyType || DEFAULT_PROPERTY_TYPE)}</select>
                </div>
              </div>
            </div>
            ${inspectionSchema.map((category, categoryIndex) => renderCategory(category, categoryIndex, inspection)).join("")}
            <div class="form-actions">
              <span class="save-status" id="saveStatus">Pret</span>
              <button class="btn ghost" type="button" id="cancelBtn">Retour aux archives</button>
              <button class="btn primary" type="submit">Enregistrer l'inspection</button>
            </div>
          </section>
        </form>
      </main>
    </div>
  `;
  bindTopbar();
  bindForm(inspection.id);
}

function renderCategory(category, categoryIndex, inspection) {
  const metrics = getCategoryMetrics(categoryIndex, inspection);
  return `
    <section class="category" id="cat-${categoryIndex}">
      <header class="category-header">
        <h2>${categoryIndex + 1}) ${escapeHtml(category.title)}</h2>
        <span class="badge">${metrics.completed}/${metrics.total} points - ${metrics.photos} photo${metrics.photos > 1 ? "s" : ""}</span>
      </header>
      ${category.items.map((item, itemIndex) => renderQuestion(item, categoryIndex, itemIndex, inspection)).join("")}
    </section>
  `;
}

function renderQuestion([title, help], categoryIndex, itemIndex, inspection) {
  const key = `${categoryIndex}-${itemIndex}`;
  const answer = inspection.answers[key] || { ok: false, note: "", photos: [] };
  const isDocumented = answer.ok || answer.note || answer.photos.length;
  return `
    <article class="question ${isDocumented ? "documented" : ""}" data-question="${key}">
      <div class="question-top">
        <input class="check" type="checkbox" data-field="ok" ${answer.ok ? "checked" : ""} aria-label="Point inspecte" />
        <div>
          <p class="question-title">${escapeHtml(title)}</p>
          <p class="question-help">${escapeHtml(help)}</p>
        </div>
      </div>
      <div class="field">
        <label>Note</label>
        <textarea data-field="note" placeholder="Observations, risques, recommandations...">${escapeHtml(answer.note)}</textarea>
      </div>
      <div class="photo-tools">
        <span class="section-label">Photos</span>
        <label class="btn file-button">
          Ajouter photos
          <input type="file" accept="image/*" multiple data-photo-input="${key}" />
        </label>
      </div>
      <div class="thumbs">
        ${answer.photos.map((photo, photoIndex) => `
          <figure class="thumb">
            <img src="${photo.data}" alt="${escapeHtml(photo.name)}" />
            <button type="button" title="Retirer" data-remove-photo="${key}:${photoIndex}">x</button>
          </figure>
        `).join("")}
      </div>
    </article>
  `;
}

function bindForm(inspectionId) {
  const form = document.querySelector("#inspectionForm");
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-jump]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#cat-${button.dataset.jump}`).scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  form.addEventListener("input", () => scheduleInspectionAutosave(inspectionId));
  form.addEventListener("change", () => scheduleInspectionAutosave(inspectionId));

  document.querySelector("#cancelBtn").addEventListener("click", async (event) => {
    const saved = await runButtonAction(event.currentTarget, async () => {
      await flushInspectionAutosave(inspectionId);
      await saveInspectionFromForm(inspectionId);
    });
    if (!saved) return;
    location.hash = "";
    await render();
  });

  document.querySelectorAll("[data-photo-input]").forEach((input) => {
    input.addEventListener("change", async () => {
      const key = input.dataset.photoInput;
      const files = [...input.files].slice(0, 8);
      if (!files.length) return;
      try {
        await saveInspectionFromForm(inspectionId);
        const photos = await Promise.all(files.map(fileToPhoto));
        const inspection = findInspection(inspectionId);
        inspection.answers[key].photos.push(...photos);
        await saveInspection(inspection);
        await render();
      } catch (error) {
        showToast(error.message || "La photo n'a pas pu etre sauvegardee.");
      }
    });
  });

  document.querySelectorAll("[data-remove-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [key, index] = button.dataset.removePhoto.split(":");
      await flushInspectionAutosave(inspectionId);
      await saveInspectionFromForm(inspectionId);
      const inspection = findInspection(inspectionId);
      inspection.answers[key].photos.splice(Number(index), 1);
      await saveInspection(inspection);
      await render();
    });
  });

  document.querySelector("#inspectionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await runButtonAction(event.submitter, async () => {
      await flushInspectionAutosave(inspectionId);
      await saveInspectionFromForm(inspectionId);
      location.hash = `view=detail&id=${inspectionId}`;
      await render();
    });
  });
}

function scheduleInspectionAutosave(inspectionId) {
  clearTimeout(state.saveTimers.get(inspectionId));
  setSaveStatus("Sauvegarde en attente...");
  state.saveTimers.set(inspectionId, setTimeout(async () => {
    state.saveTimers.delete(inspectionId);
    try {
      await saveInspectionFromForm(inspectionId, { silent: true });
      setSaveStatus("Sauvegarde automatique faite");
    } catch (error) {
      setSaveStatus("Sauvegarde echouee");
      showToast(error.message || "La sauvegarde automatique a echoue.");
    }
  }, 900));
}

async function flushInspectionAutosave(inspectionId) {
  const timer = state.saveTimers.get(inspectionId);
  if (!timer) return;
  clearTimeout(timer);
  state.saveTimers.delete(inspectionId);
}

async function saveInspectionFromForm(inspectionId, options = {}) {
  const form = document.querySelector("#inspectionForm");
  if (!form) return;
  const inspection = findInspection(inspectionId);
  if (!inspection) throw new Error("Inspection introuvable.");
  inspection.address = document.querySelector("#address").value.trim();
  inspection.propertyType = document.querySelector("#propertyType")?.value || DEFAULT_PROPERTY_TYPE;
  document.querySelectorAll("[data-question]").forEach((question) => {
    const key = question.dataset.question;
    inspection.answers[key].ok = question.querySelector('[data-field="ok"]').checked;
    inspection.answers[key].note = question.querySelector('[data-field="note"]').value.trim();
  });
  if (!options.silent) setSaveStatus("Sauvegarde...");
  await saveInspection(inspection);
  if (!options.silent) setSaveStatus("Sauvegarde faite");
}

async function saveInspection(inspection) {
  const snapshot = JSON.parse(JSON.stringify({
    id: inspection.id,
    address: inspection.address,
    propertyType: inspection.propertyType || DEFAULT_PROPERTY_TYPE,
    answers: inspection.answers,
  }));
  const previous = state.saveQueues.get(inspection.id) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      state.savingIds.add(inspection.id);
      const { data, error } = await supabaseClient
        .from("inspections")
        .update({
          address: snapshot.address,
          payload: toDbPayload(snapshot),
          updated_at: new Date().toISOString(),
        })
        .eq("id", snapshot.id)
        .select()
        .single();
      if (error) throw error;
      const updated = await hydrateInspectionPhotos(fromDbInspection(data));
      const index = state.inspections.findIndex((candidate) => candidate.id === inspection.id);
      if (index >= 0) state.inspections[index] = updated;
      return updated;
    })
    .finally(() => {
      state.savingIds.delete(inspection.id);
      if (state.saveQueues.get(inspection.id) === next) state.saveQueues.delete(inspection.id);
    });
  state.saveQueues.set(inspection.id, next);
  return next;
}

async function fileToPhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error("Le fichier choisi n'est pas une image.");
  const blob = await resizeImage(file);
  const path = `${state.user.id}/${uid()}.jpg`;
  const { error } = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const signed = await supabaseClient.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_PHOTO_URL_TTL);
  if (signed.error) throw signed.error;
  return { id: uid(), name: file.name, path, data: signed.data.signedUrl };
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("La photo n'a pas pu etre compressee."));
        }, "image/jpeg", PHOTO_QUALITY);
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function exportInspectionForNotion(inspection) {
  const markdown = buildNotionMarkdown(inspection);
  try {
    await navigator.clipboard.writeText(markdown);
    showToast("Inspection copiee pour Notion.");
  } catch {
    downloadTextFile(`${slugify(inspection.address || "inspection")}-notion.md`, markdown);
    showToast("Fichier Markdown telecharge pour Notion.");
  }
}

function buildNotionMarkdown(inspection) {
  const lines = [
    `# Inspection - ${inspection.address || "Adresse a completer"}`,
    "",
    `**Type de propriete:** ${propertyTypeLabel(inspection.propertyType)}`,
    `**Cree le:** ${formatDate(inspection.createdAt)}`,
    `**Modifie le:** ${formatDate(inspection.updatedAt)}`,
    "",
  ];
  inspectionSchema.forEach((category, categoryIndex) => {
    lines.push(`## ${categoryIndex + 1}) ${category.title}`, "");
    category.items.forEach(([title, help], itemIndex) => {
      const answer = inspection.answers[`${categoryIndex}-${itemIndex}`] || { ok: false, note: "", photos: [] };
      lines.push(`### ${answer.ok ? "[x]" : "[ ]"} ${title}`);
      lines.push(help, "", `**Note:** ${answer.note || "Aucune note inscrite."}`, `**Photos:** ${answer.photos.length}`, "");
    });
  });
  return lines.join("\n");
}

function exportInspectionPdf(inspection) {
  const html = buildPdfHtml(inspection);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    downloadTextFile(`${slugify(inspection.address || "inspection")}-rapport.html`, html);
    return showToast("Fenetre bloquee: fichier HTML telecharge pour impression PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.querySelector("#printBtn")?.addEventListener("click", () => printWindow.print());
  setTimeout(() => printWindow.focus(), 50);
  showToast("Rapport PDF pret dans un nouvel onglet.");
}

function buildPdfHtml(inspection) {
  const photos = collectInspectionPhotos(inspection);
  const sections = inspectionSchema.map((category, categoryIndex) => `
    <section class="section">
      <h2>${categoryIndex + 1}) ${escapeHtml(category.title)}</h2>
      ${category.items.map(([title, help], itemIndex) => {
        const answer = inspection.answers[`${categoryIndex}-${itemIndex}`] || { ok: false, note: "", photos: [] };
        return `
          <article class="item">
            <h3>${answer.ok ? "Inspecte" : "A verifier"} - ${escapeHtml(title)}</h3>
            <p class="help">${escapeHtml(help)}</p>
            <p><strong>Note:</strong> ${answer.note ? escapeHtml(answer.note) : "Aucune note inscrite."}</p>
            <p><strong>Photos:</strong> ${answer.photos.length}</p>
          </article>
        `;
      }).join("")}
    </section>
  `).join("");
  const photoSection = photos.length ? `
    <section class="section photo-annex">
      <h2>Photos en annexe</h2>
      <div class="photo-grid">
        ${photos.map((photo, index) => `
          <figure>
            <img src="${photo.data}" alt="${escapeHtml(photo.name)}" />
            <figcaption>${index + 1}. ${escapeHtml(photo.category)} - ${escapeHtml(photo.question)}</figcaption>
          </figure>
        `).join("")}
      </div>
    </section>
  ` : `<section class="section"><h2>Photos en annexe</h2><p>Aucune photo jointe a cette inspection.</p></section>`;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Rapport inspection - ${escapeHtml(inspection.address || "Sans adresse")}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; color: #17211c; font-family: Arial, Helvetica, sans-serif; line-height: 1.45; }
      main { max-width: 920px; margin: 0 auto; padding: 32px; }
      h1 { margin: 0 0 8px; font-size: 30px; }
      h2 { margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #22664b; color: #164835; font-size: 21px; }
      h3 { margin: 0 0 6px; font-size: 16px; }
      .meta { margin: 0 0 22px; color: #5f6b64; }
      .item { break-inside: avoid; margin: 0 0 12px; padding: 12px; border: 1px solid #d9d2c7; border-radius: 6px; }
      .help { margin-top: 0; color: #5f6b64; }
      .photo-annex { break-before: page; }
      .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      figure { break-inside: avoid; margin: 0; border: 1px solid #d9d2c7; border-radius: 6px; overflow: hidden; }
      img { display: block; width: 100%; max-height: 420px; object-fit: contain; background: #f3eee4; }
      figcaption { padding: 8px; font-size: 12px; color: #4d5a52; }
      .print-actions { position: sticky; top: 0; display: flex; justify-content: flex-end; padding: 10px 0; background: #fff; }
      button { min-height: 38px; padding: 0 14px; border: 0; border-radius: 6px; background: #22664b; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      @media print { main { padding: 0; } .print-actions { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <div class="print-actions"><button id="printBtn" type="button">Enregistrer en PDF</button></div>
      <h1>Rapport d'inspection</h1>
      <p class="meta">
        <strong>Adresse:</strong> ${escapeHtml(inspection.address || "Adresse a completer")}<br />
        <strong>Type de propriete:</strong> ${escapeHtml(propertyTypeLabel(inspection.propertyType))}<br />
        <strong>Cree le:</strong> ${formatDate(inspection.createdAt)}<br />
        <strong>Modifie le:</strong> ${formatDate(inspection.updatedAt)}
      </p>
      ${sections}
      ${photoSection}
    </main>
  </body>
</html>`;
}

function collectInspectionPhotos(inspection) {
  const photos = [];
  inspectionSchema.forEach((category, categoryIndex) => {
    category.items.forEach(([title], itemIndex) => {
      const answer = inspection.answers[`${categoryIndex}-${itemIndex}`] || { photos: [] };
      answer.photos.forEach((photo) => photos.push({ ...photo, category: category.title, question: title }));
    });
  });
  return photos;
}

function bindPhotoViewer(inspection) {
  document.querySelectorAll("[data-open-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const photos = Object.values(inspection.answers).flatMap((answer) => answer.photos);
      const photo = photos.find((candidate) => candidate.id === button.dataset.openPhoto);
      if (photo) openPhotoViewer(photo);
    });
  });
}

function openPhotoViewer(photo) {
  const viewer = document.createElement("div");
  viewer.className = "photo-viewer";
  viewer.innerHTML = `
    <button class="photo-viewer-close" type="button" aria-label="Fermer">x</button>
    <img src="${photo.data}" alt="${escapeHtml(photo.name)}" />
    <p>${escapeHtml(photo.name)}</p>
  `;
  document.body.appendChild(viewer);
  const close = () => {
    viewer.remove();
    document.removeEventListener("keydown", onKeydown);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) close();
  });
  viewer.querySelector(".photo-viewer-close").addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);
}

function downloadTextFile(filename, content) {
  const type = filename.endsWith(".html") ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8";
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "inspection";
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function setSaveStatus(message) {
  const status = document.querySelector("#saveStatus");
  if (status) status.textContent = message;
}

async function runButtonAction(button, action) {
  const target = button instanceof HTMLElement ? button : null;
  const originalText = target?.textContent;
  try {
    if (target) {
      target.disabled = true;
      target.setAttribute("aria-busy", "true");
      if (target.classList.contains("primary")) target.textContent = "Traitement...";
    }
    await action();
    return true;
  } catch (error) {
    showToast(error.message || "Action impossible pour le moment.");
    return false;
  } finally {
    if (target) {
      target.disabled = false;
      target.removeAttribute("aria-busy");
      if (originalText) target.textContent = originalText;
    }
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

window.addEventListener("hashchange", render);
window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
});
supabaseClient?.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") render();
  if (event === "SIGNED_IN" && !state.user) render();
  if (event === "USER_UPDATED") render();
});
render();
