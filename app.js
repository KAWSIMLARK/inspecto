const SUPABASE_URL = "https://itabonpgzpokcdfcyhdx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YWJvbnBnenBva2NkZmN5aGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjI3MDksImV4cCI6MjA5MzgzODcwOX0.FGR5Ol7H8Ln7zEhCG_gbKqfRL-lEoQg2BFPlCVGLwSs";
const PHOTO_BUCKET = "inspection-photos";
const MAX_PHOTO_SIZE = 1600;
const PHOTO_QUALITY = 0.78;

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

const $app = document.querySelector("#app");
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const state = { user: null, inspections: [] };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

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
  return { id: uid(), address: "", createdAt: now, updatedAt: now, answers };
}

async function render() {
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

  state.inspections = data.map(fromDbInspection);
  return true;
}

function fromDbInspection(row) {
  const inspection = buildEmptyInspection();
  const payload = row.payload || {};
  return {
    ...inspection,
    ...payload,
    id: row.id,
    address: row.address || payload.address || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    answers: { ...inspection.answers, ...(payload.answers || {}) },
  };
}

function toDbPayload(inspection) {
  return { address: inspection.address, answers: inspection.answers };
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
              <button class="btn primary full" type="submit">${mode === "login" ? "Se connecter" : "Creer le compte"}</button>
              ${message ? `<div class="error">${escapeHtml(message)}</div>` : ""}
              <p class="muted">Les comptes, inspections et photos sont synchronises avec Supabase.</p>
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
  document.querySelector("#logoutBtn")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.hash = "";
    await render();
  });
  document.querySelector("#archiveBtn")?.addEventListener("click", () => {
    location.hash = "";
    render();
  });
}

function renderArchive() {
  const inspections = [...state.inspections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(state.user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <h1>Archives d'inspection</h1>
            <p>${inspections.length} dossier${inspections.length > 1 ? "s" : ""} lie${inspections.length > 1 ? "s" : ""} a ton profil.</p>
          </div>
          <button class="btn primary" id="newInspectionBtn">+ Nouvelle inspection</button>
        </section>
        ${inspections.length ? `
          <section class="archive-grid">
            ${inspections.map((inspection) => renderInspectionCard(inspection)).join("")}
          </section>
        ` : `
          <section class="empty">
            <h2>Aucune inspection enregistree</h2>
            <p class="muted">Cree un premier dossier, ajoute l'adresse, tes notes et les photos question par question.</p>
          </section>
        `}
      </main>
    </div>
  `;
  bindTopbar();
  document.querySelector("#newInspectionBtn").addEventListener("click", createInspection);
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
    button.addEventListener("click", () => deleteInspection(button.dataset.delete));
  });
}

function renderInspectionCard(inspection) {
  const completed = Object.values(inspection.answers).filter((answer) => answer.ok || answer.note || answer.photos.length).length;
  const photos = Object.values(inspection.answers).reduce((sum, answer) => sum + answer.photos.length, 0);
  return `
    <article class="inspection-card">
      <div>
        <h2 class="card-title">${escapeHtml(inspection.address || "Adresse a completer")}</h2>
        <p class="muted">Modifie le ${formatDate(inspection.updatedAt)}</p>
      </div>
      <div class="card-meta">
        <span class="badge">${completed}/28 elements</span>
        <span class="badge">${photos} photo${photos > 1 ? "s" : ""}</span>
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

  const completed = Object.values(inspection.answers).filter((answer) => answer.ok || answer.note || answer.photos.length).length;
  const photos = Object.values(inspection.answers).reduce((sum, answer) => sum + answer.photos.length, 0);

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
        <section class="summary-strip">
          <span class="badge">${completed}/28 elements documentes</span>
          <span class="badge">${photos} photo${photos > 1 ? "s" : ""}</span>
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
        <span class="status-dot ${answer.ok ? "done" : ""}">${answer.ok ? "✓" : "-"}</span>
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

  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(state.user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <h1>Formulaire d'inspection</h1>
            <p>Les changements sont sauvegardes a l'ajout d'une photo et lorsque tu cliques sur Enregistrer.</p>
          </div>
        </section>
        <form id="inspectionForm" class="form-shell">
          <nav class="side-nav">
            ${inspectionSchema.map((category, index) => `
              <button type="button" data-jump="${index}" class="${index === 0 ? "active" : ""}">
                <span>${index + 1}. ${escapeHtml(category.title)}</span>
                <span>${category.items.length}</span>
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
              </div>
            </div>
            ${inspectionSchema.map((category, categoryIndex) => renderCategory(category, categoryIndex, inspection)).join("")}
            <div class="form-actions">
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
  return `
    <section class="category" id="cat-${categoryIndex}">
      <header class="category-header">
        <h2>${categoryIndex + 1}) ${escapeHtml(category.title)}</h2>
        <span class="badge">${category.items.length} points</span>
      </header>
      ${category.items.map((item, itemIndex) => renderQuestion(item, categoryIndex, itemIndex, inspection)).join("")}
    </section>
  `;
}

function renderQuestion([title, help], categoryIndex, itemIndex, inspection) {
  const key = `${categoryIndex}-${itemIndex}`;
  const answer = inspection.answers[key] || { ok: false, note: "", photos: [] };
  return `
    <article class="question" data-question="${key}">
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
          Ajouter
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
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-jump]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#cat-${button.dataset.jump}`).scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelector("#cancelBtn").addEventListener("click", () => {
    location.hash = "";
    render();
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
      await saveInspectionFromForm(inspectionId);
      const inspection = findInspection(inspectionId);
      inspection.answers[key].photos.splice(Number(index), 1);
      await saveInspection(inspection);
      await render();
    });
  });

  document.querySelector("#inspectionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveInspectionFromForm(inspectionId);
    location.hash = `view=detail&id=${inspectionId}`;
    await render();
  });
}

async function saveInspectionFromForm(inspectionId) {
  const form = document.querySelector("#inspectionForm");
  if (!form) return;
  const inspection = findInspection(inspectionId);
  inspection.address = document.querySelector("#address").value.trim();
  document.querySelectorAll("[data-question]").forEach((question) => {
    const key = question.dataset.question;
    inspection.answers[key].ok = question.querySelector('[data-field="ok"]').checked;
    inspection.answers[key].note = question.querySelector('[data-field="note"]').value.trim();
  });
  await saveInspection(inspection);
}

async function saveInspection(inspection) {
  const { data, error } = await supabaseClient
    .from("inspections")
    .update({
      address: inspection.address,
      payload: toDbPayload(inspection),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inspection.id)
    .select()
    .single();
  if (error) throw error;
  const updated = fromDbInspection(data);
  const index = state.inspections.findIndex((candidate) => candidate.id === inspection.id);
  if (index >= 0) state.inspections[index] = updated;
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
  const { data } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { id: uid(), name: file.name, path, data: data.publicUrl };
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
  printWindow.focus();
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
      <div class="print-actions"><button onclick="window.print()">Enregistrer en PDF</button></div>
      <h1>Rapport d'inspection</h1>
      <p class="meta">
        <strong>Adresse:</strong> ${escapeHtml(inspection.address || "Adresse a completer")}<br />
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

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

window.addEventListener("hashchange", render);
supabaseClient?.auth.onAuthStateChange(() => render());
render();
