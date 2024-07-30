# compta-b2t-stripe

## Description

Cette application Node.js récupère les paiements depuis Stripe, les transforme en écritures comptables et les exporte dans un fichier CSV. Elle est conçue pour aider les personnes à automatiser la génération des écritures comptables à partir des transactions Stripe.

## Fonctionnalités

- Récupération de tous les paiements depuis Stripe.
- Transformation des paiements en écritures comptables incluant les frais et les montants nets.
- Exportation des écritures comptables dans un fichier CSV.
- Tri des écritures comptables dans l'ordre chronologique.
- Extraction des numéros de facture associés aux paiements.
- Classification des types de transactions en fonction des descriptions d'articles (ventes de marchandises, prestations de services, cotisations, dons manuels).

## Prérequis

- Node.js installé sur votre machine.
- Un compte Stripe avec des clés API ayant les permissions nécessaires.

## Installation

1. Clonez le dépôt :

    ```bash
    git clone https://github.com/brutdethe/compta-b2t-stripe.git
    cd compta-b2t-stripe
    ```

2. Installez les dépendances :

    ```bash
    npm install
    ```

3. Créez un fichier `.env.json` à la racine du projet et ajoutez vos clés API Stripe :

    ```json
    {
        "STRIPE_PUBLIC": "pk_test_votre_cle_publique",
        "STRIPE_PRIVATE": "sk_test_votre_cle_secrete"
    }
    ```

## Utilisation

Pour exécuter le script et générer le fichier CSV dans le dossier generated_reports, utilisez la commande suivante :

```bash
node src/main.js 2023-01-01 2023-12-31
```

Cela générera un fichier CSV nommé `ecritures_comptables_2023-01-01_to_2023-12-31.csv` dans le répertoire generated_reports du projet.

## Exemple de sortie CSV

| qui paye ? | date       | qui reçoit | poste                | montant   | nature | pointage | note            | facture correspondante |
|------------|------------|------------|----------------------|-----------|--------|----------|-----------------|------------------------|
| Membre     | 18/05/2021 | Stripe     | ventes de marchandises | 625,74 €  | cb     |          | Vente stripe    | 20210518_2021-0001     |
| Stripe     | 18/05/2021 | Stripe     | commissions          | 9,01 €    | prv    |          | commission stripe | 20210518_2021-0001    |
| Stripe     | 18/05/2021 | B2T        | caisse stripe        | 616,73 €  | cb     | x        | transfert stripe | 20210518_2021-0001    |

## Auteur

- **pntbr** - [Votre GitHub](https://github.com/pntbr)

## License

Ce projet est sous licence CC0 1.0 Universal - voir le fichier [LICENCE](LICENCSE) pour plus de détails.

Cela générera un fichier CSV nommé `ecritures_comptables_2023-01-01_to_2023-12-31.csv` dans le répertoire generated_reports du projet.

## Exemple de sortie CSV

| qui paye ? | date       | qui reçoit | poste                | montant   | nature | pointage | note            | facture correspondante |
|------------|------------|------------|----------------------|-----------|--------|----------|-----------------|------------------------|
| Membre     | 2021-05-18 | Stripe     | ventes de marchandises | 625,74 €  | cb     |          | Vente stripe    | 2021-0001              |
| Stripe     | 2021-05-18 | Stripe     | commissions          | 9,01 €    | prv    |          | commission stripe | 2021-0001              |
| Stripe     | 2021-05-18 | B2T        | caisse stripe        | 616,73 €  | cb     | x        | transfert stripe | 2021-0001              |

## Auteur

- **pntbr** - [Votre GitHub](https://github.com/pntbr)

## License

Ce projet est sous licence CC0 1.0 Universal - voir le fichier [LICENCE](LICENCE) pour plus de détails.

