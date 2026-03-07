#!/usr/bin/env node

/**
 * parse-historico.js
 *
 * Parses hardcoded grocery list history (6 lists) and generates public/data.json.
 *
 * Normalization rules:
 * - Items that are clearly the same product across lists share a single catalog entry.
 * - Category comes from the first (most recent) list where the item appears.
 * - quantidadePadrao = most common quantity string across appearances.
 * - score = # of lists containing the item / 6.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Raw lists – each list is { data, categorias: { nomeCategoria: [linhas] } }
// ---------------------------------------------------------------------------

const listas = [
  {
    data: "2026-03-06",
    categorias: {
      legumes: [
        "4 cebolas",
        "2 cachos de alho",
        "8 batatas inglesas",
        "1 pacote milho sweet ou similar",
        "2 abobrinhas",
        "1 pedaço abóbora cabotiá",
        "2 bandejas quiabo",
        "1 maço couve manteiga orgânica",
        "2 cenouras",
        "1 alface americana",
        "1 rúcula baby",
        "1 tomatinho cereja hortisabor",
      ],
      frutas: [
        "2 pacotes morango cultivo suspenso (altea ou similar)",
        "10 bananas prata para consumo em 2 dias",
        "3 mamão papaya consumo em 2 dias",
        "1 maçã",
        "1/2 melão amarelo maduro",
        "2 avocados maduros",
        "5 limões tahity (escolher com casca mais lisa)",
      ],
      carnes: [
        "1 kg filé de peito Korin",
        "1 kg sobrecoxa",
        "1 kg patinho moído extralimpo (dividir em 2 bandejas)",
      ],
      laticinios: [
        "2 litros de leite integral Parmalat ou similar",
        "100g peito de peru sadia fininho",
        "1 bandeja muçarela hortisabor",
        "1 pote requeijão grande Tirolez",
        "1 iogurte grego grande Yorgus tampa azul",
      ],
      outros: [
        "1 pão de forma tradicional panco ou pullmann",
        "1 bandeja 20 ovos vermelhos nakamura ou similar",
        "2 molhos de tomate NOR ou similar",
        "2 pacotes de biscoito mãe terra de coco",
        "1 suco de laranja xandô",
        "1 suco de uva integral Aurora",
        "1 água de coco grande",
        "1 granola Keto Austrália (pacote verde)",
      ],
    },
  },
  {
    data: "2026-02-28",
    categorias: {
      frutas: ["10 bananas prata para consumo em 2 dias"],
      laticinios: [
        "100g peito de peru sadia (fatias finas)",
        "1 iogurte grego grande Yorgus tampa azul",
      ],
      outros: [
        "1 pão Tartapão multigrãos",
        "1 pacote biscoito LEV integral Marilan ou similar",
        "1 pacote biscoito mãe terra maizena",
        "1 pacote biscoito mãe terra côco",
        "1 pacote arroz cateto Camil ou similar",
        "1 pacote feijão preto",
      ],
    },
  },
  {
    data: "2026-02-26",
    categorias: {
      legumes: [
        "4 cebolas",
        "2 bandejas batata doce",
        "1 pacote milho sweet ou similar",
        "3 berinjelas",
        "2 bandejas ervilha torta",
        "1 maço de espinafre orgânico",
        "4 cenouras",
        "1 alface americana",
        "1 rúcula baby",
        "1 tomatinho cereja hortisabor",
      ],
      frutas: [
        "2 pacotes morango cultivo suspenso (altea ou similar)",
        "6 bananas prata para consumo em 2 dias",
        "3 mamão papaya consumo em 2 dias",
        "2 kiwis orgânicos maduros",
        "2 maçãs",
        "uva verde sem caroço gota de mel",
      ],
      carnes: [
        "1 kg filé de peito Korin",
        "1 kg patinho moído extralimpo (dividir em 2 bandejas)",
      ],
      laticinios: [
        "1 litro de leite integral Parmalat ou similar",
        "1 queijo fresco de cabra",
        "1 pedaço de queijo de cabra CABLANCA",
        "100g presunto tipo parma fininho",
        "1 iogurte grego grande Yorgus tampa azul",
      ],
      outros: [
        "1 pão de forma tradicional panco ou pullmann",
        "1 pacote bisnaguinha panco ou pullmann",
        "1 bandeja muçarela hortisabor",
        "1 bandeja 20 ovos vermelhos Nakamura",
      ],
    },
  },
  {
    data: "2026-02-20",
    categorias: {
      legumes: [
        "4 cebolas",
        "1 cabeça de alho roxo",
        "2 bandejas batata doce",
        "1 pacote milho sweet ou similar",
        "1 brocolis ninja",
        "2 bandejas vagem francesa",
        "1 couve-flor",
        "1 alface americana",
        "1 rúcula baby",
        "1 tomatinho cereja hortisabor",
      ],
      frutas: [
        "1 pacote morango cultivo suspenso (altea ou similar)",
        "6 bananas prata para consumo em 2 dias",
        "3 mamão papaya consumo em 2 dias",
        "6 limões tahity (casca lisa)",
      ],
      carnes: [
        "1 kg filé de peito Korin",
        "1 kg patinho moído extralimpo (dividir em 2 bandejas)",
        "500 gramas de lombinho suíno",
      ],
      outros: [
        "1 molho de tomate NOR ou similar",
        "1 azeite borges ou andorinha 500 ml",
        "2 litros de leite integral Parmalat ou similar",
        "1 iogurte grego grande Yorgus tampa azul",
        "1 pacote pão tartaruga multigrãos",
        "1 pão de forma tradicional panco ou pullmann",
        "1 bandeja muçarela hortisabor",
        "1 bandeja 20 ovos vermelhos Nakamura",
      ],
    },
  },
  {
    data: "2026-02-13",
    categorias: {
      legumes: [
        "4 cebolas",
        "1 cabeça de alho roxo",
        "8 batatas inglesas",
        "1 pacote milho sweet ou similar",
        "2 brocolis ninja",
        "5 cenouras",
        "1 bandeja quiabo",
        "2 abobrinhas",
        "1 beterraba",
      ],
      frutas: [
        "1 pacote morango cultivo suspenso (altea ou similar)",
        "8 bananas prata para consumo em 2 dias",
        "1 maçã",
        "1 pedaço melão amarelo",
        "6 limões tahity (casca lisa)",
      ],
      // carnes: "- -" → no items
      outros: [
        "1 molho de tomate NOR ou similar",
        "1 pacote arroz cateto",
        "1 pacote feijão vermelho",
        "1 azeite borges ou andorinha 500 ml",
        "2 litros de leite integral Parmalat ou similar",
      ],
    },
  },
  {
    data: "2026-02-09",
    categorias: {
      legumes: [
        "4 cebolas",
        "1 cabeça de alho roxo",
        "2 bandejas batata doce",
        "1 pacote milho sweet ou similar",
        "2 brocolis ninja",
        "3 chuchus",
        "1 couve-flor",
        "1 pedaço abóbora cabotiá",
      ],
      frutas: [
        "1 pacote morango cultivo suspenso (altea ou similar)",
        "6 bananas prata para consumo em 2 dias",
        "1 mamão papaya consumo em 2 dias",
        "1 maçã",
        "1 pedaço melão amarelo",
        "6 limões tahity (casca lisa)",
      ],
      carnes: [
        "1 kg filé de peito Korin",
        "1 kg patinho moído extralimpo (dividir em 2 bandejas)",
        "1 bandeja filé tilápia",
      ],
      outros: [
        "1 molho de tomate NOR ou similar",
        "1 pacote penne De Cecco",
        "1 azeite borges ou andorinha 500 ml",
        "2 litros de leite integral Parmalat ou similar",
        "1 iogurte grego grande Yorgus tampa azul",
        "1 pacote pão tartaruga multigrãos",
        "1 pote grande cottagy Yorgus ou 2 potes pequenos",
        "1 pão de forma tradicional panco ou pullmann",
        "1 bandeja muçarela hortisabor",
        "1 bandejinha de peito de peru sadia",
        "1 bandeja 20 ovos vermelhos nakamura",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Mapping: raw line → { catalogoId, quantidade }
//
// Each matcher returns null (no match) or { id, nome, quantidade, unidade,
// detalhes, marca } if it recognizes the line.
//
// We define matchers per catalogoId to handle variation across lists.
// ---------------------------------------------------------------------------

/**
 * Master item definitions.
 * Key = catalogoId (slug).
 * Value = { nome, unidade, detalhes, marca, defaultQty,
 *           match: (line) => qty string | null }
 *
 * `match` receives the raw line (already trimmed) and should return the
 * quantity string if the line describes this item, or null otherwise.
 */
