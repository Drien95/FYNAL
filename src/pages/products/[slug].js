import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getCategorieIdData } from "../../fonctions/SidebarData";
import { prisma } from "../../../db";
import { useState } from "react";
import { useRouter } from "next/router";
import { useCookies } from "react-cookie";
import useSWR from "swr";
import { PrixProduitProduit } from "../../components/PrixProduitProduit";

export async function getStaticPaths() {
  const products = await prisma.produit.findMany({
    where: {},
    select: {
      idProduit: true,
    },
  });

  const paths = products.map((produit) => ({
    params: { slug: produit.idProduit.toString() },
  }));
  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps(context) {
  const id = context.params.slug;
  const categoriesSideMenu = await getCategorieIdData();
  const prodData = await prisma.produit.findMany({
    where: {
      idProduit: parseInt(id),
    },
  });

  return {
    props: {
      products: prodData,
      categoriesSideMenu,
    },
  };
}

// Fonction pour reload la page
function reload() {
  const router = useRouter();
  router.reload();
}

//fonction qui ajoute un produit au panier
async function newCartData(product, commande, idUtilisateur) {
  //vérification si la commande existe déja
  const IDCOMMANDE = commande.idCommande === 0 ? 0 : commande.idCommande;
  //si elle existe alors on cherche si le produit ajouter existe déja
  const existItem =
    IDCOMMANDE === 0
      ? false
      : commande.PanierProduit.find((x) => x.idProduit === product.idProduit);
  const exist = existItem ? true : false;
  // update de la quantité en fonction de l'existence du produit
  const quantity = existItem ? existItem.quantite + 1 : 1;
  // si quantité plus importante que le stock alors reload la page
  if (product.stock < quantity) {
    alert("Produit plus en stock");
    reload();
  }
  //envois de notre requete à l'api panierAddButton dans laquelle se passeront les test et les mise a jour de la commande
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
  // si la requete fetch c'est mal passé
  if (!response.ok) {
    console.log(response);
    throw new Error(response.statusText);
  }

  // retour de la commande avec le panier à jour
  const updatedCart = await response.json();
  return updatedCart;
}

export default function Products({ products }) {
  const router = useRouter();
  // Récupération des cookies user
  const [cookies] = useCookies(["user"]);
  //initialisation du useState pour l'état des produits avec initiValue : products[0]
  const [product, setProduct] = useState(products[0]);
  //initialisation du useState pour l'état du panier avec initiValue 0

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
  console.log(cart);

  async function handleNewCartData(product, commande, idUtilisateur) {
    try {
      // vérification que l'user est bien connecté sinon on le redirige vers la page de connexion
      if (!cookies["user"]) {
        alert("Veuillez vous connecter pour ajouter un produit");
        router.push("/signin");
      }
      const updatedProduct = await newCartData(
        product,
        commande,
        idUtilisateur
      );
      console.log(updatedProduct);
      //   setCartItems((prevCart) => {
      //     const updatedProducts = prevCart.PanierProduit.map((p) =>
      //       p.idProduit === updatedProduct.PanierProduit.idProduit ? updatedProduct.PanierProduit : p
      //     );
      //     console.log(updatedProducts);
      //     return { ...prevCart, PanierProduit: updatedProducts };
      setCartItems(updatedProduct);
      console.log(updatedProduct);
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <div>
      <section className="text-gray-600 body-font overflow-hidden">
        <div className="container px-5 py-24 mx-auto">
          <div className="lg:w-4/5 mx-auto flex flex-wrap">
            <img
              src={product.image}
              alt={product.nom}
              className="lg:w-1/2 w-full lg:h-auto h-64 object-cover object-center rounded"
            ></img>
            <div className="lg:w-1/2 w-full lg:pl-10 lg:py-6 mt-6 lg:mt-0">
              <h2 className="text-sm title-font text-gray-500 tracking-widest">
                Fynal
              </h2>
              <h1 className="text-gray-900 text-3xl title-font font-medium mb-1">
                {product.nom}
              </h1>
              <div className="flex mb-4"></div>
              <p className="leading-relaxed">{product.description}</p>
              <div className="flex mt-6 items-center pb-5 border-b-2 border-gray-100 mb-5">
                <p>
                  Délai de livraison estimé : {product.delaisLivraison} jours
                </p>
              </div>
              <div className="flex">
                <PrixProduitProduit prix={product.prix} reduction={product.reduction} stock={product.stock}></PrixProduitProduit>
                <button
                  className="flex ml-auto text-white  bg-stone-800 border-0 py-2 px-6 focus:outline-none hover:bg-stone-950 rounded-lg transition ease-in duration-200"
                  onClick={async (e) => {
                    try {
                      await handleNewCartData(
                        product,
                        cart,
                        cookies?.user?.idUtilisateur
                      );
                      e.target.reset();
                    } catch (err) {
                      console.log(err);
                    }
                  }}
                >
                  Ajouter au panier
                </button>
              </div>
              <div className="flex">
                <Link href={"/categorie/" + product.idCategorie} className="ml-auto normal-case text-lg mt-4 hover:underline hover:text-black">            
                  Retour aux catégories
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
