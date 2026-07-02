# Librenard

Site personnel de [librenard.fr](https://librenard.fr) — logiciels libres, auto-hébergement et partage de connaissances.

Site statique (HTML/CSS/JS) accompagné d'un wiki alimenté par l'API BookStack. Les pages HTML sont générées à partir d'un script de build.

## Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou plus, `fetch` natif requis)

## Commandes

```bash
# Générer les pages, le prérendu du wiki, le sitemap, robots.txt et le manifest
npm run build

# Build sans le prérendu wiki (hors ligne / sans accès à l'API BookStack)
npm run build -- --no-wiki

# Vérifier les liens internes
npm run check:links

# Vérifier aussi les liens externes
npm run check:links:external

# Tests unitaires (helpers de build)
npm test

# Tests + build + vérification des liens
npm run verify
```

## Prérendu du wiki (SEO)

Le wiki interactif (`wiki.html`, routage par hash `#/book/...`) est invisible
pour les moteurs de recherche. Au build, `scripts/lib/wiki-prerender.mjs`
interroge l'API BookStack et génère une page statique par livre et par
article dans `wiki/` :

- `wiki/<livre>.html` — sommaire d'un livre
- `wiki/<livre>/<article>.html` — article complet (contenu, TOC, prev/suivant, JSON-LD)

Ces pages sont les URL canoniques du contenu : elles sont listées dans le
sitemap (avec la vraie date de mise à jour BookStack) et le SPA pointe sa
balise `canonical` vers elles. Les étagères publiées sont configurées dans
`scripts/lib/site-template.mjs` (`site.wikiShelves`) et doivent correspondre
aux attributs `data-shelf` de `wiki.html` et `projets.html`.

Le dossier `wiki/` est entièrement régénéré à chaque build : ne rien y éditer
à la main. Le token API est lu depuis la variable d'environnement
`BOOKSTACK_TOKEN`, à défaut depuis `js/wiki/api.js`.

## Licence

Sous licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.fr).
