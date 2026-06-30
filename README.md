# Librenard

Site personnel de [librenard.fr](https://librenard.fr) — logiciels libres, auto-hébergement et partage de connaissances.

Site statique (HTML/CSS/JS) accompagné d'un wiki alimenté par l'API BookStack. Les pages HTML sont générées à partir d'un script de build.

## Prérequis

- [Node.js](https://nodejs.org/) (version récente)

## Commandes

```bash
# Générer les pages, le sitemap, robots.txt et le manifest
npm run build

# Vérifier les liens internes
npm run check:links

# Vérifier aussi les liens externes
npm run check:links:external

# Build + vérification des liens
npm run verify
```

## Licence

Sous licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.fr).
