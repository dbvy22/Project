import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Configuration Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyCeKKMikw6mo4Ck1OYqLl4DbL9HaFdf3Xs",
  authDomain: "simulateur-7566e.firebaseapp.com",
  projectId: "simulateur-7566e",
  storageBucket: "simulateur-7566e.firebasestorage.app",
  messagingSenderId: "208551207652",
  appId: "1:208551207652:web:5d4176ba23f50267d802f1",
  measurementId: "G-S0J7Y3YH0P"
};

// Initialisation de Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const budgetDocRef = doc(db, "budgets", "mainData");

let idCounter = 0;
function nextId() {
  idCounter++;
  return idCounter;
}

function nouveauBudgetVide() {
  return {
    revenus: [],
    investissements: [],
    epargne: [],
    depensesFixes: [],       // liste de catégories : [{id, nom, items: [...]}]
    depensesVariables: []    // liste plate : [{id, nom, valeur}]
  };
}

let data = {
  Denis: nouveauBudgetVide(),
  Margot: nouveauBudgetVide()
};

let currentPerson = "Denis";

function createItem(nom = "", valeur = 0) {
  return { id: nextId(), nom, valeur };
}

// Empecher les sauvegardes déclenchées par la mise à jour depuis Firebase
let isUpdatingFromFirebase = false;

// --- Sauvegarde dans Firebase Firestore ---
async function sauvegarder() {
  if (isUpdatingFromFirebase) return;
  try {
    await setDoc(budgetDocRef, {
      data: data,
      currentPerson: currentPerson
    });
  } catch (e) {
    console.error("Erreur de sauvegarde Firebase :", e);
  }
}

// --- Écoute en temps réel des modifications Firebase ---
function ecouterFirebase() {
  onSnapshot(budgetDocRef, (snapshot) => {
    if (snapshot.exists()) {
      // Si l'utilisateur est en train de taper dans un champ, on ne régénère pas l'UI pour ne pas perdre le focus / fermer le clavier
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        return;
      }

      isUpdatingFromFirebase = true;
      const docData = snapshot.data();

      if (docData.data) {
        data.Denis = docData.data.Denis || nouveauBudgetVide();
        data.Margot = docData.data.Margot || nouveauBudgetVide();
      }

      if (docData.currentPerson === "Denis" || docData.currentPerson === "Margot") {
        currentPerson = docData.currentPerson;
      }

      // Recalculer le compteur d'IDs max
      const tousLesIds = [];
      [data.Denis, data.Margot].forEach(budget => {
        tousLesIds.push(
          ...budget.revenus.map(i => i.id),
          ...budget.investissements.map(i => i.id),
          ...budget.epargne.map(i => i.id),
          ...budget.depensesFixes.flatMap(c => [c.id, ...c.items.map(i => i.id)]),
          ...budget.depensesVariables.map(i => i.id)
        );
      });
      idCounter = tousLesIds.length ? Math.max(...tousLesIds) : 0;

      // Mettre à jour les boutons de personne
      document.querySelectorAll(".btn-person").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.person === currentPerson);
      });

      renderAllUI();
      isUpdatingFromFirebase = false;
    } else {
      // Premier lancement : créer le document par défaut
      data.Denis.revenus.push(createItem("Salaire"));
      data.Denis.depensesFixes.push({ id: nextId(), nom: "Logement", items: [createItem("Loyer")] });
      data.Denis.depensesVariables.push(createItem("Courses"));
      sauvegarder();
    }
  }, (error) => {
    console.error("Erreur d'écoute Firebase :", error);
  });
}

