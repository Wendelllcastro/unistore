/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductSizes {
  P: number;
  M: number;
  G: number;
  GG: number;
  XG: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  color: string;
  description: string;
  mainImage: string; // URL or base64 data
  gallery: string[]; // URLs or base64 data
  sizes: ProductSizes;
  totalStock: number; // calculated automatically
  createdAt: string;
  views: number;
  price?: number;
}

export interface Category {
  id: string;
  name: string;
  productCount: number;
}

export interface Movement {
  id: string;
  productId: string;
  productName: string;
  user: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  quantity: number;
  size: keyof ProductSizes;
  type: 'entrada' | 'saída' | 'ajuste';
  notes: string;
}

export interface ImportReport {
  id: string;
  date: string;
  fileName: string;
  status: 'success' | 'failed';
  addedProductsCount: number;
  updatedProductsCount: number;
  newCategoriesCount: number;
  details: string;
}

export interface CustomerRegistration {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cep: string;
  cidade: string;
  estado: string;
  bairro: string;
  rua: string;
  numero: string;
  registeredAt: string;
}

export interface DBState {
  products: Product[];
  categories: Category[];
  movements: Movement[];
  importReports: ImportReport[];
  customers?: CustomerRegistration[];
}

export interface CartItem {
  id: string; // product.id + '-' + size
  product: Product;
  size: keyof ProductSizes;
  quantity: number;
}

