/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_MOVEMENTS } from "./src/initialData";
import { DBState, Product, Category, Movement, ImportReport, ProductSizes } from "./src/types";

import { createClient } from "@supabase/supabase-js";

const DB_FILE = path.join(process.cwd(), "database.json");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tgjreksqakjzojbdtfkm.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_RvnDq6XcjFcbzge6yAZODQ_hb4brLAr";

let cleanUrl = SUPABASE_URL.trim();
if (cleanUrl.endsWith("/rest/v1/")) {
  cleanUrl = cleanUrl.slice(0, -9);
} else if (cleanUrl.endsWith("/rest/v1")) {
  cleanUrl = cleanUrl.slice(0, -8);
}

const supabase = createClient(cleanUrl, SUPABASE_ANON_KEY);

let supabaseOnline = false;
let supabaseError: string | null = null;

let wss: WebSocketServer | null = null;

// Real-time broadcast utility
function broadcast(data: any) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Helper to get local database state (from file or default seed)
function getLocalDB(): DBState {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      
      // If the file exists but has no products property, seed default products so the user has initial demo data
      if (parsed.products === undefined) {
        console.log("Local database file exists but has no products key. Seeding initial demo data...");
        const seeded = {
          products: INITIAL_PRODUCTS,
          categories: INITIAL_CATEGORIES,
          movements: INITIAL_MOVEMENTS,
          importReports: parsed.importReports || [],
          customers: parsed.customers || []
        };
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), "utf-8");
        } catch (err) {
          console.error("Failed to write initial seeded data to file", err);
        }
        return seeded;
      }

      // Enforce existence of essential arrays
      if (!parsed.customers) parsed.customers = [];
      if (!parsed.importReports) parsed.importReports = [];
      if (!parsed.movements) parsed.movements = [];
      if (!parsed.categories) parsed.categories = [];
      
      return parsed;
    } catch (e) {
      console.error("Error reading database file, using seeded data", e);
    }
  }

  const defaultState: DBState = {
    products: INITIAL_PRODUCTS,
    categories: INITIAL_CATEGORIES,
    movements: INITIAL_MOVEMENTS,
    importReports: [],
    customers: []
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write default state to new database file", err);
  }

  return defaultState;
}

// Helper to load database state
async function loadDB(): Promise<DBState> {
  // Try loading from Supabase first
  try {
    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", "inventory_db")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Table exists but record doesn't exist yet! Supabase is ONLINE!
        supabaseOnline = true;
        supabaseError = null;
        console.log("Supabase connected! 'inventory_db' record not found, seeding from local data...");
        const localState = getLocalDB();
        // Seed Supabase with this local state
        await supabase.from("app_state").upsert({ key: "inventory_db", value: localState });
        return localState;
      }
      throw error;
    }

    if (data && data.value) {
      supabaseOnline = true;
      supabaseError = null;
      
      const fetched = data.value as DBState;
      // Guarantee structure safety
      if (!fetched.products) fetched.products = [];
      if (!fetched.categories) fetched.categories = [];
      if (!fetched.movements) fetched.movements = [];
      if (!fetched.importReports) fetched.importReports = [];
      if (!fetched.customers) fetched.customers = [];

      return fetched;
    }
  } catch (err: any) {
    console.warn("Supabase load failed, falling back to local file:", err.message || err);
    supabaseOnline = false;
    if (err.message && err.message.includes("fetch failed")) {
      supabaseError = "Erro de conexão com o Supabase (fetch failed). Verifique sua conexão de rede ou credenciais.";
    } else if (err && err.code === "PGRST205") {
      supabaseError = "Tabela 'app_state' não encontrada no banco do Supabase. Por favor, crie a tabela usando o script SQL abaixo.";
    } else {
      supabaseError = err.message || JSON.stringify(err);
    }
  }

  // Fallback to local file
  const local = getLocalDB();
  if (!local.customers) local.customers = [];
  if (!local.importReports) local.importReports = [];
  if (!local.movements) local.movements = [];
  if (!local.products) local.products = [];
  if (!local.categories) local.categories = [];
  return local;
}

