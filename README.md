# Global Rare eBird

A map displaying rare bird sightings worldwide using eBird data.

[![image](https://user-images.githubusercontent.com/7571260/190668681-2bd06339-2568-4da2-9931-bccc5e95c360.png)](https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/)

## About

Global Rare eBird retrieves and visualizes recent notable bird observations (i.e., rare species) reported via the eBird public API.

- 📍 **Nearby Mode**: Sightings within 50 km of your location (requires permission).
- 🌎 **Region Mode**: Sightings in a country or US state/CA province.

You can share the url link at any point or bookmark it to save your region's specific page! Press `⌘ Cmd + D` (Mac) or `Ctrl + D` (Windows/Linux).

Spotted a bug or have a suggestion? Open a [GitHub Issue](https://github.com/Zoziologie/global-rare-ebird/issues).

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `MAPBOX_ACCESS_TOKEN` and `EBIRD_API_KEY`.
3. Start the app with `npm run dev`.

The GitHub Pages workflow injects the same `MAPBOX_ACCESS_TOKEN` and `EBIRD_API_KEY` names from repository secrets during the production build.

## Taxonomy data

The repository separates raw source data from generated app data:

- Raw source files live in `raw-data/`
- Generated app data lives in `data/`

The taxonomy data is generated in five separate files:

- `npm run generate:taxonomy`
- `npm run generate:region-catalog`
- `npm run generate:aba-taxonomy`
- `npm run generate:french-taxonomy`
- `npm run generate:german-taxonomy`
- `npm run generate:swiss-taxonomy`
- `npm run generate:taxonomies`

The main taxonomy lookup is written to `data/taxo.json` as a compact code-keyed map with taxonomic order and category only.

The region catalog is written to `data/region-catalog.json` as a compact searchable list of countries, US states, and Canadian provinces used by the region picker.

The ABA checklist source lives in `raw-data/ABA_Checklist-8.19.csv`. The generated lookup is written to `data/aba-taxonomy.json` as a compact species-code status map and is only loaded when US or Canada regions are selected.

The French rarity committee table is scraped from `https://www.chn-france.org/en/homologation/species/` and written to `data/french-rarity-taxonomy.json` as a compact species-code presence map. It is only loaded when France is selected.

The German checklist source lives in `raw-data/meldeliste_d_ab2023_sys.csv`. The generated lookup is written to `data/german-taxonomy.json` as a compact species-code status map. It is only loaded when Germany is selected.

The Swiss checklist source lives in `raw-data/CH-Artliste_6.csv`. The generated lookup is written to `data/swiss-taxonomy.json` as a compact species-code status map. It is only loaded when Switzerland is selected.

Run `npm run generate:taxonomies` after updating the source data or when you want to refresh all five generated files.