const itemDefs = {
  // ---- LEGUMES ----
  cebolas: {
    nome: "cebolas",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+cebolas?$/i)?.[1] ?? null,
  },
  alho: {
    nome: "alho",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => {
      let m = l.match(/^(\d+)\s+cachos?\s+de\s+alho/i);
      if (m) return m[1] + " cachos";
      m = l.match(/^(\d+)\s+cabeça\s+de\s+alho/i);
      if (m) return m[1] + " cabeça";
      return null;
    },
  },
  "batatas-inglesas": {
    nome: "batatas inglesas",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+batatas?\s+inglesas?/i)?.[1] ?? null,
  },
  "batata-doce": {
    nome: "batata doce",
    unidade: "bandejas",
    detalhes: "",
    marca: "",
    match: (l) =>
      l.match(/^(\d+)\s+bandejas?\s+batata\s+doce/i)?.[1] ?? null,
  },
  "milho-sweet": {
    nome: "milho sweet",
    unidade: "pacote",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/milho\s+sweet/i) ? "1" : null),
  },
  abobrinhas: {
    nome: "abobrinhas",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+abobrinhas?$/i)?.[1] ?? null,
  },
  "abobora-cabotia": {
    nome: "abóbora cabotiá",
    unidade: "pedaço",
    detalhes: "",
    marca: "",
    match: (l) =>
      l.match(/ab[oó]bora\s+cabot/i) ? "1 pedaço" : null,
  },
  quiabo: {
    nome: "quiabo",
    unidade: "bandejas",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+bandejas?\s+quiabo/i)?.[1] ?? null,
  },
  "couve-manteiga": {
    nome: "couve manteiga orgânica",
    unidade: "maço",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/couve\s+manteiga/i) ? "1 maço" : null),
  },
  cenouras: {
    nome: "cenouras",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+cenouras?$/i)?.[1] ?? null,
  },
  "alface-americana": {
    nome: "alface americana",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/alface\s+americana/i) ? "1" : null),
  },
  "rucula-baby": {
    nome: "rúcula baby",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/r[uú]cula\s+baby/i) ? "1" : null),
  },
  "tomatinho-cereja": {
    nome: "tomatinho cereja",
    unidade: "",
    detalhes: "",
    marca: "Hortisabor",
    match: (l) => (l.match(/tomatinho\s+cereja/i) ? "1" : null),
  },
  berinjelas: {
    nome: "berinjelas",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+berinjelas?$/i)?.[1] ?? null,
  },
  "ervilha-torta": {
    nome: "ervilha torta",
    unidade: "bandejas",
    detalhes: "",
    marca: "",
    match: (l) =>
      l.match(/^(\d+)\s+bandejas?\s+ervilha\s+torta/i)?.[1] ?? null,
  },
  espinafre: {
    nome: "espinafre orgânico",
    unidade: "maço",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/espinafre/i) ? "1 maço" : null),
  },
  "brocolis-ninja": {
    nome: "brócolis ninja",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+brocolis\s+ninja/i)?.[1] ?? null,
  },
  "vagem-francesa": {
    nome: "vagem francesa",
    unidade: "bandejas",
    detalhes: "",
    marca: "",
    match: (l) =>
      l.match(/^(\d+)\s+bandejas?\s+vagem\s+francesa/i)?.[1] ?? null,
  },
  "couve-flor": {
    nome: "couve-flor",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/couve[- ]flor/i) ? "1" : null),
  },
  beterraba: {
    nome: "beterraba",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/beterraba/i) ? "1" : null),
  },
  chuchus: {
    nome: "chuchus",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+chuchus?$/i)?.[1] ?? null,
  },

  // ---- FRUTAS ----
  morango: {
    nome: "morango cultivo suspenso",
    unidade: "pacotes",
    detalhes: "",
    marca: "Altea",
    match: (l) => l.match(/^(\d+)\s+pacotes?\s+morango/i)?.[1] ?? null,
  },
  "bananas-prata": {
    nome: "bananas prata",
    unidade: "",
    detalhes: "para consumo em 2 dias",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+bananas?\s+prata/i)?.[1] ?? null,
  },
  "mamao-papaya": {
    nome: "mamão papaya",
    unidade: "",
    detalhes: "consumo em 2 dias",
    marca: "",
    match: (l) =>
      l.match(/^(\d+)\s+mam[aã]o\s+papaya/i)?.[1] ?? null,
  },
  maca: {
    nome: "maçã",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => {
      // match "1 maçã" or "2 maçãs"
      const m = l.match(/^(\d+)\s+ma[çc][aã]s?$/i);
      return m ? m[1] : null;
    },
  },
  "melao-amarelo": {
    nome: "melão amarelo",
    unidade: "pedaço",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/mel[aã]o\s+amarelo/i) ? "1" : null),
  },
  avocado: {
    nome: "avocados",
    unidade: "",
    detalhes: "maduros",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+avocados?/i)?.[1] ?? null,
  },
  "limoes-tahity": {
    nome: "limões tahity",
    unidade: "",
    detalhes: "escolher com casca mais lisa",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+lim[oõ]es\s+tah/i)?.[1] ?? null,
  },
  kiwi: {
    nome: "kiwis orgânicos",
    unidade: "",
    detalhes: "maduros",
    marca: "",
    match: (l) => l.match(/^(\d+)\s+kiwis?/i)?.[1] ?? null,
  },
  "uva-verde": {
    nome: "uva verde sem caroço",
    unidade: "",
    detalhes: "",
    marca: "Gota de Mel",
    match: (l) => (l.match(/uva\s+verde/i) ? "1" : null),
  },

  // ---- CARNES ----
  "file-peito-frango": {
    nome: "filé de peito de frango",
    unidade: "kg",
    detalhes: "",
    marca: "Korin",
    match: (l) => (l.match(/fil[eé]\s+de\s+peito\s+Korin/i) ? "1 kg" : null),
  },
  sobrecoxa: {
    nome: "sobrecoxa",
    unidade: "kg",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/sobrecoxa/i) ? "1 kg" : null),
  },
  "patinho-moido": {
    nome: "patinho moído extralimpo",
    unidade: "kg",
    detalhes: "dividir em 2 bandejas",
    marca: "",
    match: (l) => (l.match(/patinho\s+mo[ií]do/i) ? "1 kg" : null),
  },
  "lombinho-suino": {
    nome: "lombinho suíno",
    unidade: "gramas",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/lombinho\s+su[ií]no/i) ? "500 gramas" : null),
  },
  "file-tilapia": {
    nome: "filé tilápia",
    unidade: "bandeja",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/fil[eé]\s+til[aá]pia/i) ? "1 bandeja" : null),
  },

  // ---- LATICÍNIOS ----
  "leite-integral": {
    nome: "leite integral",
    unidade: "litros",
    detalhes: "",
    marca: "Parmalat",
    match: (l) => {
      const m = l.match(/^(\d+)\s+(litros?)\s+de\s+leite\s+integral/i);
      return m ? m[1] + " " + m[2] : null;
    },
  },
  "peito-de-peru": {
    nome: "peito de peru",
    unidade: "",
    detalhes: "fininho",
    marca: "Sadia",
    match: (l) => {
      if (l.match(/peito\s+de\s+peru/i)) {
        const m = l.match(/^(\d+g?)/i);
        return m ? m[1] : "100g";
      }
      return null;
    },
  },
  mucarela: {
    nome: "muçarela",
    unidade: "bandeja",
    detalhes: "",
    marca: "Hortisabor",
    match: (l) => (l.match(/mu[çc]arela\s+hortisabor/i) ? "1 bandeja" : null),
  },
  requeijao: {
    nome: "requeijão",
    unidade: "pote",
    detalhes: "",
    marca: "Tirolez",
    match: (l) => (l.match(/requeij[aã]o/i) ? "1 pote grande" : null),
  },
  "iogurte-grego": {
    nome: "iogurte grego grande",
    unidade: "",
    detalhes: "tampa azul",
    marca: "Yorgus",
    match: (l) => (l.match(/iogurte\s+grego/i) ? "1" : null),
  },
  "queijo-cabra-fresco": {
    nome: "queijo fresco de cabra",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/queijo\s+fresco\s+de\s+cabra/i) ? "1" : null),
  },
  "queijo-cabra-cablanca": {
    nome: "queijo de cabra Cablanca",
    unidade: "pedaço",
    detalhes: "",
    marca: "Cablanca",
    match: (l) => (l.match(/queijo\s+de\s+cabra\s+CABLANCA/i) ? "1 pedaço" : null),
  },
  "presunto-parma": {
    nome: "presunto tipo parma",
    unidade: "",
    detalhes: "fininho",
    marca: "",
    match: (l) => (l.match(/presunto\s+tipo\s+parma/i) ? "100g" : null),
  },

  // ---- OUTROS ----
  "pao-de-forma": {
    nome: "pão de forma tradicional",
    unidade: "",
    detalhes: "",
    marca: "Panco/Pullmann",
    match: (l) => (l.match(/p[aã]o\s+de\s+forma\s+tradicional/i) ? "1" : null),
  },
  "ovos-vermelhos": {
    nome: "ovos vermelhos",
    unidade: "bandeja 20",
    detalhes: "",
    marca: "Nakamura",
    match: (l) =>
      l.match(/ovos\s+vermelhos\s+nakamura/i) ? "1 bandeja 20" : null,
  },
  "molho-de-tomate": {
    nome: "molho de tomate",
    unidade: "",
    detalhes: "",
    marca: "NOR",
    match: (l) => {
      const m = l.match(/^(\d+)\s+molhos?\s+de\s+tomate/i);
      return m ? m[1] : null;
    },
  },
  "biscoito-mae-terra-coco": {
    nome: "biscoito mãe terra coco",
    unidade: "pacote",
    detalhes: "",
    marca: "Mãe Terra",
    match: (l) =>
      l.match(/biscoito\s+m[aã]e\s+terra\s+(de\s+)?c[oô]co/i)
        ? l.match(/^(\d+)\s+pacotes?/i)?.[1] ?? "1"
        : null,
  },
  "suco-laranja": {
    nome: "suco de laranja",
    unidade: "",
    detalhes: "",
    marca: "Xandô",
    match: (l) => (l.match(/suco\s+de\s+laranja/i) ? "1" : null),
  },
  "suco-uva": {
    nome: "suco de uva integral",
    unidade: "",
    detalhes: "",
    marca: "Aurora",
    match: (l) => (l.match(/suco\s+de\s+uva/i) ? "1" : null),
  },
  "agua-de-coco": {
    nome: "água de coco grande",
    unidade: "",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/[aá]gua\s+de\s+coco/i) ? "1" : null),
  },
  "granola-keto": {
    nome: "granola Keto",
    unidade: "pacote",
    detalhes: "pacote verde",
    marca: "Austrália",
    match: (l) => (l.match(/granola\s+Keto/i) ? "1 pacote" : null),
  },
  "pao-tartaruga-multigraos": {
    nome: "pão tartaruga multigrãos",
    unidade: "pacote",
    detalhes: "",
    marca: "",
    match: (l) =>
      l.match(/p[aã]o\s+tarta(ruga|p[aã]o)\s+multi/i) ? "1" : null,
  },
  "biscoito-lev": {
    nome: "biscoito LEV integral",
    unidade: "pacote",
    detalhes: "",
    marca: "Marilan",
    match: (l) => (l.match(/biscoito\s+LEV/i) ? "1 pacote" : null),
  },
  "biscoito-mae-terra-maizena": {
    nome: "biscoito mãe terra maizena",
    unidade: "pacote",
    detalhes: "",
    marca: "Mãe Terra",
    match: (l) =>
      l.match(/biscoito\s+m[aã]e\s+terra\s+maizena/i) ? "1 pacote" : null,
  },
  "arroz-cateto": {
    nome: "arroz cateto",
    unidade: "pacote",
    detalhes: "",
    marca: "Camil",
    match: (l) => (l.match(/arroz\s+cateto/i) ? "1 pacote" : null),
  },
  "feijao-preto": {
    nome: "feijão preto",
    unidade: "pacote",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/feij[aã]o\s+preto/i) ? "1 pacote" : null),
  },
  bisnaguinha: {
    nome: "bisnaguinha",
    unidade: "pacote",
    detalhes: "",
    marca: "Panco/Pullmann",
    match: (l) => (l.match(/bisnaguinha/i) ? "1 pacote" : null),
  },
  "feijao-vermelho": {
    nome: "feijão vermelho",
    unidade: "pacote",
    detalhes: "",
    marca: "",
    match: (l) => (l.match(/feij[aã]o\s+vermelho/i) ? "1 pacote" : null),
  },
  azeite: {
    nome: "azeite",
    unidade: "500 ml",
    detalhes: "",
    marca: "Borges/Andorinha",
    match: (l) => (l.match(/azeite\s+borges/i) ? "1" : null),
  },
  "penne-de-cecco": {
    nome: "penne",
    unidade: "pacote",
    detalhes: "",
    marca: "De Cecco",
    match: (l) => (l.match(/penne\s+De\s+Cecco/i) ? "1 pacote" : null),
  },
  "cottagy-yorgus": {
    nome: "cottagy",
    unidade: "pote",
    detalhes: "",
    marca: "Yorgus",
    match: (l) => (l.match(/cottagy/i) ? "1 pote grande" : null),
  },
};

