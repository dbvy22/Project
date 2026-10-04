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

function updateTotalsOnly() {
  const budget = data[currentPerson];
  const totalRevenus = sumItems(budget.revenus);
  const totalInvestissements = sumItems(budget.investissements);
  const totalEpargne = sumItems(budget.epargne);
  const totalDepensesFixes = sumCategories(budget.depensesFixes);
  const totalDepensesVariables = sumItems(budget.depensesVariables);
  const totalDepenses = totalDepensesFixes + totalDepensesVariables;

  document.getElementById("total-revenus").textContent = `${totalRevenus.toFixed(2)} €`;
  document.getElementById("total-investissements").textContent = `${totalInvestissements.toFixed(2)} €`;
  document.getElementById("total-epargne").textContent = `${totalEpargne.toFixed(2)} €`;
  document.getElementById("total-depensesFixes").textContent = `${totalDepensesFixes.toFixed(2)} €`;
  document.getElementById("total-depensesVariables").textContent = `${totalDepensesVariables.toFixed(2)} €`;

  let pctDepenses = 0, pctEpargne = 0, pctInvestissements = 0, pctReste = 0;

  if (totalRevenus > 0) {
    pctDepenses = (totalDepenses / totalRevenus) * 100;
    pctEpargne = (totalEpargne / totalRevenus) * 100;
    pctInvestissements = (totalInvestissements / totalRevenus) * 100;
    pctReste = Math.max(0, 100 - pctDepenses - pctEpargne - pctInvestissements);
  }

  document.getElementById("bar-depenses").style.width = `${pctDepenses}%`;
  document.getElementById("bar-epargne").style.width = `${pctEpargne}%`;
  document.getElementById("bar-investissements").style.width = `${pctInvestissements}%`;
  document.getElementById("bar-reste").style.width = `${pctReste}%`;

  document.getElementById("pct-depenses").textContent = `${pctDepenses.toFixed(1)}%`;
  document.getElementById("pct-epargne").textContent = `${pctEpargne.toFixed(1)}%`;
  document.getElementById("pct-investissements").textContent = `${pctInvestissements.toFixed(1)}%`;
  document.getElementById("pct-reste").textContent = `${pctReste.toFixed(1)}%`;

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