// Helper to save database state
async function saveDB(state: DBState) {
  // Ensure we don't have undefined fields
  if (!state.customers) state.customers = [];
  if (!state.importReports) state.importReports = [];
  if (!state.movements) state.movements = [];
  if (!state.products) state.products = [];
  if (!state.categories) state.categories = [];

  // Always save locally as a backup / local cache
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing to database file", e);
  }

  // Try saving to Supabase
  try {
    const { error } = await supabase
      .from("app_state")
      .upsert({ key: "inventory_db", value: state });

    if (error) {
      throw error;
    }
    supabaseOnline = true;
    supabaseError = null;
  } catch (err: any) {
    if (err.message && err.message.includes("fetch failed")) {
      console.warn("Supabase network connection failed (fetch failed). Operating in local mode.");
      supabaseError = "Erro de conexão com o Supabase (fetch failed). Verifique sua conexão de rede ou credenciais.";
    } else {
      console.error("Error saving to Supabase:", err.message || err);
      if (err && err.code === "PGRST205") {
        supabaseError = "Tabela 'app_state' não encontrada no banco do Supabase. Por favor, crie a tabela usando o script SQL abaixo.";
      } else {
        supabaseError = err.message || JSON.stringify(err);
      }
    }
    supabaseOnline = false;
  }

  // Broadcast updated database state to all connected WebSocket clients in real-time
  broadcast({ type: "db_update", db: state });
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Prevent 404 error for favicon.ico in the browser
  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API: Get Supabase Connection Status
  app.get("/api/supabase-status", (req, res) => {
    res.json({
      online: supabaseOnline,
      error: supabaseError,
      config: {
        url: cleanUrl,
        table: "app_state",
        key: "inventory_db"
      },
      sqlSetup: `CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);`
    });
  });

  // API: Get entire Database State
  app.get("/api/db", async (req, res) => {
    const db = await loadDB();
    res.json(db);
  });

  // API: Reset Database to Seeds
  app.post("/api/db/reset", async (req, res) => {
    const state: DBState = {
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      movements: INITIAL_MOVEMENTS,
      importReports: [],
      customers: []
    };
    await saveDB(state);
    res.json({ success: true, message: "Banco de dados restaurado com sucesso!", db: state });
  });

  // API: Create a Product
  app.post("/api/products", async (req, res) => {
    const db = await loadDB();
    const newProduct: Omit<Product, "id" | "createdAt" | "views" | "totalStock"> & { id?: string } = req.body;
    
    const sizes: ProductSizes = newProduct.sizes || { P: 0, M: 0, G: 0, GG: 0, XG: 0 };
    const totalStock = Object.values(sizes).reduce((acc, curr) => acc + (curr || 0), 0);

    const product: Product = {
      id: newProduct.id || `prod-${Date.now()}`,
      name: newProduct.name,
      category: newProduct.category || "Sem Categoria",
      color: newProduct.color || "#FF6B00",
      description: newProduct.description || "",
      mainImage: newProduct.mainImage || "default_product",
      gallery: newProduct.gallery || [],
      sizes,
      totalStock,
      createdAt: new Date().toISOString(),
      views: 0,
      price: newProduct.price !== undefined && newProduct.price !== null ? Number(newProduct.price) : undefined
    };

    db.products.push(product);

    // Increment category count or add new category
    const catIdx = db.categories.findIndex(c => c.name.toLowerCase() === product.category.toLowerCase());
    if (catIdx >= 0) {
      db.categories[catIdx].productCount += 1;
    } else {
      db.categories.push({
        id: `cat-${Date.now()}`,
        name: product.category,
        productCount: 1
      });
    }

    // Record Stock Movements for initial sizes
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    Object.entries(sizes).forEach(([size, qty]) => {
      if (qty > 0) {
        db.movements.unshift({
          id: `mov-${Date.now()}-${size}`,
          productId: product.id,
          productName: product.name,
          user: "Administrador",
          date: dateStr,
          time: timeStr,
          quantity: qty,
          size: size as keyof ProductSizes,
          type: "entrada",
          notes: "Estoque inicial no cadastro do produto"
        });
      }
    });

    await saveDB(db);
    res.status(201).json({ success: true, product, db });
  });

  // API: Update Product
  app.put("/api/products/:id", async (req, res) => {
    const db = await loadDB();
    const { id } = req.params;
    const updatedData: Partial<Product> = req.body;

    const prodIdx = db.products.findIndex(p => p.id === id);
    if (prodIdx === -1) {
      return res.status(404).json({ success: false, message: "Produto não encontrado" });
    }

    const oldProduct = db.products[prodIdx];
    const newSizes: ProductSizes = updatedData.sizes || oldProduct.sizes;
    const totalStock = Object.values(newSizes).reduce((acc, curr) => acc + (curr || 0), 0);

    // Handle potential category changes
    const oldCat = oldProduct.category;
    const newCat = updatedData.category || oldProduct.category;

    if (oldCat.toLowerCase() !== newCat.toLowerCase()) {
      // Decrease old category count
      const oldCatIdx = db.categories.findIndex(c => c.name.toLowerCase() === oldCat.toLowerCase());
      if (oldCatIdx >= 0) {
        db.categories[oldCatIdx].productCount = Math.max(0, db.categories[oldCatIdx].productCount - 1);
      }
      // Increase new category count
      const newCatIdx = db.categories.findIndex(c => c.name.toLowerCase() === newCat.toLowerCase());
      if (newCatIdx >= 0) {
        db.categories[newCatIdx].productCount += 1;
      } else {
        db.categories.push({
          id: `cat-${Date.now()}`,
          name: newCat,
          productCount: 1
        });
      }
    }

    // Record Stock Movements for changes
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    Object.entries(newSizes).forEach(([size, qty]) => {
      const oldQty = oldProduct.sizes[size as keyof ProductSizes] || 0;
      const diff = qty - oldQty;
      if (diff !== 0) {
        db.movements.unshift({
          id: `mov-${Date.now()}-${size}`,
          productId: id,
          productName: updatedData.name || oldProduct.name,
          user: "Administrador",
          date: dateStr,
          time: timeStr,
          quantity: Math.abs(diff),
          size: size as keyof ProductSizes,
          type: diff > 0 ? "entrada" : "saída",
          notes: `Ajuste manual de estoque (antigo: ${oldQty}, novo: ${qty})`
        });
      }
    });

    const updatedProduct: Product = {
      ...oldProduct,
      ...updatedData,
      sizes: newSizes,
      totalStock,
    };

    db.products[prodIdx] = updatedProduct;

    // Remove empty categories
    db.categories = db.categories.filter(c => c.productCount > 0 || INITIAL_CATEGORIES.some(ic => ic.name.toLowerCase() === c.name.toLowerCase()));

    await saveDB(db);
    res.json({ success: true, product: updatedProduct, db });
  });

  // API: Record Manual Movement
  app.post("/api/movements", async (req, res) => {
    const db = await loadDB();
    const { productId, size, quantity, type, notes, user } = req.body;

    const prodIdx = db.products.findIndex(p => p.id === productId);
    if (prodIdx === -1) {
      return res.status(404).json({ success: false, message: "Produto não encontrado" });
    }

    const product = db.products[prodIdx];
    const oldQty = product.sizes[size as keyof ProductSizes] || 0;
    let newQty = oldQty;

    if (type === "entrada") {
      newQty = oldQty + quantity;
    } else if (type === "saída") {
      newQty = Math.max(0, oldQty - quantity);
    } else if (type === "ajuste") {
      newQty = quantity;
    }

    // Update sizes and total stock
    product.sizes[size as keyof ProductSizes] = newQty;
    product.totalStock = Object.values(product.sizes).reduce((acc, curr) => acc + (curr || 0), 0);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const movement: Movement = {
      id: `mov-${Date.now()}`,
      productId,
      productName: product.name,
      user: user || "Administrador",
      date: dateStr,
      time: timeStr,
      quantity,
      size,
      type,
      notes: notes || `Movimentação de ${type}`
    };

    db.movements.unshift(movement);
    await saveDB(db);

    res.json({ success: true, product, movement, db });
  });

  // API: Delete All Products
  app.delete("/api/products", async (req, res) => {
    try {
      const db = await loadDB();
      db.products = [];
      db.categories = INITIAL_CATEGORIES.map(ic => ({ ...ic, productCount: 0 }));
      db.movements = [];
      await saveDB(db);
      res.json({ success: true, db });
    } catch (err) {
      console.error("Error deleting all products:", err);
      res.status(500).json({ success: false, message: "Erro no servidor" });
    }
  });

  // API: Delete Product
  app.delete("/api/products/:id", async (req, res) => {
    const db = await loadDB();
    const { id } = req.params;

    const prodIdx = db.products.findIndex(p => p.id === id);
    if (prodIdx === -1) {
      return res.status(404).json({ success: false, message: "Produto não encontrado" });
    }

    const product = db.products[prodIdx];

    // Decrease category count
    const catIdx = db.categories.findIndex(c => c.name.toLowerCase() === product.category.toLowerCase());
    if (catIdx >= 0) {
      db.categories[catIdx].productCount = Math.max(0, db.categories[catIdx].productCount - 1);
    }

    // Filter out product
    db.products.splice(prodIdx, 1);

    // Filter empty categories
    db.categories = db.categories.filter(c => c.productCount > 0 || INITIAL_CATEGORIES.some(ic => ic.name.toLowerCase() === c.name.toLowerCase()));

    await saveDB(db);
    res.json({ success: true, db });
  });

  // API: Increment product view (public detail tracking)
  app.post("/api/products/:id/view", async (req, res) => {
    const db = await loadDB();
    const { id } = req.params;
    const prodIdx = db.products.findIndex(p => p.id === id);
    if (prodIdx >= 0) {
      db.products[prodIdx].views = (db.products[prodIdx].views || 0) + 1;
      await saveDB(db);
    }
    res.json({ success: true });
  });

  // API: Register a Customer
  app.post("/api/customers", async (req, res) => {
    const db = await loadDB();
    const customer = req.body;
    
    if (!customer || !customer.nome || !customer.cpf) {
      return res.status(400).json({ success: false, message: "Dados incompletos" });
    }

    if (!db.customers) {
      db.customers = [];
    }

    const newCustomer = {
      id: `cust-${Date.now()}`,
      nome: customer.nome,
      cpf: customer.cpf,
      telefone: customer.telefone || "",
      email: customer.email || "",
      cep: customer.cep || "",
      cidade: customer.cidade || "",
      estado: customer.estado || "",
      bairro: customer.bairro || "",
      rua: customer.rua || "",
      numero: customer.numero || "",
      registeredAt: new Date().toISOString()
    };

    db.customers.unshift(newCustomer);
    await saveDB(db);

    res.status(201).json({ success: true, customer: newCustomer, db });
  });

  // API: Update Customer
  app.put("/api/customers/:id", async (req, res) => {
    try {
      const db = await loadDB();
      const { id } = req.params;
      const updatedData = req.body;

      if (!db.customers) db.customers = [];

      const custIdx = db.customers.findIndex(c => c.id === id);
      if (custIdx === -1) {
        return res.status(404).json({ success: false, message: "Cliente não encontrado" });
      }

      db.customers[custIdx] = {
        ...db.customers[custIdx],
        ...updatedData,
        // Make sure we keep the original ID and registration date
        id,
        registeredAt: db.customers[custIdx].registeredAt || new Date().toISOString()
      };

      await saveDB(db);
      res.json({ success: true, db });
    } catch (err: any) {
      console.error("Error updating customer:", err);
      res.status(500).json({ success: false, message: err.message || "Erro ao atualizar cliente" });
    }
  });

  // API: Delete Customer
  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const db = await loadDB();
      const { id } = req.params;

      if (!db.customers) db.customers = [];

      const custIdx = db.customers.findIndex(c => c.id === id);
      if (custIdx === -1) {
        return res.status(404).json({ success: false, message: "Cliente não encontrado" });
      }

      db.customers.splice(custIdx, 1);
      await saveDB(db);
      res.json({ success: true, db });
    } catch (err: any) {
      console.error("Error deleting customer:", err);
      res.status(500).json({ success: false, message: err.message || "Erro ao excluir cliente" });
    }
  });

  // API: Smart PDF / Text Importation using Gemini AI
  app.post("/api/import-pdf", async (req, res) => {
    const { fileData, fileName, mimeType, appendToStock } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, message: "Nenhum dado de arquivo enviado." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "A chave de API do Gemini (GEMINI_API_KEY) não está configurada nos segredos do AI Studio. Configure-a no menu Configurações > Secrets para habilitar a importação inteligente real."
      });
    }

    try {
      // Lazy initialization of GoogleGenAI SDK to avoid module load crash
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      console.log(`Starting smart parse for file "${fileName}" (${mimeType})...`);

      // We'll instruct Gemini to parse the PDF base64 file data or textual data and return a JSON matching our schema
      const promptText = `
        Você é um assistente especialista em controle de estoque e catálogo de produtos de vestuário/moda profissional (scrubs, batas, toucas, calças).
        Analise o documento anexado (um arquivo de inventário de estoque) e extraia de forma extremamente precisa todos os produtos, suas categorias correspondentes, cores aproximadas e as quantidades para cada tamanho (P, M, G, GG, XG).

        Regras de Extração e Conversão:
        1. Identifique o Nome do Produto (ex: "Bata Princesa", "Calça Pala", "Touca Mônica").
        2. Identifique a Categoria de forma limpa e padronizada (ex: "Batas", "Calças", "Estampas", "Acessórios"). Se não estiver explícito, infira baseado no nome do produto.
        3. Identifique uma cor ideal correspondente em código hexadecimal (ex: rosa para Barbie = "#EC4899", azul autismo = "#1E3A8A", preto = "#111111"). Se não souber, use "#FF6B00" (laranja premium).
        4. Crie uma descrição elegante e de alto nível para o produto, destacando a qualidade (1 a 2 sentenças em português).
        5. Extraia as quantidades físicas por tamanho. Mapeie estritamente para as chaves "P", "M", "G", "GG" e "XG". Se um tamanho não estiver presente ou estiver zerado, defina como 0.

        Responda estritamente com um objeto JSON no formato abaixo, sem nenhum comentário ou Markdown adicional fora do bloco JSON:
        {
          "products": [
            {
              "name": "Nome do Produto",
              "category": "Nome da Categoria",
              "color": "#HEXCODE",
              "description": "Descrição profissional em português",
              "sizes": {
                "P": 5,
                "M": 10,
                "G": 8,
                "GG": 4,
                "XG": 1
              }
            }
          ]
        }
      `;

      // Build contents array for Gemini
      const contents: any[] = [];
      
      if (mimeType && fileData.includes(",")) {
        // base64 standard data URL, extract just the raw base64 data
        const base64Raw = fileData.split(",")[1];
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Raw
          }
        });
      } else {
        // assume raw base64 text or textual content
        contents.push({
          inlineData: {
            mimeType: mimeType || "application/pdf",
            data: fileData
          }
        });
      }

      contents.push({ text: promptText });

      // Run Gemini API calling
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              products: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Name of the product" },
                    category: { type: Type.STRING, description: "Category of the product" },
                    color: { type: Type.STRING, description: "Hex color code" },
                    description: { type: Type.STRING, description: "Short high-quality description" },
                    price: { type: Type.NUMBER, description: "Unit price of the product if found (e.g. 29.90), otherwise omit" },
                    sizes: {
                      type: Type.OBJECT,
                      properties: {
                        P: { type: Type.INTEGER },
                        M: { type: Type.INTEGER },
                        G: { type: Type.INTEGER },
                        GG: { type: Type.INTEGER },
                        XG: { type: Type.INTEGER }
                      },
                      required: ["P", "M", "G", "GG", "XG"]
                    }
                  },
                  required: ["name", "category", "sizes"]
                }
              }
            },
            required: ["products"]
          }
        }
      });

      const extractedText = response.text || "{}";
      const parsedData = JSON.parse(extractedText);

      if (!parsedData.products || !Array.isArray(parsedData.products)) {
        throw new Error("Formato de retorno inválido do modelo Gemini.");
      }

      const db = await loadDB();
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      let addedCount = 0;
      let updatedCount = 0;
      let newCategories: Set<string> = new Set();
      let detailsLog = `Relatório de Importação do arquivo: ${fileName}\nData: ${dateStr} às ${timeStr}\n\n`;

      for (const importedProd of parsedData.products) {
        const prodName = importedProd.name;
        const prodCat = importedProd.category || "Sem Categoria";
        const prodColor = importedProd.color || "#FF6B00";
        const prodDesc = importedProd.description || `Produto importado de ${fileName}`;
        const importedSizes: ProductSizes = {
          P: importedProd.sizes?.P || 0,
          M: importedProd.sizes?.M || 0,
          G: importedProd.sizes?.G || 0,
          GG: importedProd.sizes?.GG || 0,
          XG: importedProd.sizes?.XG || 0,
        };

        const existingProdIdx = db.products.findIndex(p => p.name.toLowerCase() === prodName.toLowerCase());

        if (existingProdIdx >= 0) {
          // Update existing product
          const oldProd = db.products[existingProdIdx];
          const mergedSizes = { ...oldProd.sizes };

          detailsLog += `🔄 Produto Atualizado: "${prodName}"\n`;

          Object.entries(importedSizes).forEach(([size, qty]) => {
            const oldQty = oldProd.sizes[size as keyof ProductSizes] || 0;
            let finalQty = qty;
            
            if (appendToStock) {
              finalQty = oldQty + qty;
            }

            const diff = finalQty - oldQty;
            mergedSizes[size as keyof ProductSizes] = finalQty;

            if (diff !== 0) {
              db.movements.unshift({
                id: `mov-${Date.now()}-${size}-${Math.random().toString(36).substr(2, 4)}`,
                productId: oldProd.id,
                productName: oldProd.name,
                user: "Importador IA",
                date: dateStr,
                time: timeStr,
                quantity: Math.abs(diff),
                size: size as keyof ProductSizes,
                type: diff > 0 ? "entrada" : "saída",
                notes: `Importação Inteligente do PDF (Anterior: ${oldQty}, Novo: ${finalQty})`
              });
              detailsLog += `   - Tam ${size}: ${oldQty} ➔ ${finalQty} (${diff > 0 ? '+' : ''}${diff})\n`;
            }
          });

          oldProd.sizes = mergedSizes;
          oldProd.totalStock = Object.values(mergedSizes).reduce((acc, curr) => acc + (curr || 0), 0);
          oldProd.color = prodColor;
          if (prodDesc) oldProd.description = prodDesc;
          if ((importedProd as any).price !== undefined && (importedProd as any).price !== null) {
            oldProd.price = Number((importedProd as any).price);
          }
          
          updatedCount++;
        } else {
          // Create new product
          const newId = `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          const totalStock = Object.values(importedSizes).reduce((acc, curr) => acc + (curr || 0), 0);

          const product: Product = {
            id: newId,
            name: prodName,
            category: prodCat,
            color: prodColor,
            description: prodDesc,
            mainImage: "default_product", // fallback style will handle visualization
            gallery: [],
            sizes: importedSizes,
            totalStock,
            createdAt: now.toISOString(),
            views: 0,
            price: (importedProd as any).price !== undefined && (importedProd as any).price !== null ? Number((importedProd as any).price) : undefined
          };

          db.products.push(product);
          detailsLog += `➕ Novo Produto Criado: "${prodName}" (Categoria: ${prodCat})\n`;

          // Record stock entry for all non-zero sizes
          Object.entries(importedSizes).forEach(([size, qty]) => {
            if (qty > 0) {
              db.movements.unshift({
                id: `mov-${Date.now()}-${size}-${Math.random().toString(36).substr(2, 4)}`,
                productId: product.id,
                productName: product.name,
                user: "Importador IA",
                date: dateStr,
                time: timeStr,
                quantity: qty,
                size: size as keyof ProductSizes,
                type: "entrada",
                notes: "Entrada de estoque inicial via Importação Inteligente de PDF"
              });
              detailsLog += `   - Tam ${size}: ${qty} unidades (Entrada)\n`;
            }
          });

          // Track new category
          const catExists = db.categories.some(c => c.name.toLowerCase() === prodCat.toLowerCase());
          if (!catExists) {
            newCategories.add(prodCat);
          }

          addedCount++;
        }
      }

      // Add new categories to db
      newCategories.forEach(catName => {
        db.categories.push({
          id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: catName,
          productCount: 0 // Will recalculate
        });
      });

      // Recalculate product counts for all categories
      db.categories.forEach(cat => {
        cat.productCount = db.products.filter(p => p.category.toLowerCase() === cat.name.toLowerCase()).length;
      });

      // Clean empty ones if they are not in original seeded categories
      db.categories = db.categories.filter(c => c.productCount > 0 || INITIAL_CATEGORIES.some(ic => ic.name.toLowerCase() === c.name.toLowerCase()));

      // Write import report
      const report: ImportReport = {
        id: `rep-${Date.now()}`,
        date: `${dateStr} ${timeStr}`,
        fileName: fileName || "estoque.pdf",
        status: "success",
        addedProductsCount: addedCount,
        updatedProductsCount: updatedCount,
        newCategoriesCount: newCategories.size,
        details: detailsLog + `\nResumo: ${addedCount} criados, ${updatedCount} atualizados, ${newCategories.size} novas categorias.`
      };

      db.importReports.unshift(report);
      await saveDB(db);

      res.json({
        success: true,
        report,
        db
      });

    } catch (e: any) {
      console.error("Error during smart import", e);
      const db = await loadDB();
      const now = new Date();
      const report: ImportReport = {
        id: `rep-${Date.now()}`,
        date: now.toLocaleString(),
        fileName: fileName || "estoque.pdf",
        status: "failed",
        addedProductsCount: 0,
        updatedProductsCount: 0,
        newCategoriesCount: 0,
        details: `Falha na importação: ${e.message || e}`
      };
      db.importReports.unshift(report);
      await saveDB(db);

      res.status(500).json({
        success: false,
        message: `Falha no processamento por Inteligência Artificial do arquivo: ${e.message || e}`,
        report
      });
    }
  });

  // Create HTTP Server
  const server = http.createServer(app);

  // Initialize WebSocket Server
  wss = new WebSocketServer({ server, path: "/ws-sync" });

  wss.on("connection", (ws) => {
    console.log("Real-time client connected via WebSocket");

    // Send current DB state on connection so client gets the absolute latest data immediately
    loadDB().then((db) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "init", db }));
      }
    }).catch(err => {
      console.error("Failed to load DB on WS connection:", err);
    });

    ws.on("close", () => {
      console.log("Real-time client disconnected");
    });
  });

  // Serve Vite app
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started and running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
