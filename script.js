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

const data = {
  Denis: nouveauBudgetVide(),
  Margot: nouveauBudgetVide()
};

let currentPerson = "Denis";

function createItem(nom = "", valeur = 0) {
  return { id: nextId(), nom, valeur };
}

// --- Sauvegarde / chargement dans le navigateur ---
function sauvegarder() {
  try {
    localStorage.setItem("budgetData", JSON.stringify(data));
    localStorage.setItem("budgetCurrentPerson", currentPerson);
  } catch (e) {
    console.error("Erreur de sauvegarde :", e);
  }
}

function charger() {
  try {
    const sauvegarde = localStorage.getItem("budgetData");
    if (sauvegarde) {
      const parsed = JSON.parse(sauvegarde);
      data.Denis = parsed.Denis || nouveauBudgetVide();
      data.Margot = parsed.Margot || nouveauBudgetVide();

      const personSauvegardee = localStorage.getItem("budgetCurrentPerson");
      if (personSauvegardee === "Denis" || personSauvegardee === "Margot") {
        currentPerson = personSauvegardee;
      }

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
      return true;
    }
  } catch (e) {
    console.error("Erreur de chargement :", e);
  }
  return false;
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
      sauvegarder();
    });

    const valeurInput = document.createElement("input");
    valeurInput.type = "number";
    valeurInput.placeholder = "0";
    valeurInput.value = item.valeur || "";
    valeurInput.addEventListener("input", () => {
      item.valeur = parseFloat(valeurInput.value) || 0;
      updateTotals();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      data[currentPerson][type] = data[currentPerson][type].filter(i => i.id !== item.id);
      renderSimpleList(type);
      updateTotals();
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
      updateTotals();
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
        updateTotals();
      });

      const itemDeleteBtn = document.createElement("button");
      itemDeleteBtn.className = "btn-delete";
      itemDeleteBtn.textContent = "✕";
      itemDeleteBtn.addEventListener("click", () => {
        categorie.items = categorie.items.filter(i => i.id !== item.id);
        renderDepensesFixes();
        updateTotals();
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

function updateTotals() {
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

// --- Rendu complet pour la personne active ---
function renderAll() {
  renderSimpleList("revenus");
  renderSimpleList("investissements");
  renderSimpleList("epargne");
  renderDepensesFixes();
  renderSimpleList("depensesVariables");