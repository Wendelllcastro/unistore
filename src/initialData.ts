/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Category, Movement } from "./types";

const COLOR_MAP: Record<string, string> = {
  "CREME": "#FDF6E2",
  "ROSA SECO": "#C29B9B",
  "ROSA CHICLETE": "#FF6B8B",
  "LAVANDA": "#E3D3FF",
  "ROXO": "#8B5CF6",
  "VINHO": "#721C24",
  "AZUL MARINHO": "#1E293B",
  "AZUL CÉU": "#60A5FA",
  "VERDE CANA": "#84CC16",
  "VERDE ÁGUA": "#2DD4BF",
  "PRETO": "#111111",
  "BRANCA": "#FAFAFA",
  "ROSA PINK / BARBIE": "#EC4899",
  "AZUL ROYAL / AUTISMO": "#2563EB",
};

// Raw definitions from PDF Pages 1 and 2
const BATA_PRINCESA_DATA = [
  { color: "ROSA SECO", sizes: { P: 0, M: 0, G: 1, GG: 2, XG: 2 } },
  { color: "ROSA CHICLETE", sizes: { P: 1, M: 0, G: 1, GG: 2, XG: 2 } },
  { color: "LAVANDA", sizes: { P: 1, M: 0, G: 1, GG: 2, XG: 2 } },
  { color: "ROXO", sizes: { P: 0, M: 3, G: 1, GG: 2, XG: 1 } },
  { color: "VINHO", sizes: { P: 0, M: 0, G: 0, GG: 1, XG: 0 } }, // "1Crep" represented as 1
  { color: "AZUL MARINHO", sizes: { P: 0, M: 0, G: 0, GG: 2, XG: 2 } },
  { color: "AZUL CÉU", sizes: { P: 1, M: 0, G: 0, GG: 1, XG: 0 } },
  { color: "VERDE CANA", sizes: { P: 0, M: 0, G: 5, GG: 1, XG: 2 } },
  { color: "VERDE ÁGUA", sizes: { P: 1, M: 1, G: 2, GG: 3, XG: 2 } },
  { color: "PRETO", sizes: { P: 0, M: 1, G: 1, GG: 1, XG: 2 } },
];

const BATA_TULIPA_DATA = [
  { color: "ROSA SECO", sizes: { P: 0, M: 0, G: 2, GG: 1, XG: 2 } },
  { color: "ROSA CHICLETE", sizes: { P: 0, M: 0, G: 0, GG: 2, XG: 2 } },
  { color: "LAVANDA", sizes: { P: 0, M: 0, G: 0, GG: 1, XG: 1 } },
  { color: "ROXO", sizes: { P: 0, M: 0, G: 0, GG: 1, XG: 1 } },
  { color: "AZUL MARINHO", sizes: { P: 0, M: 1, G: 0, GG: 0, XG: 2 } },
  { color: "AZUL CÉU", sizes: { P: 1, M: 0, G: 0, GG: 1, XG: 0 } },
  { color: "VERDE CANA", sizes: { P: 0, M: 0, G: 1, GG: 0, XG: 2 } },
  { color: "VERDE ÁGUA", sizes: { P: 0, M: 1, G: 2, GG: 1, XG: 0 } },
  { color: "PRETO", sizes: { P: 0, M: 0, G: 3, GG: 0, XG: 1 } },
];

const BATA_BUFANTE_DATA = [
  { color: "CREME", sizes: { P: 1, M: 0, G: 0, GG: 2, XG: 0 } },
  { color: "ROSA SECO", sizes: { P: 0, M: 1, G: 1, GG: 1, XG: 1 } },
  { color: "ROSA CHICLETE", sizes: { P: 0, M: 0, G: 1, GG: 1, XG: 1 } },
  { color: "LAVANDA", sizes: { P: 0, M: 0, G: 2, GG: 1, XG: 2 } },
  { color: "ROXO", sizes: { P: 0, M: 1, G: 3, GG: 2, XG: 2 } },
  { color: "VERDE CANA", sizes: { P: 1, M: 0, G: 4, GG: 1, XG: 1 } },
  { color: "VERDE ÁGUA", sizes: { P: 0, M: 0, G: 1, GG: 0, XG: 2 } },
  { color: "PRETO", sizes: { P: 0, M: 0, G: 2, GG: 2, XG: 2 } },
];

