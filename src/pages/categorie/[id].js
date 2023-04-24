// Ce fichier est une route dynamique. Grâce à cela, on peut automatiquement générer des pages en fonctions des catégories présentes dans la base de données.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getAllCategoriesID, getCategorieProductsData } from '../../fonctions/categorie';
import { getCategorieIdData } from '../../fonctions/SidebarData';
import { updateProducts } from '../../fonctions/filter';
import { ProductCard } from '../../components/ProductCard';
import { useCookies } from "react-cookie";
import useSWR from "swr";

import {
    DEFAULT,
    FILTRE_PRIX_CROISSANT_STRING,
    FILTRE_PRIX_DECROISSANT_STRING,
    FILTRE_ALPHABETIQUE_CROISSANT_STRING,
    FILTRE_ALPHABETIQUE_DECROISSANT_STRING,
    FILTRE_STOCK,
    FILTRE_REDUCTION,
    FILTRE_DELAIS_1_5,
    FILTRE_DELAIS_6_10,
    FILTRE_DELAIS_11_20,
    FILTRE_DELAIS_20_SUP
} from '../../const/filtre';

// Cette fonction permet de générer tous les chemins possibles en fonction des catégories présentes dans la BDD
export async function getStaticPaths() {
    const paths = await getAllCategoriesID();
    
    return {
        paths,
        fallback: false,
    }
}

// Cette fonction permet de récupérer les produits liés à la catégorie choisie 
// On récupère aussi les informations sur les catégories pour le menu sur le côté
export async function getStaticProps({ params }) {
    const catData = await getCategorieProductsData(params.id);
    const categoriesSideMenu = await getCategorieIdData();
    
    return {
        props: {
            catData: catData,
            categoriesSideMenu: categoriesSideMenu,
        },
    };
}

// Tableau contenant tous les types de tri possible
const sorts = [
    FILTRE_PRIX_CROISSANT_STRING,
    FILTRE_PRIX_DECROISSANT_STRING,
    FILTRE_ALPHABETIQUE_CROISSANT_STRING,
    FILTRE_ALPHABETIQUE_DECROISSANT_STRING,
]

const delaisLivraisonArray = [
    FILTRE_DELAIS_1_5,
    FILTRE_DELAIS_6_10,
    FILTRE_DELAIS_11_20,
    FILTRE_DELAIS_20_SUP,
]

// Object permettant de savoir l'état du tri et des filtres appliqués
let actualSort = {
    sortType: false,
    delaisLivraisonType: false,
    stockCheckbox: false,
    reductionCheckbox: false,
    vendeurArray: [],
    utilisateursVendeursArray: [],
}

async function newCartData(product, commande, idUtilisateur) {
    const IDCOMMANDE = commande.idCommande === 0 ? 0 : commande.idCommande;
    const existItem =
      IDCOMMANDE === 0
        ? false
        : commande.PanierProduit.find((x) => x.idProduit === product.idProduit);
    const exist = existItem ? true : false;
    console.log(exist);
    console.log(IDCOMMANDE);
    const quantity = existItem ? existItem.quantite + 1 : 1;
    console.log(quantity);
    // console.log(quantity)
    if (product.stock < quantity) {
      alert("Produit plus en stock");
      return;
    }
    const response = await fetch("../api/panierAddButton", {
      method: "POST",
      body: JSON.stringify({
        idProduit: product.idProduit,
        idCommande: IDCOMMANDE,
        quantite: quantity,
        exist: exist,
        idUtilisateur: idUtilisateur,
      }),
    });
  
    if (!response.ok) {
      console.log(response);
      throw new Error(response.statusText);
    }
  
    const updatedCart = await response.json();
    return updatedCart;
  }

