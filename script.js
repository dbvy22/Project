let compteur = 0;

const affichage = document.getElementById("valeur");
const boutonPlus = document.getElementById("plus");
const boutonReset = document.getElementById("reset");

function mettreAJour() {
  affichage.textContent = compteur;
}

boutonPlus.addEventListener("click", () => {
  compteur++;
  mettreAJour();
});

boutonReset.addEventListener("click", () => {
  compteur = 0;
  mettreAJour();
});