const CALCA_ELASTICO_DATA = [
  { color: "CREME", sizes: { P: 1, M: 0, G: 0, GG: 2, XG: 0 } },
  { color: "ROSA SECO", sizes: { P: 0, M: 0, G: 0, GG: 0, XG: 1 } },
  { color: "LAVANDA", sizes: { P: 0, M: 0, G: 1, GG: 0, XG: 3 } },
  { color: "ROXO", sizes: { P: 1, M: 1, G: 0, GG: 2, XG: 2 } },
  { color: "VINHO", sizes: { P: 0, M: 0, G: 0, GG: 1, XG: 0 } },
  { color: "AZUL CÉU", sizes: { P: 0, M: 1, G: 0, GG: 2, XG: 0 } },
  { color: "VERDE CANA", sizes: { P: 1, M: 0, G: 4, GG: 3, XG: 0 } },
  { color: "VERDE ÁGUA", sizes: { P: 0, M: 0, G: 0, GG: 1, XG: 2 } },
  { color: "PRETO", sizes: { P: 0, M: 1, G: 2, GG: 0, XG: 0 } },
  { color: "ROSA PINK / BARBIE", sizes: { P: 0, M: 11, G: 14, GG: 12, XG: 0 } },
  { color: "AZUL ROYAL / AUTISMO", sizes: { P: 1, M: 11, G: 14, GG: 13, XG: 0 } },
];

const CALCA_PALA_DATA = [
  { color: "ROSA SECO", sizes: { P: 0, M: 1, G: 4, GG: 4, XG: 1 } },
  { color: "ROSA CHICLETE", sizes: { P: 0, M: 2, G: 3, GG: 5, XG: 6 } },
  { color: "LAVANDA", sizes: { P: 0, M: 0, G: 0, GG: 4, XG: 2 } },
  { color: "ROXO", sizes: { P: 0, M: 2, G: 4, GG: 3, XG: 3 } },
  { color: "VINHO", sizes: { P: 1, M: 0, G: 0, GG: 0, XG: 0 } }, // "1Crep" represented as 1
  { color: "AZUL MARINHO", sizes: { P: 0, M: 1, G: 0, GG: 1, XG: 4 } },
  { color: "AZUL CÉU", sizes: { P: 2, M: 0, G: 0, GG: 0, XG: 0 } },
  { color: "VERDE CANA", sizes: { P: 0, M: 2, G: 5, GG: 4, XG: 5 } },
  { color: "VERDE ÁGUA", sizes: { P: 0, M: 2, G: 3, GG: 3, XG: 3 } },
  { color: "PRETO", sizes: { P: 0, M: 1, G: 4, GG: 3, XG: 5 } },
];

const ESTAMPAS_BATAS_DATA = [
  { name: "Mônica", sizes: { P: 2, M: 14, G: 13, GG: 14, XG: 0 }, color: "#DC2626", category: "Estampas" },
  { name: "Cuidador Branco", sizes: { P: 4, M: 15, G: 15, GG: 15, XG: 0 }, color: "#E2E8F0", category: "Estampas" },
  { name: "Barbie", sizes: { P: 0, M: 11, G: 12, GG: 12, XG: 0 }, color: "#EC4899", category: "Estampas" },
  { name: "Autismo Verde", sizes: { P: 0, M: 6, G: 6, GG: 7, XG: 0 }, color: "#10B981", category: "Estampas" },
  { name: "Autismo Azul Marinho", sizes: { P: 0, M: 7, G: 7, GG: 8, XG: 0 }, color: "#1E3A8A", category: "Estampas" },
];

const ODONTOLOGIA_DATA = [
  { name: "Odontologia", sizes: { P: 0, M: 0, G: 3, GG: 3, XG: 3 }, color: "#06B6D4", category: "Odontologia" } // "3F" represented as 3
];