// --- Rendu d'une liste plate (revenus / investissements / épargne / dépenses variables) ---
function renderSimpleList(type) {
  const container = document.getElementById(`${type}-list`);
  container.innerHTML = "";

  data[currentPerson][type].forEach(item => {
    const row = document.createElement("div");
    row.className = "item-row";

    const nomInput = document.createElement("input");
    nomInput.type = "text";
    nomInput.placeholder = "Nom";
    nomInput.value = item.nom;
    nomInput.addEventListener("input", () => {
      item.nom = nomInput.value;
      renderBudgetChart(data[currentPerson]);
      sauvegarder(); // Enregistre en tâche de fond sans reconstruire l'UI
    });

    const valeurInput = document.createElement("input");
    valeurInput.type = "number";
    valeurInput.placeholder = "0";
    valeurInput.value = item.valeur || "";
    valeurInput.addEventListener("input", () => {
      item.valeur = parseFloat(valeurInput.value) || 0;
      updateTotalsOnly(); // Calcule uniquement les totaux sans reconstruire l'UI
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      data[currentPerson][type] = data[currentPerson][type].filter(i => i.id !== item.id);
      renderSimpleList(type);
      updateTotalsOnly();
      sauvegarder();
    });

    row.appendChild(nomInput);
    row.appendChild(valeurInput);
    row.appendChild(deleteBtn);
    container.appendChild(row);
  });
}

// --- Rendu des dépenses fixes (avec catégories) ---
function renderDepensesFixes() {
  const container = document.getElementById("depensesFixes-categories");
  container.innerHTML = "";

  data[currentPerson].depensesFixes.forEach(categorie => {
    const block = document.createElement("div");
    block.className = "categorie-block";

    const header = document.createElement("div");
    header.className = "categorie-header";

    const nomInput = document.createElement("input");
    nomInput.type = "text";
    nomInput.placeholder = "Nom de la catégorie (ex: Logement)";
    nomInput.value = categorie.nom;
    nomInput.addEventListener("input", () => {
      categorie.nom = nomInput.value;
      renderBudgetChart(data[currentPerson]);
      sauvegarder();
    });

    const deleteCategorieBtn = document.createElement("button");
    deleteCategorieBtn.className = "btn-delete";
    deleteCategorieBtn.textContent = "✕";
    deleteCategorieBtn.addEventListener("click", () => {
      data[currentPerson].depensesFixes = data[currentPerson].depensesFixes.filter(c => c.id !== categorie.id);
      renderDepensesFixes();
      updateTotalsOnly();
      sauvegarder();
    });

    header.appendChild(nomInput);
    header.appendChild(deleteCategorieBtn);
    block.appendChild(header);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "items-list";

    categorie.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-row";

      const itemNomInput = document.createElement("input");
      itemNomInput.type = "text";
      itemNomInput.placeholder = "Nom";
      itemNomInput.value = item.nom;
      itemNomInput.addEventListener("input", () => {
        item.nom = itemNomInput.value;
        renderBudgetChart(data[currentPerson]);
        sauvegarder();
      });

      const itemValeurInput = document.createElement("input");
      itemValeurInput.type = "number";
      itemValeurInput.placeholder = "0";
      itemValeurInput.value = item.valeur || "";
      itemValeurInput.addEventListener("input", () => {
        item.valeur = parseFloat(itemValeurInput.value) || 0;
        updateTotalsOnly();
      });

      const itemDeleteBtn = document.createElement("button");
      itemDeleteBtn.className = "btn-delete";
      itemDeleteBtn.textContent = "✕";
      itemDeleteBtn.addEventListener("click", () => {
        categorie.items = categorie.items.filter(i => i.id !== item.id);
        renderDepensesFixes();
        updateTotalsOnly();
        sauvegarder();
      });

      row.appendChild(itemNomInput);
      row.appendChild(itemValeurInput);
      row.appendChild(itemDeleteBtn);
      itemsContainer.appendChild(row);
    });

    block.appendChild(itemsContainer);

    const addItemBtn = document.createElement("button");
    addItemBtn.className = "btn-add-small";
    addItemBtn.textContent = "+ Ajouter une ligne";
    addItemBtn.addEventListener("click", () => {
      categorie.items.push(createItem());
      renderDepensesFixes();
      sauvegarder();
    });
    block.appendChild(addItemBtn);

    container.appendChild(block);
  });
}

// --- Calcul des totaux et des pourcentages ---
function sumItems(list) {
  return list.reduce((acc, item) => acc + (item.valeur || 0), 0);
}

function sumCategories(categories) {
  return categories.reduce((acc, cat) => acc + sumItems(cat.items), 0);
}

