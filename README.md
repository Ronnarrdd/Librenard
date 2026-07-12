<div align="center">

<img src="images/renard3d.webp" alt="La mascotte Librenard" width="200">

# Librenard

**Pour un internet plus libre et curieux.**

Le code source de [librenard.fr](https://librenard.fr) : petits guides, projets auto-hébergés
et trucs que je bricole. Sérieux dans le fond, pas dans la forme.

[![trans rights](https://camo.githubusercontent.com/1c94c7e005f5f4cdbbc49e5dc344de97068b689887b00102cbeb49726b5f04b6/68747470733a2f2f70726964652d6261646765732e706f6e792e776f726b6572732e6465762f7374617469632f76313f6c6162656c3d7472616e732532307269676874732673747269706557696474683d3626737472697065436f6c6f72733d3542434546412c4635413942382c4646464646462c4635413942382c354243454641)](https://pride-badges.pony.workers.dev/static/v1?label=trans%20rights&stripeWidth=6&stripeColors=5BCEFA,F5A9B8,FFFFFF,F5A9B8,5BCEFA)
[![Licence CC BY-NC 4.0](https://img.shields.io/badge/Licence-CC%20BY--NC%204.0-orange)](https://creativecommons.org/licenses/by-nc/4.0/deed.fr)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Sans framework](https://img.shields.io/badge/stack-vanilla%20HTML%2FCSS%2FJS-blueviolet)](https://librenard.fr/site/a-propos.html)
[![Hébergé avec YunoHost](https://img.shields.io/badge/Hébergé%20avec-YunoHost-000000?logo=yunohost&logoColor=white)](https://yunohost.org/)

[Le site](https://librenard.fr) · [Le wiki](https://librenard.fr/site/wiki.html) · [Les outils](https://librenard.fr/site/outils.html) · [Contact](https://librenard.fr/site/contact.html) · [Code source](https://git.librenard.fr/Renard/Librenard)

</div>

---

## Qui est derrière le renard ?

Nolann, technicien informatique. Je documente ce que j'apprends
sur le terrain : dépannage, supervision, réseau, Linux, auto-hébergement. Le site est
hébergé chez moi grâce à [YunoHost](https://yunohost.org/), sans cookie, sans traqueur, sans pub.

## Sur librenard.fr

| Section | Ce qu'on y trouve |
| --- | --- |
| [Projets](https://librenard.fr/site/projets.html) | Documentation collaborative (BookStack), auto-hébergement YunoHost, et le fil des derniers articles du wiki |
| [Wiki](https://librenard.fr/site/wiki.html) | Tutoriels et notes techniques, prérendus en pages statiques pour le SEO et le partage |
| [Outils](https://librenard.fr/site/outils.html) | Petits utilitaires et services auto-hébergés que je recommande ou que j'utilise |
| [Contact](https://librenard.fr/site/contact.html) | Me joindre, parcours et centres d'intérêt |

### Les livres du wiki

Le wiki couvre surtout :

- **Linux** — bases, commandes, Docker, partitionnement, GRUB…
- **Windows** — système de fichiers, DiskPart, partition EFI, dépannage GLPI
- **Réseau** — adresses IP, DNS, DHCP, reverse proxy, fibre, DMZ…
- **Supervision** — Centreon, GLPI, Uptime Kuma, Beszel, Zabbix
- **Matériel & stockage** — BIOS/UEFI, RAID, GPT/MBR
- **Bidouilles** — scripts maison, intégrations un peu farfelues

Chaque livre a sa page statique (`wiki/<livre>.html`) et chaque article sa propre URL
(`wiki/<livre>/<article>.html`), indexables et partageables sur les réseaux sociaux.

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

Au build, `scripts/lib/wiki-prerender.mjs` interroge l'API BookStack et fabrique une
vraie page statique pour chaque contenu :

- `wiki/<livre>.html` : le sommaire d'un livre
- `wiki/<livre>/<article>.html` : l'article complet, avec table des matières, navigation précédent/suivant et JSON-LD

Ces pages sont les URL canoniques et **partageables** du contenu : chacune porte le titre,
la description et la couverture du livre en balises OpenGraph/Twitter. Elles sont listées dans le
sitemap avec la vraie date de mise à jour BookStack.

La navigation **depuis le site** (flux d'accueil, cartes de livres, liens `#/book/...` sur
`wiki.html`) passe par le mini-SPA : le contenu est relu en direct depuis l'API BookStack à
chaque visite, sans attendre un rebuild. Pour une preview correcte sur un réseau social,
partagez l'URL statique (`wiki/bases-de-linux.html`, etc.), pas la route hash.

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
├── js/                             Script global + JS du wiki (js/wiki/)
├── scripts/                        Build, vérification des liens, et leurs tests
│   └── lib/                        Prérendu wiki, images, Pagefind, templates
├── wiki/                           Pages wiki statiques (générées, ne pas toucher)
├── vendor/, pagefind/              Assets self-hostés et index de recherche (générés)
└── .forgejo/                       La patrouille (CI)
```

## Philosophie du terrier

- **Zéro tracking** — pas de cookie, pas d'analytics, pas de CDN tiers au runtime
- **Vanilla** — HTML, CSS et JavaScript ; pas de React, pas de bundler en prod
- **Self-host** — polices, highlight.js, OpenDyslexic et images wiki rapatriées localement
- **Accessible** — thème clair/sombre, police OpenDyslexic en option, recherche Pagefind offline
- **Libre** — contenu sous [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.fr) : partagez, adaptez, citez la source, pas d'usage commercial

## Licence

Le contenu est sous licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.fr).
Le code du site suit la même logique : servez-vous, citez la source, pas d'usage commercial.

Les illustrations du renard ont été créées avec l'aide de ChatGPT.
Les stickers de chats du wiki viennent de [Flaticon](https://www.flaticon.com/free-stickers/cute) (Stickers).

<div align="center">
<sub>Fait avec du HTML à la main et une quantité déraisonnable de renards.</sub>
</div>
