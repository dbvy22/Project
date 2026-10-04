let idCounter = 0;
function nextId() {
  idCounter++;
  return idCounter;
}

const data = {
  revenus: [],
  investissements: [],
  epargne: [],
  depenses: [] // chaque élément : { id, nom, items: [{id, nom, valeur}] }
};

function createItem(nom = "", valeur = 0) {
  return { id: nextId(), nom, valeur };
}

// --- Sauvegarde / chargement dans le navigateur ---
function sauvegarder() {
  try {
    localStorage.setItem("budgetData", JSON.stringify(data));
  } catch (e) {
    console.error("Erreur de sauvegarde :", e);
  }
}

function charger() {
  try {
    const sauvegarde = localStorage.getItem("budgetData");
    if (sauvegarde) {
      const parsed = JSON.parse(sauvegarde);
      data.revenus = parsed.revenus || [];
      data.investissements = parsed.investissements || [];
      data.epargne = parsed.epargne || [];
      data.depenses = parsed.depenses || [];

      // recalcule idCounter pour éviter les doublons d'id
      const tousLesIds = [
        ...data.revenus.map(i => i.id),
        ...data.investissements.map(i => i.id),
        ...data.epargne.map(i => i.id),
        ...data.depenses.flatMap(c => [c.id, ...c.items.map(i => i.id)])
      ];
      idCounter = tousLesIds.length ? Math.max(...tousLesIds) : 0;
      return true;
    }
  } catch (e) {
    console.error("Erreur de chargement :", e);
  }
  return false;
}

// --- Rendu d'une liste simple (revenus / investissements / épargne) ---
function renderSimpleList(type) {
  const container = document.getElementById(`${type}-list`);
  container.innerHTML = "";

  data[type].forEach(item => {
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
      data[type] = data[type].filter(i => i.id !== item.id);
      renderSimpleList(type);
      updateTotals();
    });

    row.appendChild(nomInput);
    row.appendChild(valeurInput);
    row.appendChild(deleteBtn);
    container.appendChild(row);
  });
}

// --- Rendu des dépenses (catégories + items dans chaque catégorie) ---
function renderDepenses() {
  const container = document.getElementById("depenses-categories");
  container.innerHTML = "";

  data.depenses.forEach(categorie => {
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
      data.depenses = data.depenses.filter(c => c.id !== categorie.id);
      renderDepenses();
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
        renderDepenses();
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
      renderDepenses();
    });
    block.appendChild(addItemBtn);

    container.appendChild(block);
  });
}

// --- Calcul des totaux et des pourcentages ---
function sumItems(list) {
  return list.reduce((acc, item) => acc + (item.valeur || 0), 0);
}

function updateTotals() {
  const totalRevenus = sumItems(data.revenus);
  const totalInvestissements = sumItems(data.investissements);
  const totalEpargne = sumItems(data.epargne);
  const totalDepenses = data.depenses.reduce((acc, cat) => acc + sumItems(cat.items), 0);

  document.getElementById("total-revenus").textContent = `${totalRevenus.toFixed(2)} €`;
  document.getElementById("total-investissements").textContent = `${totalInvestissements.toFixed(2)} €`;
  document.getElementById("total-epargne").textContent = `${totalEpargne.toFixed(2)} €`;
  document.getElementById("total-depenses").textContent = `${totalDepenses.toFixed(2)} €`;

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

// --- Boutons d'ajout ---
document.getElementById("btn-add-revenu").addEventListener("click", () => {
  data.revenus.push(createItem());
  renderSimpleList("revenus");
});

document.getElementById("btn-add-investissement").addEventListener("click", () => {
  data.investissements.push(createItem());
  renderSimpleList("investissements");
});

document.getElementById("btn-add-epargne").addEventListener("click", () => {
  data.epargne.push(createItem());
  renderSimpleList("epargne");
});

document.getElementById("btn-add-categorie").addEventListener("click", () => {
  data.depenses.push({ id: nextId(), nom: "", items: [] });
  renderDepenses();
});

// --- Initialisation : on charge les données sauvegardées, sinon valeurs par défaut ---
const dejaSauvegarde = charger();

if (!dejaSauvegarde) {
  data.revenus.push(createItem("Salaire"));
  data.depenses.push({ id: nextId(), nom: "Logement", items: [createItem("Loyer")] });
}

renderSimpleList("revenus");
renderSimpleList("investissements");
renderSimpleList("epargne");
renderDepenses();
updateTotals();