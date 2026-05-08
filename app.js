const STORAGE_KEY = "inspecto.demo.v1";

const inspectionSchema = [
  {
    title: "Extérieur",
    items: [
      ["Fondation", "Y a-t-il des fissures actives ou anciennes? De l'humidité visible au sous-sol? Bloc ou coulé?"],
      ["Revêtement extérieur", "Quelle est l'année d'installation? Zones déjà réparées? Section endommagée? Possibilité d'infiltration d'eau? Composition bien faite?"],
      ["Portes / Fenêtres", "Sont-elles toutes fonctionnelles? Sont-elles toutes Egress? Infiltration? Morceaux manquants?"],
      ["Balcons / Escaliers / Garde-corps", "Sont-ils solides et conformes au code? Rouille ou bois pourri? Étriers? Ils sont assis sur quoi?"],
      ["Drainage du terrain, stationnement, trottoirs", "L'eau s'éloigne-t-elle bien du bâtiment? Stationnement ou trottoirs fissurés?"],
    ],
  },
  {
    title: "Toiture",
    items: [
      ["Revêtement (bardeaux/tôle)", "Date de la dernière réfection? Années de garantie restantes? Matériaux? Compagnie?"],
      ["Gouttières et descentes", "Fonctionnelles ou obstruées? L'eau s'éloigne-t-elle des fondations? Sections manquantes?"],
      ["Solins, émergences", "Ont-ils été entretenus récemment? Y a-t-il des fissures?"],
      ["Traces d'infiltration", "Y a-t-il eu des réparations de plafond liées à des fuites?"],
    ],
  },
  {
    title: "Structure",
    items: [
      ["Planchers (dénivellation)", "Y a-t-il du dénivellement ou du craquement?"],
      ["Murs porteurs (fissures/humidité)", "Présence de fissures traversantes ou d'humidité?"],
      ["Poutres / Colonnes / Solives", "Ont-elles subi des renforcements ou réparations visibles? Nouvel footing, etc."],
    ],
  },
  {
    title: "Plomberie",
    items: [
      ["Entrée d'eau principale", "Est-elle équipée d'un clapet antiretour? Réparation visible ou réfection?"],
      ["Chauffe-eau (âge, fuite, soupape)", "Quelle est l'année? Fuites ou corrosion? Pièce manquante?"],
      ["Tuyauterie visible", "Matériau utilisé (cuivre, PEX, poly-B)? Sections déjà remplacées?"],
      ["Salle de bain", "Ventilation efficace? Scellant en bon état?"],
    ],
  },
  {
    title: "Électricité",
    items: [
      ["Panneaux", "Année, capacité en ampères, conformité aux normes actuelles, marque?"],
      ["Prises DDFT (GFCI)", "Présentes et fonctionnelles dans la cuisine et salle de bain?"],
      ["Éclairage / Interrupteurs / plinthe", "Tous fonctionnels? Trace de surchauffe?"],
      ["Détecteurs fumée / CO", "Fonctionnels? Manquants?"],
    ],
  },
  {
    title: "Chauffage & Ventilation",
    items: [
      ["Système de chauffage (type/état)", "Type, âge, état général et entretien visible."],
      ["Ventilation sdb et cuisine", "Sortie vers l'extérieur ou seulement recirculation?"],
      ["Conduit sécheuse", "Est-il propre et bien raccordé vers l'extérieur?"],
    ],
  },
  {
    title: "Intérieur",
    items: [
      ["Planchers / Murs / Plafonds", "Y a-t-il des signes de dégât des eaux ou de moisissure?"],
      ["Armoires / Comptoirs", "Âge et état général? Besoin de remplacement?"],
      ["Odeurs / humidité", "Odeur persistante (moisi, cigarette, animaux)?"],
    ],
  },
  {
    title: "Autres",
    items: [
      ["Isolation / Entretoit", "Y a-t-il un accès facile? L'isolant est-il uniforme?"],
      ["Insectes / Vermine", "Traces de présence (excréments, trous, nids, trappes)?"],
    ],
  },
];

const $app = document.querySelector("#app");

const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

function loadState() {
  const fallback = { users: [], sessionEmail: null };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentUser() {
  const state = loadState();
  return state.users.find((user) => user.email === state.sessionEmail) || null;
}

function setSession(email) {
  const state = loadState();
  state.sessionEmail = email;
  saveState(state);
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
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
      answers[`${categoryIndex}-${itemIndex}`] = {
        ok: false,
        note: "",
        photos: [],
      };
    });
  });

  return {
    id: uid(),
    address: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    answers,
  };
}