// ---------------------------------------------------------------------------
// Process each list
// ---------------------------------------------------------------------------

const TOTAL_LISTAS = listas.length; // 6

// Track: for each catalogoId → { appearances: Set<data>, quantidades: [string], firstCategoria }
const catalog = {};

// historico entries
const historico = [];

for (const lista of listas) {
  const itensForHistorico = [];

  for (const [categoria, linhas] of Object.entries(lista.categorias)) {
    for (const rawLine of linhas) {
      const line = rawLine.trim();
      let matched = false;

      for (const [id, def] of Object.entries(itemDefs)) {
        const qty = def.match(line);
        if (qty !== null) {
          matched = true;

          // Init catalog entry if needed
          if (!catalog[id]) {
            catalog[id] = {
              nome: def.nome,
              categoria: categoria,
              unidade: def.unidade,
              detalhes: def.detalhes,
              marca: def.marca,
              appearances: new Set(),
              quantidades: [],
            };
          }

          catalog[id].appearances.add(lista.data);
          catalog[id].quantidades.push(qty);

          itensForHistorico.push({
            catalogoId: id,
            quantidade: qty,
          });

          break; // first match wins
        }
      }

      if (!matched) {
        console.warn(`UNMATCHED [${lista.data}] [${categoria}]: "${line}"`);
      }
    }
  }

  historico.push({
    data: lista.data,
    itens: itensForHistorico,
  });
}

// ---------------------------------------------------------------------------
// Build catalogo array
// ---------------------------------------------------------------------------

function mostCommon(arr) {
  const freq = {};
  for (const v of arr) {
    freq[v] = (freq[v] || 0) + 1;
  }
  let best = arr[0];
  let bestCount = 0;
  for (const [v, c] of Object.entries(freq)) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

const catalogo = Object.entries(catalog).map(([id, info]) => ({
  id,
  nome: info.nome,
  categoria: info.categoria,
  quantidadePadrao: mostCommon(info.quantidades),
  unidade: info.unidade,
  detalhes: info.detalhes,
  marca: info.marca,
  score: parseFloat((info.appearances.size / TOTAL_LISTAS).toFixed(2)),
}));

// Sort by score descending then alphabetically
catalogo.sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome));

const output = { catalogo, historico };

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const outPath = path.join(__dirname, "..", "public", "data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

console.log(`\nWrote ${outPath}`);
console.log(`Catalog items: ${catalogo.length}`);
console.log(`History entries: ${historico.length}`);
console.log("\n--- Score check ---");
for (const item of catalogo) {
  console.log(
    `  ${item.score.toFixed(2)}  ${item.nome} (qty: ${item.quantidadePadrao})`
  );
}