// Compile programmatically to single list of Products
const compileSeededProducts = (): Product[] => {
  const list: Product[] = [];
  let index = 1;

  // Add Bata Princesa variations
  BATA_PRINCESA_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-princesa-${index++}`,
        name: `Bata Princesa (${item.color})`,
        category: "Batas",
        color: COLOR_MAP[item.color] || "#FF6B00",
        description: `Bata Princesa de alta costura com pregas sutis, mangas bufantes elegantes e modelagem acinturada. Confeccionada em tecido de fácil manutenção, ideal para profissionais exigentes de clínicas de estética e saúde. Cor: ${item.color}.`,
        mainImage: "bata_princesa",
        gallery: ["bata_princesa"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-20").toISOString(),
        views: Math.floor(Math.random() * 80) + 40
      });
    }
  });

  // Add Bata Tulipa variations
  BATA_TULIPA_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-tulipa-${index++}`,
        name: `Bata Tulipa (${item.color})`,
        category: "Batas",
        color: COLOR_MAP[item.color] || "#FF6B00",
        description: `Bata Tulipa de alta costura com decote em pétala, bolsos embutidos discretos e excelente ergonomia para o dia a dia clínico. Disponível em tecido respirável premium na cor ${item.color}.`,
        mainImage: "bata_tulipa",
        gallery: ["bata_tulipa"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-21").toISOString(),
        views: Math.floor(Math.random() * 60) + 20
      });
    }
  });

  // Add Bata Bufante variations
  BATA_BUFANTE_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-bufante-${index++}`,
        name: `Bata Bufante (${item.color})`,
        category: "Batas",
        color: COLOR_MAP[item.color] || "#FF6B00",
        description: `Bata com punhos elásticos ajustáveis e mangas bufantes charmosas que oferecem liberdade de movimento total e design romântico contemporâneo. Cor: ${item.color}.`,
        mainImage: "bata_bufante",
        gallery: ["bata_bufante"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-22").toISOString(),
        views: Math.floor(Math.random() * 50) + 15
      });
    }
  });

  // Add Calça Elástico variations
  CALCA_ELASTICO_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-celastico-${index++}`,
        name: `Calça Elástico (${item.color})`,
        category: "Calças",
        color: COLOR_MAP[item.color] || "#FF6B00",
        description: `Calça com cós de elástico anatômico de alto conforto, cordão regulador de ajuste e bolsos utilitários funcionais. Ideal para plantões de longa duração. Cor: ${item.color}.`,
        mainImage: "calca_elastico",
        gallery: ["calca_elastico"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-18").toISOString(),
        views: Math.floor(Math.random() * 70) + 30
      });
    }
  });

  // Add Calça Pala variations
  CALCA_PALA_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-cpala-${index++}`,
        name: `Calça Pala (${item.color})`,
        category: "Calças",
        color: COLOR_MAP[item.color] || "#FF6B00",
        description: `Calça clássica estilo alfaiataria com pala frontal estruturada de caimento perfeito, zíper discreto lateral e costura reforçada de longa durabilidade. Cor: ${item.color}.`,
        mainImage: "calca_pala",
        gallery: ["calca_pala"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-19").toISOString(),
        views: Math.floor(Math.random() * 50) + 20
      });
    }
  });

  // Add Estampas Batas (Mônica, Barbie, etc)
  ESTAMPAS_BATAS_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-estampas-${index++}`,
        name: `Scrub Estampa ${item.name}`,
        category: "Estampas",
        color: item.color,
        description: `Jaleco Scrub alegre e humanizado com estampa temática ${item.name}. Toque super macio, alta respirabilidade e modelagem solta ideal para atendimento pediátrico e odontológico.`,
        mainImage: "scrub_monica",
        gallery: ["scrub_monica"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-25").toISOString(),
        views: Math.floor(Math.random() * 120) + 80
      });
    }
  });

  // Add Odontologia
  ODONTOLOGIA_DATA.forEach((item) => {
    const totalStock = Object.values(item.sizes).reduce((acc, q) => acc + q, 0);
    if (totalStock > 0) {
      list.push({
        id: `prod-odontologia-${index++}`,
        name: `Scrub Temático Odontologia`,
        category: "Estampas",
        color: item.color,
        description: `Conjunto cirúrgico alegre e lúdico para atendimento odontológico com estampas de sorrisos e elementos lúdicos. Confeccionado em algodão premium leve.`,
        mainImage: "conjunto_odonto",
        gallery: ["conjunto_odonto"],
        sizes: item.sizes,
        totalStock,
        createdAt: new Date("2026-06-26").toISOString(),
        views: Math.floor(Math.random() * 90) + 40
      });
    }
  });

  return list;
};

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_MOVEMENTS: Movement[] = [];