function render() {
  const user = currentUser();
  if (!user) {
    renderAuth();
    return;
  }

  const params = new URLSearchParams(location.hash.replace("#", ""));
  if (params.get("view") === "form") {
    renderForm(params.get("id"));
    return;
  }
  if (params.get("view") === "detail") {
    renderDetail(params.get("id"));
    return;
  }

  renderArchive();
}

function renderAuth(mode = "login", message = "") {
  $app.innerHTML = `
    <main class="auth-layout">
      <section class="auth-visual">
        <div class="brand"><span class="brand-mark">I</span><span>Inspecto</span></div>
        <h1>Compiler une inspection sans perdre le fil.</h1>
        <p>Un espace simple pour créer un dossier par immeuble, joindre les photos au bon endroit et retrouver l'historique lié à ton profil.</p>
      </section>
      <section class="auth-panel">
        <div class="panel">
          <div class="panel-inner">
            <div class="tabs">
              <button class="tab ${mode === "login" ? "active" : ""}" data-auth-tab="login">Connexion</button>
              <button class="tab ${mode === "signup" ? "active" : ""}" data-auth-tab="signup">Créer un compte</button>
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
                <input id="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required minlength="4" />
              </div>
              <button class="btn primary full" type="submit">${mode === "login" ? "Se connecter" : "Créer le compte"}</button>
              ${message ? `<div class="error">${escapeHtml(message)}</div>` : ""}
              <p class="muted">Preview local: les données restent dans ce navigateur jusqu'à l'ajout d'un backend.</p>
            </form>
          </div>
        </div>
      </section>
    </main>
  `;

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => renderAuth(button.dataset.authTab));
  });

  document.querySelector("#authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const state = loadState();
    const email = document.querySelector("#email").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    const user = state.users.find((candidate) => candidate.email === email);

    if (mode === "signup") {
      if (user) {
        renderAuth("signup", "Un compte existe déjà avec ce courriel.");
        return;
      }
      state.users.push({
        id: uid(),
        name: document.querySelector("#name").value.trim(),
        email,
        password,
        inspections: [],
      });
      state.sessionEmail = email;
      saveState(state);
      location.hash = "";
      render();
      return;
    }

    if (!user || user.password !== password) {
      renderAuth("login", "Courriel ou mot de passe invalide.");
      return;
    }
    setSession(email);
    location.hash = "";
    render();
  });
}

function renderTopbar(user) {
  return `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">I</span><span>Inspecto</span></div>
      <div class="topbar-actions">
        <span class="user-chip">${escapeHtml(user.name || user.email)}</span>
        <button class="btn ghost" id="archiveBtn">Archives</button>
        <button class="btn danger" id="logoutBtn">Déconnexion</button>
      </div>
    </header>
  `;
}

function bindTopbar() {
  document.querySelector("#logoutBtn")?.addEventListener("click", () => {
    setSession(null);
    location.hash = "";
    render();
  });
  document.querySelector("#archiveBtn")?.addEventListener("click", () => {
    location.hash = "";
    render();
  });
}