function renderBudgetChart(budget) {
  const svg = document.getElementById("budget-chart");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const palette = ["#9986bc", "#728aa5", "#6c9a91", "#8575a2", "#5f9699", "#718cb5"];
  const formatMontant = valeur => `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
  const makeSvgElement = (name, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };
  const addLabel = (parent, text, x, y, anchor, className) => {
    const label = makeSvgElement("text", { x, y, "text-anchor": anchor, class: className });
    label.textContent = text;
    parent.appendChild(label);
    return label;
  };
  const addValueLabel = (parent, text, fullText, x, y, maxWidth, amount, maxAmount) => {
    const fontSize = Math.min(16, 11.5 + Math.sqrt(amount / maxAmount) * 4.5);
    const labelGroup = makeSvgElement("g");
    parent.appendChild(labelGroup);
    const label = addLabel(labelGroup, text, x, y, "middle", "chart-label");
    label.style.fontSize = `${fontSize}px`;
    while (label.getComputedTextLength() > maxWidth && label.textContent.length > 4) {
      label.textContent = `${label.textContent.slice(0, -2)}…`;
    }
    const title = makeSvgElement("title");
    title.textContent = fullText;
    label.appendChild(title);
    const bounds = label.getBBox();
    labelGroup.appendChild(makeSvgElement("rect", {
      x: bounds.x - 8,
      y: bounds.y - 4,
      width: bounds.width + 16,
      height: bounds.height + 8,
      rx: 6,
      class: "chart-label-bg"
    }));
    labelGroup.insertBefore(labelGroup.querySelector("rect"), label);
  };
  const groups = [];
  const addGroup = (nom, items, couleur) => {
    const details = items
      .filter(item => item.valeur > 0)
      .map(item => ({ nom: item.nom.trim() || "Sans nom", valeur: item.valeur }));
    const valeur = details.reduce((total, item) => total + item.valeur, 0);
    if (valeur > 0) groups.push({ nom, valeur, details, couleur });
  };

  addGroup("Investissements", budget.investissements, palette[0]);
  addGroup("Épargne", budget.epargne, palette[1]);
  budget.depensesFixes.forEach((categorie, index) => {
    addGroup(categorie.nom.trim() || "Sans catégorie", categorie.items, palette[(index + 2) % palette.length]);
  });
  addGroup("Dépenses variables", budget.depensesVariables, palette[2]);

  const totalRevenus = sumItems(budget.revenus);
  const montantAffecte = groups.reduce((total, group) => total + group.valeur, 0);
  const resteDisponible = Math.max(0, totalRevenus - montantAffecte);
  if (resteDisponible > 0) {
    groups.push({
      nom: "Reste disponible",
      valeur: resteDisponible,
      details: [{ nom: "Disponible", valeur: resteDisponible }],
      couleur: "#78a894"
    });
  }

  const maxLabelAmount = groups.reduce((max, group) =>
    group.details.reduce((detailMax, detail) => Math.max(detailMax, detail.valeur), Math.max(max, group.valeur)), 1);
  const nombreDetails = groups.reduce((total, group) => total + group.details.length, 0);
  const nombreNoeuds = Math.max(1, nombreDetails, groups.length);
  const hauteur = Math.max(300, nombreNoeuds * 34 + 64);
  const margeVerticale = 24;
  const totalAffecte = groups.reduce((total, group) => total + group.valeur, 0);
  const montantMax = Math.max(totalRevenus, totalAffecte, 1);
  const hauteurDisponible = hauteur - margeVerticale * 2;
  const hauteurMinimaleLibelle = 28;
  const groupesDetails = groups.flatMap((group, groupIndex) =>
    group.details.map(detail => ({ ...detail, groupIndex }))
  );
  const hauteurTotaleNoeuds = (noeuds, echelleCandidate) =>
    noeuds.reduce((total, noeud) => total + Math.max(noeud.valeur * echelleCandidate, hauteurMinimaleLibelle), 0);
  let echelleMin = 0;
  let echelleMax = hauteurDisponible / montantMax;
  for (let iteration = 0; iteration < 32; iteration++) {
    const echelleCandidate = (echelleMin + echelleMax) / 2;
    const tientDansGraphique = hauteurTotaleNoeuds(groups, echelleCandidate) <= hauteurDisponible
      && hauteurTotaleNoeuds(groupesDetails, echelleCandidate) <= hauteurDisponible;
    if (tientDansGraphique) echelleMin = echelleCandidate;
    else echelleMax = echelleCandidate;
  }
  const echelle = echelleMin;
  const revenuHauteur = Math.max(totalRevenus * echelle, totalRevenus > 0 ? 4 : 0);
  const budgetY = (hauteur - revenuHauteur) / 2;
  const positionsGroupes = [];
  const positionsDetails = [];
  const placerNoeuds = (noeuds, listePositions) => {
    const hauteurTotale = hauteurTotaleNoeuds(noeuds, echelle);
    let y = (hauteur - hauteurTotale) / 2;
    noeuds.forEach(noeud => {
      const nodeHeight = noeud.valeur * echelle;
      const slotHeight = Math.max(nodeHeight, hauteurMinimaleLibelle);
      listePositions.push({ ...noeud, y: y + (slotHeight - nodeHeight) / 2, hauteur: nodeHeight });
      y += slotHeight;
    });
  };

  placerNoeuds(groups, positionsGroupes);
  placerNoeuds(groupesDetails.map(detail => ({
    ...detail,
    couleur: groups[detail.groupIndex].couleur
  })), positionsDetails);

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 700 ${hauteur}`);
  svg.setAttribute("height", hauteur);

  if (totalRevenus <= 0 && totalAffecte <= 0) {
    const emptyText = makeSvgElement("text", {
      x: "50%", y: "50%", "text-anchor": "middle", class: "chart-empty"
    });
    emptyText.textContent = "Ajoutez des montants pour afficher la répartition de votre budget.";
    svg.appendChild(emptyText);
    return;
  }

  const links = makeSvgElement("g");
  const nodes = makeSvgElement("g");
  svg.append(links, nodes);
  const pathForFlow = (x1, y1, x2, y2, flowHeight) => {
    const curve = (x2 - x1) * 0.48;
    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2} L ${x2} ${y2 + flowHeight} C ${x2 - curve} ${y2 + flowHeight}, ${x1 + curve} ${y1 + flowHeight}, ${x1} ${y1 + flowHeight} Z`;
  };
  const addFlow = (x1, y1, x2, y2, amount, color) => {
    if (amount <= 0) return;
    links.appendChild(makeSvgElement("path", {
      d: pathForFlow(x1, y1, x2, y2, amount * echelle),
      fill: color,
      class: "chart-flow"
    }));
  };

  const revenueY = (hauteur - revenuHauteur) / 2;
  addFlow(35, revenueY, 189, budgetY, totalRevenus, "#b9c8f4");
  let revenueOffset = 0;
  positionsGroupes.forEach(group => {
    addFlow(196, budgetY + revenueOffset, 390, group.y, group.valeur, group.couleur);
    revenueOffset += group.valeur * echelle;
  });

  const offsetsDetails = new Map();
  positionsGroupes.forEach((group, groupIndex) => offsetsDetails.set(groupIndex, 0));
  positionsDetails.forEach(detail => {
    const group = positionsGroupes[detail.groupIndex];
    const offset = offsetsDetails.get(detail.groupIndex);
    addFlow(397, group.y + offset, 490, detail.y, detail.valeur, detail.couleur);
    offsetsDetails.set(detail.groupIndex, offset + detail.valeur * echelle);
  });

  const addNode = (x, y, nodeHeight, color) => {
    if (nodeHeight <= 0) return;
    nodes.appendChild(makeSvgElement("rect", {
      x, y, width: 8, height: Math.max(nodeHeight, 4), fill: color, class: "chart-node"
    }));
  };
  addNode(28, revenueY, revenuHauteur, "#728aa5");
  addNode(189, budgetY, revenuHauteur, "#6c9a91");
  addLabel(nodes, "Revenus", 42, hauteur / 2 - 4, "start", "chart-label");
  addLabel(nodes, formatMontant(totalRevenus), 42, hauteur / 2 + 16, "start", "chart-value");
  addLabel(nodes, "Budget", 176, hauteur / 2 - 4, "end", "chart-label");
  addLabel(nodes, formatMontant(totalRevenus), 176, hauteur / 2 + 16, "end", "chart-value");

  positionsGroupes.forEach(group => {
    addNode(390, group.y, group.hauteur, group.couleur);
    const montant = formatMontant(group.valeur);
    addValueLabel(nodes, `${group.nom} : ${montant}`, `${group.nom} : ${montant}`, 294, group.y + group.hauteur / 2, 176, group.valeur, maxLabelAmount);
  });
  positionsDetails.forEach(detail => {
    addNode(490, detail.y, detail.hauteur, detail.couleur);
    const montant = formatMontant(detail.valeur);
    addValueLabel(nodes, `${detail.nom} : ${montant}`, `${detail.nom} : ${montant}`, 592, detail.y + detail.hauteur / 2, 184, detail.valeur, maxLabelAmount);
  });

}

function updateTotalsOnly() {
  const budget = data[currentPerson];
  const totalRevenus = sumItems(budget.revenus);
  const totalInvestissements = sumItems(budget.investissements);
  const totalEpargne = sumItems(budget.epargne);
  const totalDepensesFixes = sumCategories(budget.depensesFixes);
  const totalDepensesVariables = sumItems(budget.depensesVariables);

  document.getElementById("total-revenus").textContent = `${totalRevenus.toFixed(2)} €`;
  document.getElementById("total-investissements").textContent = `${totalInvestissements.toFixed(2)} €`;
  document.getElementById("total-epargne").textContent = `${totalEpargne.toFixed(2)} €`;
  document.getElementById("total-depensesFixes").textContent = `${totalDepensesFixes.toFixed(2)} €`;
  document.getElementById("total-depensesVariables").textContent = `${totalDepensesVariables.toFixed(2)} €`;

  renderBudgetChart(budget);

  sauvegarder();
}

// --- Rendu complet pour l'affichage ---
function renderAllUI() {
  renderSimpleList("revenus");
  renderSimpleList("investissements");
  renderSimpleList("epargne");
  renderDepensesFixes();
  renderSimpleList("depensesVariables");
  updateTotalsOnly();
}

// --- Changement de personne ---
function switchPerson(person) {
  currentPerson = person;
  document.querySelectorAll(".btn-person").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.person === person);
  });
  renderAllUI();
  sauvegarder();
}

document.getElementById("btn-person-denis").addEventListener("click", () => switchPerson("Denis"));
document.getElementById("btn-person-margot").addEventListener("click", () => switchPerson("Margot"));

// --- Boutons d'ajout ---
document.getElementById("btn-add-revenu").addEventListener("click", () => {
  data[currentPerson].revenus.push(createItem());
  renderSimpleList("revenus");
  sauvegarder();
});

document.getElementById("btn-add-investissement").addEventListener("click", () => {
  data[currentPerson].investissements.push(createItem());
  renderSimpleList("investissements");
  sauvegarder();
});

document.getElementById("btn-add-epargne").addEventListener("click", () => {
  data[currentPerson].epargne.push(createItem());
  renderSimpleList("epargne");
  sauvegarder();
});

document.getElementById("btn-add-categorie-fixes").addEventListener("click", () => {
  data[currentPerson].depensesFixes.push({ id: nextId(), nom: "", items: [] });
  renderDepensesFixes();
  sauvegarder();
});

document.getElementById("btn-add-depenseVariable").addEventListener("click", () => {
  data[currentPerson].depensesVariables.push(createItem());
  renderSimpleList("depensesVariables");
  sauvegarder();
});

// Lancer l'écoute en temps réel Firebase au démarrage
ecouterFirebase();

// --- Mode Nuit ---
const themeToggleBtn = document.getElementById("theme-toggle");
const currentTheme = localStorage.getItem("budgetTheme");

if (currentTheme === "dark") {
  document.body.classList.add("dark-mode");
  if (themeToggleBtn) themeToggleBtn.textContent = "☀️ Mode Jour";
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    themeToggleBtn.textContent = isDarkMode ? "☀️ Mode Jour" : "🌙 Mode Nuit";
    localStorage.setItem("budgetTheme", isDarkMode ? "dark" : "light");
  });
}