<div align="center">

<img src="images/renard3d.webp" alt="La mascotte Librenard" width="200">

# Librenard

**Pour un internet plus libre et curieux.**

Le code source de [librenard.fr](https://librenard.fr) : petits guides, projets auto-hébergés
et trucs que je bricole. Sérieux dans le fond, pas dans la forme.

[Le site](https://librenard.fr) · [Le wiki](https://librenard.fr/site/wiki.html) · [Les outils](https://librenard.fr/site/outils.html)

</div>

---

## C'est quoi, ce terrier ?

Un site statique, du HTML, du CSS, du JavaScript. Pas de framework, pas de CDN au runtime,
pas de cookie, pas de tracking. Juste un renard qui documente ce qu'il apprend :
auto-hébergement avec YunoHost, logiciels libres, et un wiki [BookStack](https://www.bookstackapp.com/)
qui grandit petit à petit.

Le seul outil un peu malin du terrier, c'est le script de build : il interroge l'API BookStack,
prérend le wiki en pages statiques, rapatrie les images, indexe la recherche et génère le sitemap.
Une fois construit, le site vit tout seul.

## Faire tourner la machine

Il vous faut [Node.js](https://nodejs.org/) 18 ou plus (le `fetch` natif est requis).

```bash
npm install        # dépendances + polices et libs self-hostées (vendor/)
npm run build      # construit tout : pages, wiki prérendu, sitemap, recherche
```

Pas d'accès à l'API BookStack sous la patte ? Le build sait travailler hors ligne :

```bash
npm run build -- --no-wiki
```

### Toutes les commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run build` | Génère les pages, le prérendu du wiki, le sitemap, `robots.txt` et le manifest |
| `npm run build -- --no-wiki` | Build sans le prérendu wiki (hors ligne, sans API BookStack) |
| `npm test` | Tests unitaires des helpers de build |
| `npm run check:links` | Vérifie les liens internes |
| `npm run check:links:external` | Vérifie aussi les liens externes |
| `npm run verify` | Tests + build + vérification des liens, le tout en un |

## Le prérendu du wiki (ou : comment plaire aux moteurs de recherche)

Le wiki interactif (`wiki.html`, routage par hash `#/book/...`) est invisible pour les
robots d'indexation. Alors au build, `scripts/lib/wiki-prerender.mjs` interroge l'API
BookStack et fabrique une vraie page statique pour chaque contenu :

- `wiki/<livre>.html` : le sommaire d'un livre
- `wiki/<livre>/<article>.html` : l'article complet, avec table des matières, navigation précédent/suivant et JSON-LD

Ces pages sont les URL canoniques du contenu. Elles sont listées dans le sitemap avec la
vraie date de mise à jour BookStack, et le wiki interactif pointe sa balise `canonical` vers elles.

Deux règles du terrier :

1. **Ne rien éditer à la main dans `wiki/`.** Le dossier est rasé et régénéré à chaque build.
2. **Le token API** se lit depuis la variable d'environnement `BOOKSTACK_TOKEN`
   (voir `.env.example`), à défaut depuis `js/wiki/api.js`.

Les étagères publiées se configurent dans `scripts/lib/site-template.mjs` (`site.wikiShelves`)
et doivent correspondre aux attributs `data-shelf` de `wiki.html` et `projets.html`.

Le build génère aussi :

- **`pagefind/`** : index de recherche offline ([Pagefind](https://pagefind.app/)) sur les pages wiki statiques
- **`images/wiki/`** : miroir local des images BookStack, converties en WebP avec lazy loading
- **`vendor/`** et **`css/fonts.css`** : polices, highlight.js et OpenDyslexic self-hostés, zéro CDN au runtime

## La patrouille (CI)

Chaque push déclenche le pipeline Forgejo Actions (`.forgejo/workflows/ci.yml`) :

- **Reniflage** : les tests unitaires flairent les régressions
- **Vigilance** : `npm audit` surveille les dépendances
- **Tissage et patrouille** : build complet du site, puis vérification de la recherche
  Pagefind, du sitemap et des liens internes

Sur `main`, le build est complet (avec prérendu wiki). Sur les branches et PR,
il tourne en `--no-wiki` pour ne pas marteler l'API.

## Plan du terrier

```
├── index.html, projets.html, ...   Pages du site (générées, contenu éditable dedans)
├── css/                            Styles, découpés par usage
├── js/                             Script global + SPA wiki (js/wiki/)
├── scripts/                        Build, vérification des liens, et leurs tests
│   └── lib/                        Prérendu wiki, images, Pagefind, templates
├── wiki/                           Pages wiki statiques (générées, ne pas toucher)
├── vendor/, pagefind/              Assets self-hostés et index de recherche (générés)
└── .forgejo/                       La patrouille (CI)
```

## Licence

Le contenu est sous licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.fr).
Servez-vous, citez la source, pas d'usage commercial.

<div align="center">
<sub>Fait avec du HTML à la main et une quantité déraisonnable de renards.</sub>
</div>