function renderArchive() {
  const user = currentUser();
  const inspections = [...(user.inspections || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <h1>Archives d'inspection</h1>
            <p>${inspections.length} dossier${inspections.length > 1 ? "s" : ""} lié${inspections.length > 1 ? "s" : ""} à ton profil.</p>
          </div>
          <button class="btn primary" id="newInspectionBtn">+ Nouvelle inspection</button>
        </section>
        ${inspections.length ? `
          <section class="archive-grid">
            ${inspections.map((inspection) => renderInspectionCard(inspection)).join("")}
          </section>
        ` : `
          <section class="empty">
            <h2>Aucune inspection enregistrée</h2>
            <p class="muted">Crée un premier dossier, ajoute l'adresse, tes notes et les photos question par question.</p>
          </section>
        `}
      </main>
    </div>
  `;
  bindTopbar();
  document.querySelector("#newInspectionBtn").addEventListener("click", () => {
    const inspection = buildEmptyInspection();
    mutateUser((draft) => draft.inspections.push(inspection));
    location.hash = `view=form&id=${inspection.id}`;
    render();
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
    button.addEventListener("click", () => {
      if (!confirm("Supprimer cette inspection?")) return;
      mutateUser((draft) => {
        draft.inspections = draft.inspections.filter((inspection) => inspection.id !== button.dataset.delete);
      });
      renderArchive();
    });
  });
}

function renderInspectionCard(inspection) {
  const completed = Object.values(inspection.answers).filter((answer) => answer.ok || answer.note || answer.photos.length).length;
  const photos = Object.values(inspection.answers).reduce((sum, answer) => sum + answer.photos.length, 0);
  return `
    <article class="inspection-card">
      <div>
        <h2 class="card-title">${escapeHtml(inspection.address || "Adresse à compléter")}</h2>
        <p class="muted">Modifié le ${formatDate(inspection.updatedAt)}</p>
      </div>
      <div class="card-meta">
        <span class="badge">${completed}/28 éléments</span>
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

function mutateUser(mutator) {
  const state = loadState();
  const index = state.users.findIndex((user) => user.email === state.sessionEmail);
  if (index === -1) return;
  mutator(state.users[index]);
  saveState(state);
}

function findInspection(id) {
  const user = currentUser();
  return user?.inspections?.find((inspection) => inspection.id === id);
}

function renderDetail(id) {
  const user = currentUser();
  const inspection = findInspection(id);
  if (!inspection) {
    location.hash = "";
    renderArchive();
    return;
  }

  const completed = Object.values(inspection.answers).filter((answer) => answer.ok || answer.note || answer.photos.length).length;
  const photos = Object.values(inspection.answers).reduce((sum, answer) => sum + answer.photos.length, 0);

  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <h1>${escapeHtml(inspection.address || "Inspection sans adresse")}</h1>
            <p>Créé le ${formatDate(inspection.createdAt)} · Modifié le ${formatDate(inspection.updatedAt)}</p>
          </div>
          <div class="topbar-actions">
            <button class="btn ghost" id="backToArchiveBtn">Archives</button>
            <button class="btn primary" id="editFromDetailBtn">Modifier</button>
          </div>
        </section>
        <section class="summary-strip">
          <span class="badge">${completed}/28 éléments documentés</span>
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
  bindPhotoViewer(inspection);
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

function renderDetailCategory(category, categoryIndex, inspection) {
  return `
    <section class="category">
      <header class="category-header">
        <h2>${categoryIndex + 1}) ${escapeHtml(category.title)}</h2>
      </header>
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
  const user = currentUser();
  const inspection = findInspection(id);
  if (!inspection) {
    location.hash = "";
    renderArchive();
    return;
  }

  $app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar(user)}
      <main class="container">
        <section class="hero-row">
          <div>
            <h1>Formulaire d'inspection</h1>
            <p>Les changements sont sauvegardés à l'ajout d'une photo et lorsque tu cliques sur Enregistrer.</p>
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
                  <input id="address" value="${escapeHtml(inspection.address)}" placeholder="123 rue Principale, Montréal" required />
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
        <input class="check" type="checkbox" data-field="ok" ${answer.ok ? "checked" : ""} aria-label="Point inspecté" />
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
      <div class="thumbs" data-thumbs="${key}">
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
      saveInspectionFromForm(inspectionId);
      const photos = await Promise.all(files.map(fileToPhoto));
      mutateInspection(inspectionId, (inspection) => {
        inspection.answers[key].photos.push(...photos);
        inspection.updatedAt = new Date().toISOString();
      });
      renderForm(inspectionId);
    });
  });

  document.querySelectorAll("[data-remove-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const [key, index] = button.dataset.removePhoto.split(":");
      saveInspectionFromForm(inspectionId);
      mutateInspection(inspectionId, (inspection) => {
        inspection.answers[key].photos.splice(Number(index), 1);
        inspection.updatedAt = new Date().toISOString();
      });
      renderForm(inspectionId);
    });
  });

  document.querySelector("#inspectionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveInspectionFromForm(inspectionId);
    location.hash = `view=detail&id=${inspectionId}`;
    render();
  });
}

function saveInspectionFromForm(inspectionId) {
  const form = document.querySelector("#inspectionForm");
  if (!form) return;

  mutateInspection(inspectionId, (inspection) => {
    inspection.address = document.querySelector("#address").value.trim();
    document.querySelectorAll("[data-question]").forEach((question) => {
      const key = question.dataset.question;
      inspection.answers[key].ok = question.querySelector('[data-field="ok"]').checked;
      inspection.answers[key].note = question.querySelector('[data-field="note"]').value.trim();
    });
    inspection.updatedAt = new Date().toISOString();
  });
}

function mutateInspection(inspectionId, mutator) {
  mutateUser((user) => {
    const inspection = user.inspections.find((candidate) => candidate.id === inspectionId);
    if (inspection) mutator(inspection);
  });
}

function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: uid(), name: file.name, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

window.addEventListener("hashchange", render);
render();