export default function Categorie({ catData }) {

    // Récupération des cookies user
    const [cookies] = useCookies(["user"]);
    const router = useRouter();
    const [cart, setCartItems] = useState(0);

    const fetcher = (url) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idUtilisateur: cookies?.user?.idUtilisateur }),
    })
      .then((res) => res.json())
      .then((data) => {
        const InitialCart = data.length !== 0
          ? data
          : [{ idCommande: 0, idUtilisateur: cookies?.user?.idUtilisateur }];
        setCartItems(InitialCart[0]);
      });

    // Envoie de la requête à chaque chargement de la page à l'aide d'SWR
    const {
        data,
        error: errorSWR,
        isLoading: isLoadingSWR,
    } = useSWR(cookies["user"] ? "../api/getCommandStaticProps" : null, fetcher, {
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    });

    // On récupère les informations venant de la BDD et on les organise
    const infosCategorie = {
        libelle: catData[0].libelle,
        description: catData[0].description,
    };
    let produits = catData.produits;
    actualSort.vendeurArray = catData.vendeurs;
    let utilisateursVendeurs = catData.utilisateursVendeurs;

    // Déclaration des hooks d'état permettant d'appliquer les filtres sur la page
    const [filter, setFilter] = useState({
        filterValue: "",
        eventFilter: "",
    });
    const [produitsTries, setProduits] = useState(produits);

    useEffect(() => {

        // A chaque changement de catégorie, on remet à 0 toutes les informations d'état et on reload la page pour bien afficher les produits de la nouvelle catégorie
        // (Le reload ne devrait pas petre nécessaire en principe mais avec la manière dont on a utilisé les hooks d'état, nous sommes obligés de le faire)
        const handleRouteChange = (url) => {
            actualSort.sortType = false;
            actualSort.delaisLivraisonType = false;
            actualSort.stockCheckbox = false;
            actualSort.reductionCheckbox = false;
            actualSort.vendeurArray = [],
            actualSort.utilisateursVendeursArray = [],
            router.reload();
        }
        router.events.on('routeChangeComplete', handleRouteChange);

        // On vérifie quelle action a été effectuée, si c'est le choix d'un nouveau tri ou l'application d'un filtre
        if(sorts.includes(filter.filterValue)) actualSort.sortType = filter.filterValue;
        else if(delaisLivraisonArray.includes(filter.filterValue)) actualSort.delaisLivraisonType = filter.filterValue;
        else if(filter.filterValue === FILTRE_STOCK) actualSort.stockCheckbox = !actualSort.stockCheckbox;
        else if(filter.filterValue === FILTRE_REDUCTION) actualSort.reductionCheckbox = !actualSort.reductionCheckbox;
        else if(actualSort.utilisateursVendeursArray.includes(filter.filterValue)) {
            actualSort.utilisateursVendeursArray.splice(actualSort.utilisateursVendeursArray.indexOf(filter.filterValue), 1);
        } else {
            actualSort.utilisateursVendeursArray.push(filter.filterValue);
        }

        // On met à jour les produits en fonctions du tri et des filtres
        let filteredProducts = updateProducts(produits, actualSort);
        setProduits([...filteredProducts]);

    }, [filter]);

    // Cette fonction permet de récupérer les informations venant de l'activation d'un tri ou d'un filtre
    function handleFilter(value, eventFilter = "") {
        setFilter({
            filterValue: value,
            eventFilter: eventFilter,
        });
    }

    async function handleNewCartData(product, commande, idUtilisateur) {
        try {
          if (!cookies["user"]) {
            alert("Veuillez vous connecter pour ajouter un produit");
            router.push("/signin");
          }
          const updatedProduct = await newCartData(
            product,
            commande,
            idUtilisateur
          );
          setCartItems(updatedProduct);
        } catch (error) {
          console.log(error);
        }
      }

    // Affichage de la page
    return (
        <div>
            <h1 className='text-center mt-8 font-semibold text-3xl italic'>{ infosCategorie.libelle }</h1>
            <h2 className='text-center mt-8 font-semibold text-xl italic'>{ infosCategorie.description }</h2>
            
            {/* Affichage des filtres */}
            <div className='flex justify-end gap-4 mr-10 mt-10'>
                <select className="select select-bordered w-full max-w-xs" defaultValue={DEFAULT} onChange={(e) => handleFilter(e.target.value)}>
                    <option disabled value={DEFAULT}>Trier par :</option>
                    <option value={FILTRE_PRIX_CROISSANT_STRING}>{FILTRE_PRIX_CROISSANT_STRING}</option>
                    <option value={FILTRE_PRIX_DECROISSANT_STRING}>{FILTRE_PRIX_DECROISSANT_STRING}</option>
                    <option value={FILTRE_ALPHABETIQUE_CROISSANT_STRING}>{FILTRE_ALPHABETIQUE_CROISSANT_STRING}</option>
                    <option value={FILTRE_ALPHABETIQUE_DECROISSANT_STRING}>{FILTRE_ALPHABETIQUE_DECROISSANT_STRING}</option>
                </select>
                <select className="select select-bordered w-full max-w-xs" defaultValue={DEFAULT} onChange={(e) => handleFilter(e.target.value)}>
                    <option disabled value={DEFAULT}>Delais de livraison :</option>
                    <option value={FILTRE_DELAIS_1_5}>{FILTRE_DELAIS_1_5}</option>
                    <option value={FILTRE_DELAIS_6_10}>{FILTRE_DELAIS_6_10}</option>
                    <option value={FILTRE_DELAIS_11_20}>{FILTRE_DELAIS_11_20}</option>
                    <option value={FILTRE_DELAIS_20_SUP}>{FILTRE_DELAIS_20_SUP}</option>
                </select>
                <div className='flex flex-col gap-1'>
                    <span><input type="checkbox" id='stockCheckbox' className="checkbox" onClick={(eventCheckbox) => handleFilter(FILTRE_STOCK, eventCheckbox)}/> {FILTRE_STOCK}</span>
                    <span><input type='checkbox' id='reductionCheckbox' className="checkbox" onClick={(eventCheckbox) => handleFilter(FILTRE_REDUCTION, eventCheckbox)}/> {FILTRE_REDUCTION}</span>
                </div>
                {utilisateursVendeurs.length > 1 && <div className='flex flex-col gap-1'>
                    <label>Vendeurs</label>
                    {utilisateursVendeurs.map((utilisateursVendeur) => {
                        return(
                            <span key={utilisateursVendeur.idUtilisateur}><input type="checkbox" id='entrepriseCheckbox' className="checkbox" onClick={(eventCheckbox) => handleFilter(entreprise.idEntreprise, eventCheckbox)}/> {utilisateursVendeur.nom} {utilisateursVendeur.prenom}</span>
                        )
                    })}
                </div>}
            </div>
            
            <div className="bg-white">
                <div className="mx-auto max-w-2xl -mt-16 px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
                    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-8">
                        {/* Affichage des produits de la catégorie */}
                        {produitsTries.map((produit) => {
                            return (

                                <ProductCard
                                    key={produit.idProduit}
                                    produit={produit}
                                    cart={cart}
                                    idUtilisateur={cookies?.user?.idUtilisateur}
                                    handleNewCartData={handleNewCartData}
                                ></ProductCard>

                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
