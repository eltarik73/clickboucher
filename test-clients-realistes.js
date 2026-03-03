import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// 5 clients simultanés pendant 3 minutes
export const options = {
  vus: 5,
  duration: '3m',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = 'https://clickboucher-production.up.railway.app';

// Vrai shop ID de la DB
const SHOP_ID = 'cmlrgihb40000330obmaf09bq';

// Noms de clients simulés
const CLIENTS = ['Karim', 'Sophie', 'Ahmed', 'Fatima', 'Youssef'];

export default function () {
  const clientName = CLIENTS[__VU - 1] || `Client${__VU}`;
  
  group(`${clientName} - Parcours complet`, function () {
    
    // 1. Arrive sur la page découvrir
    group('1. Découvrir les boucheries', function () {
      let res = http.get(`${BASE_URL}/decouvrir`);
      check(res, { 'page découvrir OK': (r) => r.status === 200 });
      console.log(`${clientName}: Arrive sur la page d'accueil`);
      sleep(randomIntBetween(2, 4));
    });

    // 2. Regarde la liste des shops
    group('2. Liste des boucheries', function () {
      let res = http.get(`${BASE_URL}/api/shops`);
      check(res, { 'API shops OK': (r) => r.status === 200 });
      console.log(`${clientName}: Regarde les boucheries disponibles`);
      sleep(randomIntBetween(1, 3));
    });

    // 3. Clique sur une boucherie
    group('3. Détail boucherie', function () {
      let res = http.get(`${BASE_URL}/api/shops/${SHOP_ID}`);
      check(res, { 'détail shop OK': (r) => r.status === 200 });
      console.log(`${clientName}: Entre dans Boucherie Tarik`);
      sleep(randomIntBetween(2, 5));
    });

    // 4. Ajoute un produit au panier - 200g
    group('4. Ajoute 200g au panier', function () {
      let res = http.post(
        `${BASE_URL}/api/cart/add`,
        JSON.stringify({
          shopId: SHOP_ID,
          productId: 'viande-hachee-5',
          qty: 0.2, // 200 grammes
          unit: 'kg',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(res, { 'ajout 200g OK': (r) => r.status === 200 || r.status === 201 });
      console.log(`${clientName}: Ajoute 200g de viande hachée`);
      sleep(randomIntBetween(1, 2));
    });

    // 5. Change d'avis - veut 500g maintenant
    group('5. Change pour 500g', function () {
      let res = http.post(
        `${BASE_URL}/api/cart/add`,
        JSON.stringify({
          shopId: SHOP_ID,
          productId: 'viande-hachee-5',
          qty: 0.5, // 500 grammes
          unit: 'kg',
          replace: true, // remplace la quantité
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(res, { 'modification 500g OK': (r) => r.status === 200 || r.status === 201 });
      console.log(`${clientName}: Change d'avis, veut 500g maintenant`);
      sleep(randomIntBetween(2, 3));
    });

    // 6. Finalement revient à 100g
    group('6. Revient à 100g', function () {
      let res = http.post(
        `${BASE_URL}/api/cart/add`,
        JSON.stringify({
          shopId: SHOP_ID,
          productId: 'viande-hachee-5',
          qty: 0.1, // 100 grammes
          unit: 'kg',
          replace: true,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(res, { 'modification 100g OK': (r) => r.status === 200 || r.status === 201 });
      console.log(`${clientName}: Non finalement 100g seulement`);
      sleep(randomIntBetween(1, 2));
    });

    // 7. Ajoute un autre produit - merguez
    group('7. Ajoute des merguez', function () {
      let res = http.post(
        `${BASE_URL}/api/cart/add`,
        JSON.stringify({
          shopId: SHOP_ID,
          productId: 'merguez-lot',
          qty: 0.3, // 300 grammes
          unit: 'kg',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(res, { 'ajout merguez OK': (r) => r.status === 200 || r.status === 201 });
      console.log(`${clientName}: Ajoute 300g de merguez`);
      sleep(randomIntBetween(1, 2));
    });

    // 8. Va au panier
    group('8. Consulte le panier', function () {
      let res = http.get(`${BASE_URL}/panier`);
      check(res, { 'page panier OK': (r) => r.status === 200 });
      console.log(`${clientName}: Vérifie son panier`);
      sleep(randomIntBetween(2, 4));
    });

    // 9. Hésite, retourne voir les produits
    group('9. Retourne voir les produits', function () {
      let res = http.get(`${BASE_URL}/api/shops/${SHOP_ID}`);
      check(res, { 'retour shop OK': (r) => r.status === 200 });
      console.log(`${clientName}: Retourne voir s'il n'a rien oublié`);
      sleep(randomIntBetween(3, 5));
    });

    // 10. Ajoute un dernier produit
    group('10. Ajoute brochettes', function () {
      let res = http.post(
        `${BASE_URL}/api/cart/add`,
        JSON.stringify({
          shopId: SHOP_ID,
          productId: 'brochettes-poulet',
          qty: 0.4, // 400 grammes
          unit: 'kg',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(res, { 'ajout brochettes OK': (r) => r.status === 200 || r.status === 201 });
      console.log(`${clientName}: Ajoute 400g de brochettes`);
      sleep(randomIntBetween(1, 2));
    });

    // 11. Change quantité brochettes
    group('11. Modifie brochettes à 600g', function () {
      let res = http.post(
        `${BASE_URL}/api/cart/add`,
        JSON.stringify({
          shopId: SHOP_ID,
          productId: 'brochettes-poulet',
          qty: 0.6, // 600 grammes
          unit: 'kg',
          replace: true,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(res, { 'modification brochettes OK': (r) => r.status === 200 || r.status === 201 });
      console.log(`${clientName}: Augmente les brochettes à 600g`);
      sleep(randomIntBetween(1, 2));
    });

    // 12. Retour panier final
    group('12. Panier final', function () {
      let res = http.get(`${BASE_URL}/panier`);
      check(res, { 'panier final OK': (r) => r.status === 200 });
      console.log(`${clientName}: Valide son panier final`);
      sleep(randomIntBetween(2, 3));
    });

    console.log(`${clientName}: Parcours terminé ✓`);
    
    // Pause avant de recommencer
    sleep(randomIntBetween(5, 10));
  });
}
