/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Grid,
  TrendingUp,
  Package,
  Layers,
  ArrowUpDown,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Maximize2,
  Eye,
  Settings,
  Bell,
  CheckCircle,
  AlertCircle,
  X,
  FileCode,
  UploadCloud,
  ChevronRight,
  Sun,
  Moon,
  Lock,
  User,
  LogOut,
  Sparkles,
  Info,
  BookOpen,
  Filter,
  Check,
  Percent,
  RefreshCw,
  ShoppingCart,
  Database,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Product, Category, Movement, ImportReport, DBState, ProductSizes, CartItem, CustomerRegistration } from "./types";
import { ClothesVisualizer } from "./components/ClothesVisualizer";
import { ProductCard } from "./components/ProductCard";
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_MOVEMENTS } from "./initialData";

// Formatting utility functions for registration inputs
const formatCep = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{5})(\d)/, "$1-$2")
    .substring(0, 9);
};

const formatCpf = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .substring(0, 14);
};

const formatPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .substring(0, 15);
};

const sanitizeSupabaseUrl = (url: string): string => {
  let cleaned = url.trim();
  // Remove any trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");
  // Remove trailing rest/v1 or rest/v1/ or anything similar if present
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, "");
  // Ensure the URL starts with http:// or https://
  if (cleaned && !cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }
  return cleaned;
};

const saveStateToLocalStorage = (state: DBState): boolean => {
  const key = "unistore_local_db";
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch (error: any) {
    console.warn("Storage quota exceeded or failed! Attempting to optimize state size...", error);
    
    // 1. Shallow copy and optimize / trim size
    const optimizedState: DBState = {
      products: state.products ? state.products.map(p => ({
        ...p,
        // Truncate large base64 strings if they exceed limits
        gallery: p.gallery ? p.gallery.map(img => img.startsWith("data:") && img.length > 50000 ? "data:image/jpeg;base64,...(imagem grande truncada)" : img) : [],
        mainImage: p.mainImage && p.mainImage.startsWith("data:") && p.mainImage.length > 100000 ? "data:image/jpeg;base64,...(imagem grande truncada)" : p.mainImage
      })) : [],
      categories: state.categories || [],
      // Keep only the last 100 movements to save significant quota
      movements: state.movements ? state.movements.slice(-100) : [],
      // Keep only the last 3 import reports and trim long details
      importReports: state.importReports ? state.importReports.slice(-3).map(r => ({
        ...r,
        details: r.details && r.details.length > 500 ? r.details.substring(0, 500) + "... (detalhes truncados para economizar espaço)" : r.details
      })) : [],
      customers: state.customers || []
    };

    try {
      localStorage.setItem(key, JSON.stringify(optimizedState));
      console.log("Successfully saved optimized state within storage quota limits.");
      return true;
    } catch (innerError: any) {
      console.error("Critical storage failure: Still exceeding quota even after state optimization.", innerError);
      
      // 2. Maximum compression fallback: completely clear heavy assets, movements and logs
      const minimalState: DBState = {
        products: (optimizedState.products || []).map(p => ({
          ...p,
          gallery: [],
          mainImage: p.mainImage && p.mainImage.startsWith("data:") ? "" : p.mainImage
        })),
        categories: optimizedState.categories || [],
        movements: (optimizedState.movements || []).slice(-20),
        importReports: [],
        customers: optimizedState.customers || []
      };

      try {
        localStorage.setItem(key, JSON.stringify(minimalState));
        console.log("Saved absolute minimal state to preserve core inventory values.");
        return true;
      } catch (lastError) {
        console.error("Local storage completely full, unable to write any data.", lastError);
        return false;
      }
    }
  }
};

const safeSaveUnistoreLocalDB = (state: DBState): void => {
  saveStateToLocalStorage(state);
};

export default function App() {
  // Theme and UI States
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<"catalog" | "dashboard" | "products-admin" | "stock-control" | "customers-admin">("catalog");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: "success" | "info" | "warning"; time: string }[]>([]);

  // Store Banner States
  const [storeBanner, setStoreBanner] = useState<string>(() => {
    return localStorage.getItem("unistore_banner") || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1920&auto=format&fit=crop";
  });

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setStoreBanner(base64);
        localStorage.setItem("unistore_banner", base64);
        triggerNotification("Banner da loja atualizado com sucesso!", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    isDangerous: false,
    confirmText: "Confirmar"
  });

  const askConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDangerous = false,
    confirmText = "Confirmar"
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      isDangerous,
      confirmText
    });
  };

  // Database States loaded from Server
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [importReports, setImportReports] = useState<ImportReport[]>([]);
  const [customers, setCustomers] = useState<CustomerRegistration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    online: boolean;
    error: string | null;
    config: { url: string; table: string; key: string } | null;
    sqlSetup: string;
  } | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [isApiUnavailable, setIsApiUnavailable] = useState<boolean>(false);
  
  // Client-side Supabase credentials for standalone Netlify sync (bypassing backend server)
  const [clientSupabaseUrl, setClientSupabaseUrl] = useState<string>(() => {
    const envUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
    return localStorage.getItem("client_supabase_url") || envUrl;
  });
  const [clientSupabaseKey, setClientSupabaseKey] = useState<string>(() => {
    const envKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";
    return localStorage.getItem("client_supabase_key") || envKey;
  });
  const [directCloudSyncEnabled, setDirectCloudSyncEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("direct_cloud_sync_enabled");
    if (stored !== null) {
      return stored === "true";
    }
    const envUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
    const envKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";
    return !!(envUrl && envKey);
  });

  // Search and Filter States for Public Catalog
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>("Todos");
  const [selectedAvailabilityFilter, setSelectedAvailabilityFilter] = useState<string>("Todos");
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>("Todas");

  // Detailed Modal for Product
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [zoomImage, setZoomImage] = useState<boolean>(false);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number>(0);

  // Shopping Cart States
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("orangesys_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCartModal, setShowCartModal] = useState<boolean>(false);
  const [selectedSizeForCart, setSelectedSizeForCart] = useState<keyof ProductSizes | "">("");
  const [selectedQtyForCart, setSelectedQtyForCart] = useState<number>(1);

  // Checkout & Customer Registration States (Optional for discount)
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState<boolean>(false);
  const [customerForm, setCustomerForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    cep: "",
    cidade: "",
    estado: "",
    bairro: "",
    rua: "",
    numero: ""
  });
  const [loadingCep, setLoadingCep] = useState<boolean>(false);

  // Admin: Product Creation / Editing State
  const [showProductFormModal, setShowProductFormModal] = useState<boolean>(false);
  const [showXlsxModal, setShowXlsxModal] = useState<boolean>(false);
  const [importingXlsx, setImportingXlsx] = useState<boolean>(false);
  const [xlsxFileError, setXlsxFileError] = useState<string | null>(null);
  const [xlsxPreviewRows, setXlsxPreviewRows] = useState<any[] | null>(null);
  const [xlsxImportResult, setXlsxImportResult] = useState<{ success: boolean; updatedCount: number; insertedCount: number } | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingProductId, setEditingProductId] = useState<string>("");
  const [productForm, setProductForm] = useState({
    name: "",
    category: "Fardamentos",
    color: "#111111",
    description: "",
    mainImage: "default_product",
    gallery: [] as string[],
    sizes: { P: 0, M: 0, G: 0, GG: 0, XG: 0 } as ProductSizes,
    price: "" as string | number
  });

  // Admin: Direct Stock Movement Modal State
  const [showStockMovementModal, setShowStockMovementModal] = useState<boolean>(false);
  const [movementForm, setMovementForm] = useState({
    productId: "",
    size: "M" as keyof ProductSizes,
    quantity: 1,
    type: "entrada" as "entrada" | "saída" | "ajuste",
    notes: "",
    user: "Administrador"
  });

  // Admin: Customer Editing State
  const [showCustomerFormModal, setShowCustomerFormModal] = useState<boolean>(false);
  const [customerFormMode, setCustomerFormMode] = useState<"create" | "edit">("edit");
  const [editingCustomerId, setEditingCustomerId] = useState<string>("");
  const [customerFormState, setCustomerFormState] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    cep: "",
    cidade: "",
    estado: "",
    bairro: "",
    rua: "",
    numero: ""
  });

  // AI Import State
  const [importing, setImporting] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [selectedSimulatedText, setSelectedSimulatedText] = useState<string>("");
  const [selectedImportReport, setSelectedImportReport] = useState<ImportReport | null>(null);
  const [appendToStock, setAppendToStock] = useState<boolean>(true);

  // Predefined Custom Text presets to simulate invoice or inventory PDF/text parsing
  const SAMPLE_INVOICE_TEXTS = [
    {
      title: "NF-e Lote 129 - Batas Princesa e Calças Elástico",
      fileName: "nfe_lote_129_vestuario.txt",
      content: `NOTA FISCAL ELETRÔNICA - DISTRIBUIDORA DE UNIFORMES PROFISSIONAIS
Destinatário: Catálogo Premium S/A. Data de Emissão: 02/07/2026.
PRODUTOS EM ENTRADA:
- ITEM 01: Bata Princesa na cor #FF5E8E (Rosa Princesa). Quantidades: P: 10, M: 15, G: 12, GG: 8, XG: 4.
Tecido gabardine premium respirável, ideal para médicas e esteticistas exigentes.
- ITEM 02: Calça Elástico na cor #111111 (Preto Absoluto). Quantidades: P: 20, M: 25, G: 20, GG: 10, XG: 5.
Calça profissional com cós de elástico confortável para plantões.`
    },
    {
      title: "Inventário Autismo e Odonto (Estampas Novas)",
      fileName: "inventario_estampas_novas.txt",
      content: `INVENTÁRIO DE PRODUÇÃO - CONTEXTO ESTAMPAS & ACESSÓRIOS
Lote gerado pela confecção central para catálogo:
- Touca Autismo Verde (Cor #10B981) - Novas unidades reguláveis em algodão: P: 15, M: 15. G: 0, GG: 0, XG: 0.
- Touca Autismo Azul Marinho (Cor #1E3A8A) - Novas unidades reguláveis com estampa puzzle: P: 10, M: 10, G: 10.
- Conjunto Odontologia (Cor #06B6D4) - Modelagem completa infantil divertida: P: 8, M: 8, G: 8, GG: 4, XG: 2.`
    },
    {
      title: "Lote de Lançamento: Bata Tulipa & Bata Bufante",
      fileName: "lancamento_novas_batas.txt",
      content: `RELATÓRIO DE ESTOQUE - FÁBRICA ESTILO & SAÚDE
Atualização de catálogo de batas premium:
- Bata Tulipa (Cor #1E3A8A - Azul Marinho): P: 12, M: 12, G: 10, GG: 8, XG: 4.
Modelagem transpassada com bolsos frontais de fácil acesso.
- Bata Bufante (Cor #A855F7 - Roxo Lavanda): P: 10, M: 10, G: 10, GG: 6, XG: 4.
Mangas bufantes românticas com elástico nos punhos.`
    }
  ];

  // Helper to trigger alert notifications
  const triggerNotification = (text: string, type: "success" | "info" | "warning" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setNotifications((prev) => [{ id, text, type, time: timeStr }, ...prev.slice(0, 4)]);

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 2000);
  };

  // Load Database State from Server API or fallback to localStorage
  const fetchDBState = async () => {
    try {
      setLoading(true);

      const hasEnvCredentials = !!((import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY);
      const storedDirectSync = localStorage.getItem("direct_cloud_sync_enabled") === "true" ||
        (localStorage.getItem("direct_cloud_sync_enabled") !== "false" && hasEnvCredentials);
      const storedUrl = localStorage.getItem("client_supabase_url") || (import.meta as any).env.VITE_SUPABASE_URL || "";
      const storedKey = localStorage.getItem("client_supabase_key") || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

      if (storedDirectSync && storedUrl && storedKey) {
        const cleanUrl = sanitizeSupabaseUrl(storedUrl);
        console.log("Direct client-to-cloud sync active. Fetching state directly from Supabase...", cleanUrl);
        try {
          const client = createClient(cleanUrl, storedKey.trim());
          const { data, error } = await client
            .from("app_state")
            .select("value")
            .eq("key", "inventory_db")
            .maybeSingle();

          if (error) throw error;

          if (data && data.value) {
            const fetched = data.value as DBState;
            setProducts(fetched.products || []);
            setCategories(fetched.categories || []);
            setMovements(fetched.movements || []);
            setImportReports(fetched.importReports || []);
            setCustomers(fetched.customers || []);

            safeSaveUnistoreLocalDB(fetched);
            
            setSupabaseStatus({
              online: true,
              error: null,
              config: { url: cleanUrl, table: "app_state", key: "inventory_db" },
              sqlSetup: `CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);`
            });
            setLoading(false);
            return;
          } else {
            console.warn("Direct Supabase table is empty or missing inventory_db key. Seeding database state...");
          }
        } catch (supErr: any) {
          console.warn("Direct Supabase fetch failed. Falling back to Local Storage/Server...", supErr);
        }
      }

      const res = await fetch("/api/db");
      
      if (res.status === 404) {
        setIsApiUnavailable(true);
        throw new Error("Servidor offline ou ambiente estático detectado (404)");
      }
      
      const contentType = res.headers.get("content-type");
      if (!res.ok || (contentType && contentType.includes("text/html"))) {
        throw new Error("Resposta inválida do servidor (HTML ou erro de rota)");
      }

      const data: DBState = await res.json();
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setMovements(data.movements || []);
      setImportReports(data.importReports || []);
      setCustomers(data.customers || []);

      // Cache state locally
      safeSaveUnistoreLocalDB(data);

      // Also load Supabase status
      try {
        const sRes = await fetch("/api/supabase-status");
        if (sRes.ok) {
          const sContentType = sRes.headers.get("content-type");
          if (sContentType && sContentType.includes("application/json")) {
            const sData = await sRes.json();
            setSupabaseStatus(sData);
          } else {
            setSupabaseStatus({
              online: false,
              error: "Status offline/estático",
              config: { url: "LocalStorage", table: "Nenhuma", key: "Local" },
              sqlSetup: `-- Servidor em modo de fallback local.`
            });
          }
        }
      } catch (err) {
        console.error("Error loading Supabase status", err);
      }
    } catch (e) {
      console.warn("Using offline localStorage fallback due to API load error:", e);
      
      let localData: DBState | null = null;
      try {
        const saved = localStorage.getItem("unistore_local_db");
        if (saved) {
          localData = JSON.parse(saved);
        }
      } catch (err) {
        console.error("Failed to parse localStorage cache", err);
      }

      if (!localData) {
        localData = {
          products: INITIAL_PRODUCTS,
          categories: INITIAL_CATEGORIES,
          movements: INITIAL_MOVEMENTS,
          importReports: [],
          customers: []
        };
      }

      setProducts(localData.products || []);
      setCategories(localData.categories || []);
      setMovements(localData.movements || []);
      setImportReports(localData.importReports || []);
      setCustomers(localData.customers || []);

      // Cache it back
      safeSaveUnistoreLocalDB(localData);

      // Mock offline status
      setSupabaseStatus({
        online: false,
        error: "Servidor offline ou deploy estático. Modo Local (LocalStorage) Ativo.",
        config: { url: "LocalStorage", table: "Local", key: "Local" },
        sqlSetup: `-- Servidor rodando em modo estático / offline.`
      });
    } finally {
      setLoading(false);
    }
  };

  // ================= SUPABASE CLIENT DIRECT SYNC HELPERS (FOR NETLIFY/STATIC) =================
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const saveClientDB = async (newState: DBState) => {
    // 1. Update all React states to keep UI fully in sync
    if (newState.products) setProducts(newState.products);
    if (newState.categories) setCategories(newState.categories);
    if (newState.movements) setMovements(newState.movements);
    if (newState.importReports) setImportReports(newState.importReports);
    if (newState.customers) setCustomers(newState.customers);

    // 2. Cache in localStorage
    safeSaveUnistoreLocalDB(newState);

    // 3. Sync to Supabase directly if enabled and configured
    const hasEnvCredentials = !!((import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY);
    const storedDirectSync = localStorage.getItem("direct_cloud_sync_enabled") === "true" ||
      (localStorage.getItem("direct_cloud_sync_enabled") !== "false" && hasEnvCredentials);
    const storedUrl = localStorage.getItem("client_supabase_url") || (import.meta as any).env.VITE_SUPABASE_URL || "";
    const storedKey = localStorage.getItem("client_supabase_key") || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

    if (storedDirectSync && storedUrl && storedKey) {
      try {
        const cleanUrl = sanitizeSupabaseUrl(storedUrl);
        const client = createClient(cleanUrl, storedKey.trim());
        const { error } = await client
          .from("app_state")
          .upsert({ key: "inventory_db", value: newState });
        
        if (error) {
          console.error("Erro ao salvar diretamente no Supabase:", error);
          triggerNotification("Aviso: Falha ao salvar na Nuvem (Supabase). Dados guardados localmente.", "warning");
        } else {
          console.log("Sincronizado diretamente com o Supabase com sucesso!");
        }
      } catch (err) {
        console.error("Erro na sincronização direta:", err);
      }
    }
  };

  const handleTestDirectSupabase = async () => {
    if (!clientSupabaseUrl || !clientSupabaseKey) {
      triggerNotification("Preencha a URL e a Chave Anon antes de testar.", "warning");
      return;
    }
    const cleanUrl = sanitizeSupabaseUrl(clientSupabaseUrl);
    setClientSupabaseUrl(cleanUrl);
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const client = createClient(cleanUrl, clientSupabaseKey.trim());
      const { data, error } = await client
        .from("app_state")
        .select("key")
        .eq("key", "test_connection_ping")
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist") || error.message.includes("not found")) {
          setConnectionTestResult({
            success: false,
            message: "Conexão com o Supabase estabelecida, mas a tabela 'app_state' não existe. Por favor, execute o script SQL ao lado no seu editor SQL do Supabase."
          });
        } else {
          throw error;
        }
      } else {
        setConnectionTestResult({
          success: true,
          message: "Conexão estabelecida com sucesso! A tabela 'app_state' está ativa e pronta."
        });
        triggerNotification("Conexão direta com Supabase bem sucedida!", "success");
      }
    } catch (err: any) {
      console.error("Test connection failed:", err);
      setConnectionTestResult({
        success: false,
        message: `Erro na conexão: ${err.message || JSON.stringify(err)}. Verifique a URL e a Chave.`
      });
      triggerNotification("Falha na conexão com Supabase.", "warning");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveDirectSupabaseConfig = async (mode: "pull" | "push") => {
    if (!clientSupabaseUrl || !clientSupabaseKey) {
      triggerNotification("Preencha as credenciais do Supabase.", "warning");
      return;
    }

    const cleanUrl = sanitizeSupabaseUrl(clientSupabaseUrl);
    setClientSupabaseUrl(cleanUrl);
    localStorage.setItem("client_supabase_url", cleanUrl);
    localStorage.setItem("client_supabase_key", clientSupabaseKey.trim());
    localStorage.setItem("direct_cloud_sync_enabled", "true");
    setDirectCloudSyncEnabled(true);

    setLoading(true);
    try {
      const client = createClient(cleanUrl, clientSupabaseKey.trim());
      
      if (mode === "pull") {
        const { data, error } = await client
          .from("app_state")
          .select("value")
          .eq("key", "inventory_db")
          .maybeSingle();

        if (error) throw error;

        if (data && data.value) {
          const fetched = data.value as DBState;
          setProducts(fetched.products || []);
          setCategories(fetched.categories || []);
          setMovements(fetched.movements || []);
          setImportReports(fetched.importReports || []);
          setCustomers(fetched.customers || []);
          safeSaveUnistoreLocalDB(fetched);
          triggerNotification("Dados importados da Nuvem (Pull) com sucesso!", "success");
        } else {
          triggerNotification("Nenhum dado encontrado na Nuvem para importar. Recomendamos usar o modo 'Enviar dados locais (Push)'.", "warning");
        }
      } else {
        const currentDB: DBState = {
          products,
          categories,
          movements,
          importReports,
          customers
        };
        const { error } = await client
          .from("app_state")
          .upsert({ key: "inventory_db", value: currentDB });

        if (error) throw error;

        triggerNotification("Dados locais enviados (Push) e sincronizados com a Nuvem com sucesso!", "success");
      }

      setSupabaseStatus({
        online: true,
        error: null,
        config: { url: cleanUrl, table: "app_state", key: "inventory_db" },
        sqlSetup: `CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);`
      });

    } catch (err: any) {
      console.error("Failed to sync on save:", err);
      triggerNotification(`Erro na sincronização inicial: ${err.message || err}`, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleDisableDirectSupabaseConfig = () => {
    localStorage.removeItem("direct_cloud_sync_enabled");
    setDirectCloudSyncEnabled(false);
    triggerNotification("Sincronização direta desativada. Voltando para modo Local/Servidor.", "info");
    fetchDBState();
  };

  useEffect(() => {
    fetchDBState();
  }, []);

  // Connect to Real-time WebSocket Server with Polling Fallback
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      if (isApiUnavailable) {
        console.log("WebSocket connection skipped because backend API is unavailable (static host/offline).");
        return;
      }
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws-sync`;
        console.log(`Connecting to real-time WebSocket server: ${wsUrl}`);
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log("Connected to real-time WebSocket sync server!");
          setIsWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "db_update" || message.type === "init") {
              const data = message.db;
              if (data) {
                console.log("Real-time DB synchronization update received:", data);
                
                // Keep UI perfectly synced in real-time
                setProducts(data.products || []);
                setCategories(data.categories || []);
                setMovements(data.movements || []);
                setImportReports(data.importReports || []);
                setCustomers(data.customers || []);
                
                // Cache local backup
                safeSaveUnistoreLocalDB(data);
              }
            }
          } catch (err) {
            console.warn("Soft-handled: Error parsing real-time message payload:", err);
          }
        };

        socket.onclose = () => {
          console.log("Real-time WebSocket disconnected, scheduling reconnect...");
          setIsWsConnected(false);
          reconnectTimeout = setTimeout(() => {
            connectWS();
          }, 8000); // 8s backoff
        };

        socket.onerror = (err) => {
          // Soft log to avoid triggering applet framework error alerts
          console.log("WebSocket status: Not connected directly. Polling fallback is fully handling synchronization.", err);
          setIsWsConnected(false);
          socket?.close();
        };
      } catch (err) {
        console.log("Failed to initialize real-time WebSocket connection, using polling instead:", err);
        setIsWsConnected(false);
      }
    };

    connectWS();

    return () => {
      if (socket) {
        socket.onclose = null; // Prevent reconnection trigger
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [isApiUnavailable]);

  // High-performance background polling fallback (only runs if WebSocket is disconnected or blocked by proxy)
  useEffect(() => {
    if (isWsConnected || isApiUnavailable) return;

    console.log("Starting silent background polling sync (running every 4 seconds as WebSocket backup)...");

    const pollDBState = async () => {
      try {
        const res = await fetch("/api/db");
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data: DBState = await res.json();
            
            // Keep state updated in background
            setProducts(data.products || []);
            setCategories(data.categories || []);
            setMovements(data.movements || []);
            setImportReports(data.importReports || []);
            setCustomers(data.customers || []);
            
            safeSaveUnistoreLocalDB(data);
          }
        }
      } catch (err) {
        console.warn("Silent background sync poll failed:", err);
      }
    };

    // Run immediately once
    pollDBState();

    const interval = setInterval(pollDBState, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [isWsConnected, isApiUnavailable]);

  // Sync Dark Mode state to local setting
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Authenticate using PIN
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "3259" || pinInput.toLowerCase() === "admin") {
      setIsAuthenticated(true);
      setShowLoginModal(false);
      setPinError("");
      setPinInput("");
      triggerNotification("Autenticação realizada com sucesso. Bem-vindo ao painel!", "success");
      setCurrentTab("dashboard");
    } else {
      setPinError("Código PIN incorreto. Tente novamente.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentTab("catalog");
    triggerNotification("Sessão administrativa encerrada.", "info");
  };

  // Sync Cart to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem("orangesys_cart", JSON.stringify(cart));
    } catch (e) {
      console.error("Erro ao salvar carrinho:", e);
    }
  }, [cart]);

  // Cart helper functions
  const addToCart = (product: Product, size: keyof ProductSizes, quantity: number) => {
    if (!size) {
      triggerNotification("Por favor, selecione um tamanho.", "warning");
      return;
    }
    const maxStock = product.sizes[size] || 0;
    if (maxStock <= 0) {
      triggerNotification("Este tamanho está esgotado.", "warning");
      return;
    }

    setCart(prev => {
      const itemId = `${product.id}-${size}`;
      const existingIndex = prev.findIndex(item => item.id === itemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex].quantity = Math.min(newQty, maxStock);
        return updated;
      } else {
        return [...prev, {
          id: itemId,
          product,
          size,
          quantity: Math.min(quantity, maxStock)
        }];
      }
    });

    triggerNotification(`${product.name} (${size}) adicionado ao carrinho!`, "success");
    setShowCartModal(true);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    triggerNotification("Item removido do carrinho.", "info");
  };

  const updateCartItemQty = (itemId: string, newQty: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const maxStock = item.product.sizes[item.size] || 0;
        const finalQty = Math.max(1, Math.min(newQty, maxStock));
        return { ...item, quantity: finalQty };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    triggerNotification("Carrinho esvaziado.", "info");
  };

  const getCartWhatsappLink = () => {
    if (cart.length === 0) return "#";
    
    let text = `*📋 NOVO PEDIDO - UNISTORE FARDAMENTOS*\n\n`;
    text += `Olá! Gostaria de encomendar os seguintes produtos:\n\n`;
    
    let totalItems = 0;
    let rawTotalPrice = 0;
    let hasPrices = false;

    cart.forEach((item, index) => {
      const itemPrice = item.product.price;
      const itemHasPrice = itemPrice !== undefined && itemPrice !== null;
      if (itemHasPrice) {
        hasPrices = true;
        rawTotalPrice += Number(itemPrice) * item.quantity;
      }

      text += `*${index + 1}. ${item.product.name}*\n`;
      text += `   • Tamanho: *${item.size}*\n`;
      text += `   • Quantidade: *${item.quantity}* un.\n`;
      if (itemHasPrice) {
        text += `   • Preço Unitário: *R$ ${Number(itemPrice).toFixed(2).replace(".", ",")}*\n`;
        text += `   • Subtotal: *R$ ${Number(Number(itemPrice) * item.quantity).toFixed(2).replace(".", ",")}*\n`;
      }
      text += `\n`;
      totalItems += item.quantity;
    });
    
    text += `*Total de Peças:* ${totalItems} un.\n`;

    if (hasPrices) {
      if (isRegisteringCustomer) {
        const discountValue = rawTotalPrice * 0.10;
        const finalPrice = rawTotalPrice - discountValue;
        text += `*Subtotal:* R$ ${rawTotalPrice.toFixed(2).replace(".", ",")}\n`;
        text += `*Desconto (10%):* -R$ ${discountValue.toFixed(2).replace(".", ",")}\n`;
        text += `*Total com Desconto:* R$ ${finalPrice.toFixed(2).replace(".", ",")}\n`;
      } else {
        text += `*Total:* R$ ${rawTotalPrice.toFixed(2).replace(".", ",")}\n`;
      }
    }

    if (isRegisteringCustomer) {
      text += `\n*🎁 CLIENTE CADASTRADO (GANHOU 10% DE DESCONTO NA 1ª COMPRA)*\n`;
      text += `   • Nome: ${customerForm.nome || "Não informado"}\n`;
      text += `   • CPF: ${customerForm.cpf || "Não informado"}\n`;
      text += `   • Telefone: ${customerForm.telefone || "Não informado"}\n`;
      text += `   • E-mail: ${customerForm.email || "Não informado"}\n`;
      text += `   • CEP: ${customerForm.cep || "Não informado"}\n`;
      text += `   • Endereço: ${customerForm.rua || ""}, Nº ${customerForm.numero || ""}\n`;
      text += `   • Bairro: ${customerForm.bairro || ""}\n`;
      text += `   • Cidade/UF: ${customerForm.cidade || ""}/${customerForm.estado || ""}\n\n`;
    } else {
      text += `\n*⚠️ Cliente finalizou sem cadastro (sem desconto)*\n\n`;
    }
    
    text += `*Enviado em:* ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n\n`;
    text += `Por favor, confirmem a disponibilidade das peças e os próximos passos para pagamento e entrega! Obrigado.`;
    
    return `https://wa.me/5585991781673?text=${encodeURIComponent(text)}`;
  };

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data.erro) {
          triggerNotification("CEP não encontrado.", "warning");
        } else {
          setCustomerForm(prev => ({
            ...prev,
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
            cep: cepValue
          }));
          triggerNotification("Endereço preenchido automaticamente!", "success");
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
        triggerNotification("Erro ao conectar com o serviço de busca de CEP.", "warning");
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleAdminCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data.erro) {
          triggerNotification("CEP não encontrado.", "warning");
        } else {
          setCustomerFormState(prev => ({
            ...prev,
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
            cep: cepValue
          }));
          triggerNotification("Endereço preenchido automaticamente!", "success");
        }
      } catch (err) {
        console.error("Erro ao buscar CEP (admin):", err);
        triggerNotification("Erro ao conectar com o serviço de busca de CEP.", "warning");
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Record details view increments
  const viewProductDetails = async (product: Product) => {
    setSelectedProductDetails(product);
    setSelectedGalleryIndex(0);
    
    // Set default selected size to the first available size that has stock
    const availableSizes = (["P", "M", "G", "GG", "XG"] as (keyof ProductSizes)[]).filter(
      size => (product.sizes[size] || 0) > 0
    );
    const defaultSize = availableSizes.length > 0 ? availableSizes[0] : "";
    setSelectedSizeForCart(defaultSize);
    setSelectedQtyForCart(1);

    // Silent update server-side for views count
    try {
      const updatedProducts = products.map(p => p.id === product.id ? { ...p, views: (p.views || 0) + 1 } : p);
      if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
        saveClientDB({
          products: updatedProducts,
          categories,
          movements,
          importReports,
          customers
        });
      } else {
        await fetch(`/api/products/${product.id}/view`, { method: "POST" });
        setProducts(updatedProducts);
      }
    } catch (e) {
      console.error(e);
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, views: (p.views || 0) + 1 } : p)
      );
    }
  };

  // Direct Product delete action
  const handleDeleteProduct = async (id: string, name: string) => {
    askConfirmation(
      "Excluir Produto",
      `Tem certeza que deseja excluir permanentemente o produto "${name}" do catálogo e do controle de estoque? Esta ação não pode ser desfeita!`,
      async () => {
        const getUpdatedDB = () => {
          const updatedProducts = products.filter(p => p.id !== id);
          const updatedCategories = categories.map(cat => ({
            ...cat,
            productCount: updatedProducts.filter(p => p.category.toLowerCase() === cat.name.toLowerCase()).length
          })).filter(c => c.productCount > 0 || INITIAL_CATEGORIES.some(ic => ic.name.toLowerCase() === c.name.toLowerCase()));

          const currentDB: DBState = {
            products: updatedProducts,
            categories: updatedCategories,
            movements: movements.filter(m => m.productId !== id),
            importReports,
            customers
          };
          return currentDB;
        };

        if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
          setLoading(true);
          try {
            const nextDB = getUpdatedDB();
            await saveClientDB(nextDB);
            triggerNotification(`Produto "${name}" removido com sucesso do Supabase.`, "success");
          } catch (err: any) {
            console.error("Direct delete failed", err);
            triggerNotification(`Erro na exclusão direta: ${err.message || err}`, "warning");
          } finally {
            setLoading(false);
          }
          return;
        }

        try {
          setLoading(true);
          const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
          
          const contentType = res.headers.get("content-type");
          if (!res.ok || (contentType && contentType.includes("text/html"))) {
            throw new Error("HTML response");
          }

          const data = await res.json();
          if (data.success) {
            await fetchDBState();
            triggerNotification(`Produto "${name}" removido com sucesso.`, "success");
          } else {
            triggerNotification(data.message || "Falha ao excluir o produto.", "warning");
          }
        } catch (e) {
          console.warn("Delete server failed, falling back to local delete:", e);
          
          const currentDB = getUpdatedDB();

          setProducts(currentDB.products);
          setCategories(currentDB.categories);
          setMovements(currentDB.movements);
          safeSaveUnistoreLocalDB(currentDB);

          triggerNotification(`Produto "${name}" removido com sucesso (Modo Local).`, "success");
        } finally {
          setLoading(false);
        }
      },
      true,
      "Excluir"
    );
  };

  // Direct Customer delete action
  const handleDeleteCustomer = async (id: string, name: string) => {
    askConfirmation(
      "Excluir Cliente",
      `Tem certeza que deseja excluir permanentemente o cadastro do cliente "${name}"? Esta ação não pode ser desfeita!`,
      async () => {
        const updatedCustomers = customers.filter(c => c.id !== id);

        const currentDB: DBState = {
          products,
          categories,
          movements,
          importReports,
          customers: updatedCustomers
        };

        if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
          setLoading(true);
          try {
            await saveClientDB(currentDB);
            triggerNotification(`Cliente "${name}" removido com sucesso do Supabase.`, "success");
          } catch (err: any) {
            console.error("Direct delete customer failed", err);
            triggerNotification(`Erro na exclusão direta: ${err.message || err}`, "warning");
          } finally {
            setLoading(false);
          }
          return;
        }

        try {
          setLoading(true);
          const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
          
          const contentType = res.headers.get("content-type");
          if (!res.ok || (contentType && contentType.includes("text/html"))) {
            throw new Error("HTML response");
          }

          const data = await res.json();
          if (data.success) {
            await fetchDBState();
            triggerNotification(`Cliente "${name}" removido com sucesso.`, "success");
          } else {
            triggerNotification(data.message || "Falha ao excluir o cliente.", "warning");
          }
        } catch (e) {
          console.warn("Delete customer server failed, falling back to local delete:", e);
          
          setCustomers(updatedCustomers);
          safeSaveUnistoreLocalDB(currentDB);
          triggerNotification(`Cliente "${name}" removido com sucesso (Modo Local).`, "success");
        } finally {
          setLoading(false);
        }
      },
      true,
      "Excluir"
    );
  };

  // Direct Customer save / update action
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerFormState.nome || !customerFormState.cpf) {
      triggerNotification("Nome e CPF são campos obrigatórios.", "warning");
      return;
    }

    try {
      setLoading(true);

      const url = `/api/customers/${editingCustomerId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerFormState),
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || (contentType && contentType.includes("text/html"))) {
        throw new Error("HTML response");
      }

      const data = await res.json();
      if (data.success) {
        setCustomers(data.db.customers || []);
        safeSaveUnistoreLocalDB(data.db);
        setShowCustomerFormModal(false);
        triggerNotification(`Cliente "${customerFormState.nome}" atualizado com sucesso!`, "success");
      } else {
        triggerNotification(data.message || "Falha ao salvar dados do cliente.", "warning");
      }
    } catch (err) {
      console.warn("Server save customer failed, falling back to local-only update:", err);

      const updatedCustomers = customers.map(c => 
        c.id === editingCustomerId 
          ? { ...c, ...customerFormState }
          : c
      );

      const currentDB: DBState = {
        products,
        categories,
        movements,
        importReports,
        customers: updatedCustomers
      };

      if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
        try {
          await saveClientDB(currentDB);
        } catch (syncErr: any) {
          console.error("Direct cloud sync edit customer failed", syncErr);
        }
      } else {
        setCustomers(updatedCustomers);
        safeSaveUnistoreLocalDB(currentDB);
      }

      setShowCustomerFormModal(false);
      triggerNotification(`Cliente "${customerFormState.nome}" atualizado com sucesso (Modo Local)!`, "success");
    } finally {
      setLoading(false);
    }
  };

  // Direct Delete All Products action
  const handleDeleteAllProducts = async () => {
    askConfirmation(
      "Excluir Todos os Produtos",
      "ATENÇÃO: Tem certeza que deseja excluir permanentemente TODOS os produtos cadastrados do catálogo? Esta ação apagará todo o estoque e não pode ser desfeita!",
      async () => {
        const getUpdatedDB = () => {
          const updatedCategories = categories.map(cat => ({ ...cat, productCount: 0 }));
          const currentDB: DBState = {
            products: [],
            categories: updatedCategories,
            movements: [],
            importReports,
            customers
          };
          return { currentDB, updatedCategories };
        };

        if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
          setLoading(true);
          try {
            const { currentDB } = getUpdatedDB();
            await saveClientDB(currentDB);
            triggerNotification("Todos os produtos foram removidos do Supabase com sucesso.", "success");
          } catch (err: any) {
            console.error("Direct delete all failed", err);
            triggerNotification(`Erro na exclusão direta geral: ${err.message || err}`, "warning");
          } finally {
            setLoading(false);
          }
          return;
        }

        try {
          setLoading(true);
          const res = await fetch("/api/products", { method: "DELETE" });

          const contentType = res.headers.get("content-type");
          if (!res.ok || (contentType && contentType.includes("text/html"))) {
            throw new Error("HTML response");
          }

          const data = await res.json();
          if (data.success) {
            await fetchDBState();
            triggerNotification("Todos os produtos foram removidos com sucesso.", "success");
          } else {
            triggerNotification(data.message || "Falha ao excluir todos os produtos.", "warning");
          }
        } catch (e) {
          console.warn("Delete all server failed, falling back to local:", e);

          const { currentDB, updatedCategories } = getUpdatedDB();

          setProducts([]);
          setCategories(updatedCategories);
          setMovements([]);
          safeSaveUnistoreLocalDB(currentDB);

          triggerNotification("Todos os produtos foram removidos com sucesso (Modo Local).", "success");
        } finally {
          setLoading(false);
        }
      },
      true,
      "Excluir Tudo"
    );
  };

  // Direct Database reset
  const handleResetDatabase = async () => {
    askConfirmation(
      "Redefinir Banco de Dados",
      "Deseja redefinir todo o banco de dados para os valores de demonstração iniciais? Suas importações e movimentações serão limpas.",
      async () => {
        const defaultDB: DBState = {
          products: INITIAL_PRODUCTS,
          categories: INITIAL_CATEGORIES,
          movements: INITIAL_MOVEMENTS,
          importReports: [],
          customers: []
        };

        if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
          setLoading(true);
          try {
            await saveClientDB(defaultDB);
            triggerNotification("Banco de dados do Supabase redefinido para os valores iniciais com sucesso.", "success");
          } catch (err: any) {
            console.error("Direct reset database failed", err);
            triggerNotification(`Erro na redefinição direta: ${err.message || err}`, "warning");
          } finally {
            setLoading(false);
          }
          return;
        }

        try {
          setLoading(true);
          const res = await fetch("/api/db/reset", { method: "POST" });

          const contentType = res.headers.get("content-type");
          if (!res.ok || (contentType && contentType.includes("text/html"))) {
            throw new Error("HTML response");
          }

          const data = await res.json();
          if (data.success) {
            setProducts(data.db.products);
            setCategories(data.db.categories);
            setMovements(data.db.movements);
            setImportReports(data.db.importReports);
            safeSaveUnistoreLocalDB(data.db);
            triggerNotification("Banco de dados restaurado com sucesso para os dados iniciais.", "success");
          }
        } catch (e) {
          console.warn("Reset database server failed, falling back to local:", e);

          setProducts(defaultDB.products);
          setCategories(defaultDB.categories);
          setMovements(defaultDB.movements);
          setImportReports([]);
          safeSaveUnistoreLocalDB(defaultDB);

          triggerNotification("Banco de dados restaurado com sucesso (Modo Armazenamento Local).", "success");
        } finally {
          setLoading(false);
        }
      },
      false,
      "Redefinir"
    );
  };

  // Create or Update Product Form Submission
  const handleProductFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.category) {
      triggerNotification("Nome e Categoria são obrigatórios.", "warning");
      return;
    }

    const getNextDBState = () => {
      const currentDB: DBState = {
        products: [...products],
        categories: [...categories],
        movements: [...movements],
        importReports: [...importReports],
        customers: [...customers]
      };

      if (formMode === "create") {
        const sizes = productForm.sizes || { P: 0, M: 0, G: 0, GG: 0, XG: 0 };
        const totalStock: number = Object.values(sizes).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0) as number;
        const newProd: Product = {
          id: `prod-${Date.now()}`,
          name: productForm.name,
          category: productForm.category || "Sem Categoria",
          color: productForm.color || "#FF6B00",
          description: productForm.description || "",
          mainImage: productForm.mainImage || "default_product",
          gallery: productForm.gallery || [],
          sizes,
          totalStock,
          createdAt: new Date().toISOString(),
          views: 0,
          price: productForm.price !== "" ? Number(productForm.price) : undefined
        };
        currentDB.products.push(newProd);

        const catIdx = currentDB.categories.findIndex(c => c.name.toLowerCase() === newProd.category.toLowerCase());
        if (catIdx >= 0) {
          currentDB.categories[catIdx].productCount += 1;
        } else {
          currentDB.categories.push({
            id: `cat-${Date.now()}`,
            name: newProd.category,
            productCount: 1
          });
        }

        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];
        Object.entries(sizes).forEach(([size, qty]) => {
          const qtyNum = Number(qty);
          if (qtyNum > 0) {
            currentDB.movements.unshift({
              id: `mov-${Date.now()}-${size}`,
              productId: newProd.id,
              productName: newProd.name,
              user: "Administrador",
              date: dateStr,
              time: timeStr,
              quantity: qtyNum,
              size: size as keyof ProductSizes,
              type: "entrada",
              notes: "Estoque inicial no cadastro do produto"
            });
          }
        });
      } else {
        const prodIdx = currentDB.products.findIndex(p => p.id === editingProductId);
        if (prodIdx >= 0) {
          const oldProd = currentDB.products[prodIdx];
          const newSizes = productForm.sizes || oldProd.sizes;
          const totalStock: number = Object.values(newSizes).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0) as number;

          currentDB.products[prodIdx] = {
            ...oldProd,
            name: productForm.name,
            category: productForm.category || oldProd.category,
            color: productForm.color || oldProd.color,
            description: productForm.description || oldProd.description,
            mainImage: productForm.mainImage || oldProd.mainImage,
            gallery: productForm.gallery || oldProd.gallery || [],
            sizes: newSizes,
            totalStock,
            price: productForm.price !== "" ? Number(productForm.price) : undefined
          };

          currentDB.categories.forEach(cat => {
            cat.productCount = currentDB.products.filter(p => p.category.toLowerCase() === cat.name.toLowerCase()).length;
          });
          currentDB.categories = currentDB.categories.filter(c => c.productCount > 0 || INITIAL_CATEGORIES.some(ic => ic.name.toLowerCase() === c.name.toLowerCase()));
        }
      }
      return currentDB;
    };

    if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
      setLoading(true);
      try {
        const nextState = getNextDBState();
        await saveClientDB(nextState);
        setShowProductFormModal(false);
        triggerNotification(
          formMode === "create" 
            ? `Produto "${productForm.name}" cadastrado com sucesso no Supabase!`
            : `Produto "${productForm.name}" atualizado com sucesso no Supabase!`,
          "success"
        );
      } catch (err: any) {
        console.error("Direct save failed", err);
        triggerNotification(`Erro de gravação direta: ${err.message || err}`, "warning");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const url = formMode === "create" ? "/api/products" : `/api/products/${editingProductId}`;
      const method = formMode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || (contentType && contentType.includes("text/html"))) {
        throw new Error("HTML response");
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.db.products);
        setCategories(data.db.categories);
        setMovements(data.db.movements);
        safeSaveUnistoreLocalDB(data.db);
        setShowProductFormModal(false);
        triggerNotification(
          formMode === "create" 
            ? `Produto "${productForm.name}" cadastrado com sucesso!`
            : `Produto "${productForm.name}" atualizado com sucesso!`,
          "success"
        );
      } else {
        triggerNotification(data.message || "Falha no salvamento do produto.", "warning");
      }
    } catch (err) {
      console.warn("Server save failed, falling back to local-only update:", err);

      const currentDB = getNextDBState();

      setProducts(currentDB.products);
      setCategories(currentDB.categories);
      setMovements(currentDB.movements);
      
      safeSaveUnistoreLocalDB(currentDB);
      setShowProductFormModal(false);

      triggerNotification(
        formMode === "create" 
          ? `Produto "${productForm.name}" cadastrado com sucesso (Modo Local)!`
          : `Produto "${productForm.name}" atualizado com sucesso (Modo Local)!`,
        "success"
      );
    }
  };

  // Open Edit Product Modal
  const openEditProductModal = (product: Product) => {
    setFormMode("edit");
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category,
      color: product.color,
      description: product.description,
      mainImage: product.mainImage,
      gallery: product.gallery || [],
      sizes: { ...product.sizes },
      price: product.price !== undefined ? product.price : ""
    });
    setShowProductFormModal(true);
  };

  // Open New Product Modal
  const openNewProductModal = () => {
    setFormMode("create");
    setProductForm({
      name: "",
      category: "Fardamentos",
      color: "#111111",
      description: "",
      mainImage: "default_product",
      gallery: [],
      sizes: { P: 0, M: 0, G: 0, GG: 0, XG: 0 },
      price: ""
    });
    setShowProductFormModal(true);
  };

  // Direct Stock Movement Submission
  const handleStockMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.productId) {
      triggerNotification("Selecione um produto para movimentar.", "warning");
      return;
    }

    const getNextDBState = () => {
      const currentDB: DBState = {
        products: [...products],
        categories: [...categories],
        movements: [...movements],
        importReports: [...importReports],
        customers: [...customers]
      };

      const prodIdx = currentDB.products.findIndex(p => p.id === movementForm.productId);
      if (prodIdx >= 0) {
        const product = { ...currentDB.products[prodIdx] };
        product.sizes = { ...product.sizes };
        const currentQty = product.sizes[movementForm.size] || 0;
        let newQty = currentQty;

        if (movementForm.type === "entrada") {
          newQty += movementForm.quantity;
        } else if (movementForm.type === "saída") {
          newQty = Math.max(0, currentQty - movementForm.quantity);
        } else { // ajuste
          newQty = Math.max(0, movementForm.quantity);
        }

        product.sizes[movementForm.size] = newQty;
        product.totalStock = Object.values(product.sizes).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0);

        currentDB.products[prodIdx] = product;

        // Record movement
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];

        currentDB.movements.unshift({
          id: `mov-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          user: "Administrador",
          date: dateStr,
          time: timeStr,
          quantity: movementForm.quantity,
          size: movementForm.size,
          type: movementForm.type,
          notes: movementForm.notes || "Movimentação manual"
        });
        return { currentDB, found: true };
      }
      return { currentDB, found: false };
    };

    if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
      setLoading(true);
      try {
        const { currentDB, found } = getNextDBState();
        if (found) {
          await saveClientDB(currentDB);
          setShowStockMovementModal(false);
          triggerNotification("Movimentação lançada diretamente no Supabase!", "success");
        } else {
          triggerNotification("Produto não encontrado para movimentação.", "warning");
        }
      } catch (err: any) {
        console.error("Direct stock movement failed", err);
        triggerNotification(`Erro de gravação direta: ${err.message || err}`, "warning");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movementForm)
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || (contentType && contentType.includes("text/html"))) {
        throw new Error("HTML response");
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.db.products);
        setMovements(data.db.movements);
        safeSaveUnistoreLocalDB(data.db);
        setShowStockMovementModal(false);
        triggerNotification(`Movimentação de estoque lançada com sucesso!`, "success");
      } else {
        triggerNotification(data.message || "Falha ao lançar movimentação.", "warning");
      }
    } catch (err) {
      console.warn("Stock movement server failed, falling back to local:", err);

      const { currentDB, found } = getNextDBState();
      if (found) {
        setProducts(currentDB.products);
        setMovements(currentDB.movements);
        safeSaveUnistoreLocalDB(currentDB);
        setShowStockMovementModal(false);
        triggerNotification("Movimentação lançada com sucesso (Modo Local)!", "success");
      } else {
        triggerNotification("Produto não encontrado para movimentação.", "warning");
      }
    }
  };

  // Helper to load SheetJS dynamically from CDN to prevent bundle/resolve issues during build
  const loadXLSX = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }
      let script = document.querySelector('script[src*="xlsx.full.min.js"]') as HTMLScriptElement;
      if (script) {
        script.addEventListener('load', () => resolve((window as any).XLSX));
        script.addEventListener('error', () => reject(new Error("Erro ao carregar a biblioteca de planilha de backup.")));
        return;
      }
      script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
      script.onload = () => {
        if ((window as any).XLSX) {
          resolve((window as any).XLSX);
        } else {
          reject(new Error("Biblioteca SheetJS carregada, mas objeto XLSX não encontrado."));
        }
      };
      script.onerror = () => {
        reject(new Error("Erro ao carregar a biblioteca de planilha. Verifique sua conexão com a internet."));
      };
      document.head.appendChild(script);
    });
  };

  // Spreadsheet / Excel Importer logic
  const handleImportXLSXFile = async (file: File) => {
    setImportingXlsx(true);
    setXlsxFileError(null);
    setXlsxImportResult(null);
    setXlsxPreviewRows(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSXLib = await loadXLSX();
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSXLib.read(data, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Let's read the sheet as raw array of arrays first to perform automatic header row detection
        const rawGrid: any[][] = XLSXLib.utils.sheet_to_json(ws, { header: 1 });
        if (!rawGrid || rawGrid.length === 0) {
          throw new Error("A planilha está vazia ou não pôde ser lida.");
        }

        // Auto Header Row Detection: Find the first row containing common headers or non-empty cells
        let headerRowIdx = -1;
        let headerKeys: string[] = [];
        
        // Triggers to identify where the actual data table starts (header row)
        const nameTriggers = ["nome", "name", "produto", "product", "título", "titulo", "designação", "descrição", "descricao", "código", "codigo", "referência", "referencia", "id"];

        for (let r = 0; r < Math.min(rawGrid.length, 25); r++) {
          const row = rawGrid[r];
          if (Array.isArray(row)) {
            const hasNameCol = row.some(cell => {
              if (cell === undefined || cell === null) return false;
              const s = String(cell).toLowerCase().trim();
              return nameTriggers.some(trigger => s === trigger || s.includes(trigger));
            });
            if (hasNameCol) {
              headerRowIdx = r;
              headerKeys = row.map(cell => cell !== undefined && cell !== null ? String(cell).trim() : "");
              break;
            }
          }
        }

        // Fallback: If no headers were detected, find first row that has at least 2 elements
        if (headerRowIdx === -1) {
          for (let r = 0; r < Math.min(rawGrid.length, 10); r++) {
            const row = rawGrid[r];
            if (Array.isArray(row) && row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "").length >= 2) {
              headerRowIdx = r;
              headerKeys = row.map(cell => cell !== undefined && cell !== null ? String(cell).trim() : "");
              break;
            }
          }
        }

        // Last fallback: use row 0
        if (headerRowIdx === -1) {
          headerRowIdx = 0;
          headerKeys = rawGrid[0] ? rawGrid[0].map(cell => cell !== undefined && cell !== null ? String(cell).trim() : "") : [];
        }

        // Map array of arrays into objects based on our dynamically-detected headers
        const rawRows: any[] = [];
        for (let r = headerRowIdx + 1; r < rawGrid.length; r++) {
          const row = rawGrid[r];
          if (!row || row.length === 0) continue;
          
          const hasContent = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
          if (!hasContent) continue;

          const rowObj: any = {};
          headerKeys.forEach((key, colIdx) => {
            if (key) {
              rowObj[key] = row[colIdx];
            } else {
              // fallback for columns without name: use Index
              rowObj[`__col_${colIdx}`] = row[colIdx];
            }
          });
          rawRows.push(rowObj);
        }

        if (rawRows.length === 0) {
          throw new Error("A planilha está vazia ou não possui linhas de dados abaixo do cabeçalho.");
        }

        // Helper to find column values based on flexible key names with multi-phase robust lookup
        const getValueByKeys = (row: any, keys: string[]) => {
          const searchKeys = keys.map(k => k.toLowerCase().trim());
          const rowKeys = Object.keys(row);
          
          // Phase 1: Exact case-insensitive match
          for (const searchKey of searchKeys) {
            const foundKey = rowKeys.find(
              (rk) => rk.toLowerCase().trim() === searchKey
            );
            if (foundKey !== undefined) {
              return row[foundKey];
            }
          }
          
          // Phase 2: Starts with / prefixed match (e.g., "nome" matches "Nome (Obrigatório)")
          for (const searchKey of searchKeys) {
            const foundKey = rowKeys.find(
              (rk) => {
                const normalizedRk = rk.toLowerCase().trim();
                return normalizedRk.startsWith(searchKey) || searchKey.startsWith(normalizedRk);
              }
            );
            if (foundKey !== undefined) {
              return row[foundKey];
            }
          }

          // Phase 3: Generic substring fallback match (e.g., "preço" matches "Preço (R$)")
          for (const searchKey of searchKeys) {
            const foundKey = rowKeys.find(
              (rk) => {
                const normalizedRk = rk.toLowerCase().trim();
                return normalizedRk.includes(searchKey) || searchKey.includes(normalizedRk);
              }
            );
            if (foundKey !== undefined) {
              return row[foundKey];
            }
          }

          return undefined;
        };

        const parsedProducts: any[] = [];

        rawRows.forEach((row, idx) => {
          // Robust name triggers including description fallback if they used descriptions for names
          const name = getValueByKeys(row, [
            "nome", "name", "produto", "product", "título", "titulo", "designação", 
            "descrição", "descricao", "desc", "modelo", "peça", "peca", "item", "artigo"
          ]);
          if (!name || String(name).trim() === "") {
            console.warn(`Linha ${idx + 1} ignorada: Nome do produto não encontrado.`);
            return;
          }

          const id = getValueByKeys(row, ["id", "código", "codigo", "referência", "referencia", "id do produto", "ref", "cod", "sku"]);
          const category = getValueByKeys(row, ["categoria", "category", "grupo", "seção", "secao", "tipo", "subgrupo"]) || "Fardamentos";
          const color = getValueByKeys(row, ["cor", "color", "hex", "tonalidade"]) || "#111111";
          const description = getValueByKeys(row, ["descricao", "descrição", "description", "detalhes", "observação", "observacao", "obs"]) || "";
          
          let priceVal = getValueByKeys(row, ["preco", "preço", "price", "valor", "custo", "venda"]);
          let priceNum: number | undefined = undefined;
          if (priceVal !== undefined && priceVal !== null && priceVal !== "") {
            if (typeof priceVal === "string") {
              const cleaned = priceVal.replace(/[R$\s]/gi, "").replace(",", ".");
              priceNum = parseFloat(cleaned);
            } else {
              priceNum = Number(priceVal);
            }
          }

          // Sizes mapping
          let sizeP = Number(getValueByKeys(row, ["p", "tam p", "tamanho p", "p_stock", "p_estoque", "quantidade p"])) || 0;
          let sizeM = Number(getValueByKeys(row, ["m", "tam m", "tamanho m", "m_stock", "m_estoque", "quantidade m"])) || 0;
          let sizeG = Number(getValueByKeys(row, ["g", "tam g", "tamanho g", "g_stock", "g_estoque", "quantidade g"])) || 0;
          let sizeGG = Number(getValueByKeys(row, ["gg", "tam gg", "tamanho gg", "gg_stock", "gg_estoque", "quantidade gg"])) || 0;
          let sizeXG = Number(getValueByKeys(row, ["xg", "tam xg", "tamanho xg", "xg_stock", "xg_estoque", "quantidade xg"])) || 0;

          // Smart Single General Stock Column Fallback: if all size columns are 0, check if there's a general stock value
          if (sizeP === 0 && sizeM === 0 && sizeG === 0 && sizeGG === 0 && sizeXG === 0) {
            const generalStock = Number(getValueByKeys(row, ["estoque", "quantidade", "qtd", "total", "saldo", "disponível", "disponivel", "stock", "quantity", "quant"])) || 0;
            if (generalStock > 0) {
              sizeM = generalStock; // assign all to size M
            }
          }

          parsedProducts.push({
            id: id ? String(id).trim() : undefined,
            name: String(name).trim(),
            category: String(category).trim(),
            color: String(color).trim(),
            description: String(description).trim(),
            price: priceNum !== undefined && !isNaN(priceNum) ? priceNum : undefined,
            sizes: {
              P: sizeP,
              M: sizeM,
              G: sizeG,
              GG: sizeGG,
              XG: sizeXG
            }
          });
        });

        if (parsedProducts.length === 0) {
          throw new Error("Nenhum produto válido encontrado na planilha. Verifique se a coluna com o Nome do Produto ou Código está preenchida.");
        }

        setXlsxPreviewRows(parsedProducts);

      } catch (err: any) {
        console.error("XLSX parsing failed:", err);
        setXlsxFileError(err.message || "Erro desconhecido ao processar planilha.");
        triggerNotification(`Falha ao ler planilha: ${err.message || err}`, "warning");
      } finally {
        setImportingXlsx(false);
      }
    };

    reader.onerror = () => {
      setXlsxFileError("Erro ao ler o arquivo selecionado.");
      setImportingXlsx(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const submitXlsxImport = async () => {
    if (!xlsxPreviewRows || xlsxPreviewRows.length === 0) return;
    
    setImportingXlsx(true);
    setXlsxFileError(null);

    // Dynamic fallback when server is unavailable / static hosting is detected (e.g., Netlify)
    if (isApiUnavailable) {
      try {
        const currentDB: DBState = {
          products: JSON.parse(JSON.stringify(products)),
          categories: JSON.parse(JSON.stringify(categories)),
          movements: JSON.parse(JSON.stringify(movements)),
          importReports: JSON.parse(JSON.stringify(importReports)),
          customers: JSON.parse(JSON.stringify(customers))
        };

        let updatedCount = 0;
        let insertedCount = 0;
        
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];

        for (const item of xlsxPreviewRows) {
          const sizes: ProductSizes = {
            P: item.sizes?.P !== undefined ? Number(item.sizes.P) : 0,
            M: item.sizes?.M !== undefined ? Number(item.sizes.M) : 0,
            G: item.sizes?.G !== undefined ? Number(item.sizes.G) : 0,
            GG: item.sizes?.GG !== undefined ? Number(item.sizes.GG) : 0,
            XG: item.sizes?.XG !== undefined ? Number(item.sizes.XG) : 0,
          };
          const totalStock = Object.values(sizes).reduce((acc, curr) => acc + (curr || 0), 0);

          // Find by ID first, or by name (case-insensitive)
          let existingProd = currentDB.products.find(p => p.id === item.id);
          if (!existingProd && item.name) {
            existingProd = currentDB.products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
          }

          if (existingProd) {
            // Record stock movements for difference
            const oldSizes = existingProd.sizes || { P: 0, M: 0, G: 0, GG: 0, XG: 0 };
            Object.entries(sizes).forEach(([size, qty]) => {
              const oldQty = oldSizes[size as keyof ProductSizes] || 0;
              const diff = qty - oldQty;
              if (diff !== 0) {
                currentDB.movements.unshift({
                  id: `mov-${Date.now()}-${existingProd!.id}-${size}-${Math.random().toString(36).substr(2, 4)}`,
                  productId: existingProd!.id,
                  productName: existingProd!.name,
                  user: "Administrador",
                  date: dateStr,
                  time: timeStr,
                  quantity: Math.abs(diff),
                  size: size as keyof ProductSizes,
                  type: diff > 0 ? "entrada" : "saída",
                  notes: `Ajuste de estoque via planilha XLSX (Modo Estático)`
                });
              }
            });

            // Update details
            existingProd.name = item.name || existingProd.name;
            existingProd.category = item.category || existingProd.category;
            if (item.color) existingProd.color = item.color;
            if (item.description !== undefined) existingProd.description = item.description;
            if (item.price !== undefined && item.price !== null) {
              existingProd.price = item.price === "" ? undefined : Number(item.price);
            }
            existingProd.sizes = sizes;
            existingProd.totalStock = totalStock;
            
            updatedCount++;
          } else {
            // Insert new
            const product: Product = {
              id: item.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name: item.name || "Novo Produto Planilha",
              category: item.category || "Sem Categoria",
              color: item.color || "#FF6B00",
              description: item.description || "",
              mainImage: item.mainImage || "default_product",
              gallery: item.gallery || [],
              sizes,
              totalStock,
              createdAt: now.toISOString(),
              views: 0,
              price: item.price !== undefined && item.price !== null && item.price !== "" ? Number(item.price) : undefined
            };

            currentDB.products.push(product);

            // Record initial movements for sizes > 0
            Object.entries(sizes).forEach(([size, qty]) => {
              if (qty > 0) {
                currentDB.movements.unshift({
                  id: `mov-${Date.now()}-${product.id}-${size}-${Math.random().toString(36).substr(2, 4)}`,
                  productId: product.id,
                  productName: product.name,
                  user: "Administrador",
                  date: dateStr,
                  time: timeStr,
                  quantity: qty,
                  size: size as keyof ProductSizes,
                  type: "entrada",
                  notes: "Estoque inicial cadastrado via planilha XLSX (Modo Estático)"
                });
              }
            });

            insertedCount++;
          }
        }

        // Recalculate category counts for all categories
        currentDB.categories.forEach(cat => {
          cat.productCount = currentDB.products.filter(p => p.category.toLowerCase() === cat.name.toLowerCase()).length;
        });

        // Add any new categories that are not currently in the list
        currentDB.products.forEach(p => {
          const catName = p.category || "Sem Categoria";
          const catExists = currentDB.categories.some(c => c.name.toLowerCase() === catName.toLowerCase());
          if (!catExists) {
            currentDB.categories.push({
              id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name: catName,
              productCount: currentDB.products.filter(prod => prod.category.toLowerCase() === catName.toLowerCase()).length
            });
          }
        });

        // Filter out empty categories unless they are part of initial categories
        currentDB.categories = currentDB.categories.filter(c => c.productCount > 0 || INITIAL_CATEGORIES.some(ic => ic.name.toLowerCase() === c.name.toLowerCase()));

        // Save DB client-side (Local Storage & Supabase direct sync)
        await saveClientDB(currentDB);

        setXlsxImportResult({
          success: true,
          updatedCount,
          insertedCount
        });
        
        triggerNotification(`Planilha importada localmente! ${insertedCount} criados, ${updatedCount} atualizados.`, "success");

      } catch (err: any) {
        console.error("Local XLSX import failed:", err);
        setXlsxFileError(err.message || "Erro ao processar produtos localmente.");
        triggerNotification(`Erro na gravação local: ${err.message || err}`, "warning");
      } finally {
        setImportingXlsx(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: xlsxPreviewRows })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro do servidor (${res.status}) ao importar produtos.`);
      }

      const resData = await res.json();
      
      if (resData.success && resData.db) {
        await saveClientDB(resData.db);
        setXlsxImportResult({
          success: true,
          updatedCount: resData.updatedCount,
          insertedCount: resData.insertedCount
        });
        triggerNotification(`Planilha importada! ${resData.insertedCount} criados, ${resData.updatedCount} atualizados.`, "success");
      } else {
        throw new Error("O servidor não retornou o estado do banco de dados atualizado.");
      }
    } catch (err: any) {
      console.error("XLSX import submit failed:", err);
      setXlsxFileError(err.message || "Erro ao salvar os produtos no banco de dados.");
      triggerNotification(`Erro na gravação: ${err.message || err}`, "warning");
    } finally {
      setImportingXlsx(false);
    }
  };

  const downloadXlsxTemplate = async () => {
    try {
      const XLSXLib = await loadXLSX();
      const data = [
        {
          "ID (Preencher apenas se for atualizar produto existente)": "prod-exemplo-1",
          "Nome (Obrigatório)": "Bata Princesa Oxford Branca",
          "Categoria": "Fardamentos",
          "Preço (R$)": 89.90,
          "Cor (Hex ou Nome)": "#ffffff",
          "Descrição": "Bata de alta modelagem ideal para fardamento de recepção e escritórios.",
          "P": 10,
          "M": 15,
          "G": 8,
          "GG": 5,
          "XG": 2
        },
        {
          "ID (Preencher apenas se for atualizar produto existente)": "",
          "Nome (Obrigatório)": "Scrub Masculino Oxford Marinho",
          "Categoria": "Scrubs",
          "Preço (R$)": 120.00,
          "Cor (Hex ou Nome)": "#0b2240",
          "Descrição": "Pijama cirúrgico premium em tecido Oxford respirável e resistente.",
          "P": 5,
          "M": 10,
          "G": 12,
          "GG": 4,
          "XG": 1
        }
      ];

      const worksheet = XLSXLib.utils.json_to_sheet(data);
      const workbook = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(workbook, worksheet, "Produtos");
      
      XLSXLib.writeFile(workbook, "modelo_importacao_produtos.xlsx");
    } catch (err: any) {
      triggerNotification("Falha ao gerar o modelo de planilha. Verifique sua conexão.", "warning");
      console.error(err);
    }
  };

  // Initialize direct stock movement fast action from dashboard/product list
  const openFastStockMovement = (productId: string, initialSize: keyof ProductSizes = "M") => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setMovementForm({
        productId,
        size: initialSize,
        quantity: 5,
        type: "entrada",
        notes: `Entrada rápida de estoque de ${prod.name}`,
        user: "Administrador"
      });
      setShowStockMovementModal(true);
    }
  };

  // Custom File Uploader & Parser with base64 conversion
  const handleFileUpload = async (file: File) => {
    setImporting(true);
    triggerNotification(`Processando arquivo "${file.name}" por IA...`, "info");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = e.target?.result as string;
      try {
        const res = await fetch("/api/import-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData,
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            appendToStock
          })
        });

        const data = await res.json();
        if (data.success) {
          if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
            await saveClientDB(data.db);
          } else {
            setProducts(data.db.products);
            setCategories(data.db.categories);
            setMovements(data.db.movements);
            setImportReports(data.db.importReports);
            safeSaveUnistoreLocalDB(data.db);
          }
          setSelectedImportReport(data.report);
          triggerNotification(`Importação concluída! ${data.report.addedProductsCount} criados, ${data.report.updatedProductsCount} atualizados.`, "success");
        } else {
          triggerNotification(data.message || "Erro no processamento da IA.", "warning");
        }
      } catch (err: any) {
        console.error(err);
        triggerNotification(`Erro de conexão com o processador de IA: ${err.message || err}`, "warning");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Trigger Intelligent Import from Preset Simulated Data
  const handleImportSimulatedText = async () => {
    if (!selectedSimulatedText) {
      triggerNotification("Por favor, selecione um modelo de texto para simular.", "warning");
      return;
    }

    const preset = SAMPLE_INVOICE_TEXTS.find(p => p.content === selectedSimulatedText);
    if (!preset) return;

    setImporting(true);
    triggerNotification(`Lançando processamento inteligente via IA Gemini para "${preset.title}"...`, "info");

    try {
      // Pass the text content in base64 to avoid formatting issues
      const base64Text = "data:text/plain;base64," + btoa(unescape(encodeURIComponent(selectedSimulatedText)));

      const res = await fetch("/api/import-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Text,
          fileName: preset.fileName,
          mimeType: "text/plain",
          appendToStock
        })
      });

      const data = await res.json();
      if (data.success) {
        if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
          await saveClientDB(data.db);
        } else {
          setProducts(data.db.products);
          setCategories(data.db.categories);
          setMovements(data.db.movements);
          setImportReports(data.db.importReports);
          safeSaveUnistoreLocalDB(data.db);
        }
        setSelectedImportReport(data.report);
        triggerNotification(`Sincronização por IA com sucesso! ${data.report.addedProductsCount} novos produtos catalogados, ${data.report.updatedProductsCount} estoques atualizados.`, "success");
      } else {
        triggerNotification(data.message || "Erro no processamento da IA.", "warning");
      }
    } catch (err: any) {
      console.error(err);
      triggerNotification(`Erro de conexão: ${err.message || err}`, "warning");
    } finally {
      setImporting(false);
    }
  };

  // Drag & Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Custom User Photo Base64 File Reader for Product Form Creator
  const handleProductFormImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        // Set main image or add to gallery
        setProductForm(prev => ({
          ...prev,
          mainImage: base64,
          gallery: [...prev.gallery, base64].slice(0, 5) // max 5 images
        }));
        triggerNotification(`Foto "${file.name}" carregada e otimizada para WebP comprimido.`, "info");
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter products dynamically for Public Catalog / Grid
  const filteredProducts = products.filter((product) => {
    const pName = product.name || "";
    const pCategory = product.category || "";
    const pDescription = product.description || "";
    const pColor = product.color || "";

    const matchesSearch =
      pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pDescription.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "Todas" || pCategory.toLowerCase() === selectedCategory.toLowerCase();

    const matchesSize =
      selectedSizeFilter === "Todos" || (product.sizes?.[selectedSizeFilter as keyof ProductSizes] || 0) > 0;

    const matchesAvailability =
      selectedAvailabilityFilter === "Todos" ||
      (selectedAvailabilityFilter === "Em Estoque" && product.totalStock > 0) ||
      (selectedAvailabilityFilter === "Baixo Estoque" && product.totalStock > 0 && product.totalStock < 10) ||
      (selectedAvailabilityFilter === "Esgotado" && product.totalStock === 0);

    const matchesColor =
      selectedColorFilter === "Todas" || pColor.toLowerCase() === selectedColorFilter.toLowerCase();

    return matchesSearch && matchesCategory && matchesSize && matchesAvailability && matchesColor;
  });

  // Extract unique colors available to show as quick color filters
  const uniqueColors = Array.from(new Set(products.map((p) => p.color))).filter(Boolean);

  // Computed Dashboard Metrics
  const totalStockQuantity = products.reduce((acc, p) => acc + (p.totalStock || 0), 0);
  const lowStockCount = products.filter(p => p.totalStock > 0 && p.totalStock < 10).length;
  const outOfStockCount = products.filter(p => p.totalStock === 0).length;

  // Prepare Recharts Chart Data: Products by Category
  const categoryChartData = categories.map((cat) => {
    const catName = cat.name || "";
    return {
      name: catName,
      quantidade: products.filter(p => (p.category || "").toLowerCase() === catName.toLowerCase()).length,
      unidades: products.filter(p => (p.category || "").toLowerCase() === catName.toLowerCase()).reduce((acc, p) => acc + (p.totalStock || 0), 0)
    };
  }).filter(c => c.quantidade > 0);

  // Prepare Recharts Chart Data: Recent Stock Movements
  const recentMovementsData = movements
    .slice(0, 10)
    .reverse()
    .map((mov) => ({
      name: `${mov.date.slice(5)} ${mov.time.slice(0, 5)}`,
      quantidade: mov.quantity,
      tipo: mov.type === "entrada" ? "Entrada" : mov.type === "saída" ? "Saída" : "Ajuste"
    }));

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-200 ${darkMode ? "dark bg-neutral-950 text-white" : "bg-neutral-50 text-neutral-900"}`}>
      
      {/* Dynamic Floating In-App Notifications Stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md ${
                notif.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : notif.type === "warning"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-neutral-800/90 border-neutral-700 text-white"
              }`}
            >
              <div className="mt-0.5">
                {notif.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">{notif.text}</p>
                <span className="text-[10px] opacity-60 font-mono mt-1 block">{notif.time}</span>
              </div>
              <button onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))} className="text-neutral-400 hover:text-neutral-200">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex h-screen overflow-hidden">
        
        {/* Backdrop overlay for mobile sidebar drawer */}
        <AnimatePresence>
          {isAuthenticated && sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs z-35 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Collapsible Sidebar for Desktop & Adaptive Side Draw for Mobile */}
        {isAuthenticated && (
          <aside
            className={`shrink-0 bg-neutral-950 text-white flex flex-col transition-all duration-300 border-r border-neutral-900 
              fixed md:relative inset-y-0 left-0 z-40 h-full
              ${sidebarOpen ? "w-64 translate-x-0" : "w-16 -translate-x-full md:translate-x-0"}`}
          >
          {/* Sidebar Brand Header */}
          <div className="p-6 flex items-center justify-between border-b border-neutral-900">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 shrink-0 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-md shadow-orange-600/30">
                U
              </div>
              {sidebarOpen && (
                <span className="text-lg font-bold tracking-tight">
                  UniStore <span className="text-orange-500">Fardamentos</span>
                </span>
              )}
            </div>
            {sidebarOpen && (
              <span className="text-[9px] font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                v2.0
              </span>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
            <p className={`px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-widest ${!sidebarOpen && "sr-only"}`}>
              Geral
            </p>
            <button
              onClick={() => {
                setCurrentTab("catalog");
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                currentTab === "catalog"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900"
              }`}
            >
              <Grid size={18} />
              {sidebarOpen && <span>Catálogo Público</span>}
            </button>

            {isAuthenticated && (
              <>
                <div className="pt-6 border-t border-neutral-900 mt-6">
                  <p className={`px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-widest ${!sidebarOpen && "sr-only"}`}>
                    Administração
                  </p>
                </div>

                <button
                  onClick={() => {
                    setCurrentTab("dashboard");
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    currentTab === "dashboard"
                      ? "bg-neutral-900 text-white border border-neutral-800"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <TrendingUp size={18} className="text-orange-500" />
                  {sidebarOpen && <span>Dashboard Métrica</span>}
                </button>

                <button
                  onClick={() => {
                    setCurrentTab("products-admin");
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    currentTab === "products-admin"
                      ? "bg-neutral-900 text-white border border-neutral-800"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <Package size={18} className="text-orange-500" />
                  {sidebarOpen && <span>Gerenciar Itens</span>}
                </button>

                <button
                  onClick={() => {
                    setCurrentTab("stock-control");
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    currentTab === "stock-control"
                      ? "bg-neutral-900 text-white border border-neutral-800"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <ArrowUpDown size={18} className="text-orange-500" />
                  {sidebarOpen && <span>Movimentações</span>}
                </button>

                <button
                  onClick={() => {
                    setCurrentTab("customers-admin");
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    currentTab === "customers-admin"
                      ? "bg-neutral-900 text-white border border-neutral-800"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <User size={18} className="text-orange-500" />
                  {sidebarOpen && <span>Clientes Cadastrados</span>}
                </button>
              </>
            )}
          </nav>

          {/* Sidebar Footer Account Details */}
          <div className="p-4 border-t border-neutral-900">
            {isAuthenticated && (
              <div className="flex items-center justify-between">
                {sidebarOpen && (
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-orange-500 border border-neutral-700 font-bold">
                      A
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold leading-none text-neutral-200">Administrador</p>
                      <span className="text-[10px] text-neutral-500 font-medium">Fábrica S/A</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                  title="Sair do modo Administrador"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

        {/* Main Workspace Frame */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-neutral-950 transition-colors">
          
          {/* Premium Top Navbar */}
          <header className="h-16 shrink-0 border-b border-neutral-100 dark:border-neutral-900 px-6 flex items-center justify-between bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10">
            
            {/* Left Header content */}
            <div className="flex items-center gap-4">
              {/* Mobile brand / menu toggler */}
              {isAuthenticated && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 flex items-center justify-center cursor-pointer"
                  title="Alternar menu lateral"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}

              <div className={`flex items-center gap-2 ${isAuthenticated ? "md:hidden" : ""}`}>
                <div className="w-7 h-7 bg-orange-600 rounded flex items-center justify-center font-bold text-sm text-white">
                  U
                </div>
                <span className="text-sm font-extrabold tracking-tight dark:text-white">
                  UniStore <span className="text-orange-500">Fardamentos</span>
                </span>
              </div>

              {/* Breadcrumb Indicator */}
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest hidden sm:inline-block">
                / {currentTab === "catalog" ? "Catálogo Público" : currentTab === "dashboard" ? "Dashboard" : currentTab === "products-admin" ? "Produtos" : currentTab === "stock-control" ? "Estoque" : "Importador"}
              </span>
            </div>

            {/* Quick Actions / Search / Theme switcher */}
            <div className="flex items-center gap-3">

              {/* Shopping Cart Button */}
              <button
                onClick={() => setShowCartModal(true)}
                className="relative p-2 rounded-xl text-neutral-500 hover:text-orange-600 dark:text-neutral-400 dark:hover:text-orange-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-all cursor-pointer"
                aria-label="Ver Carrinho"
              >
                <ShoppingCart size={18} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-white dark:border-neutral-950 shadow-sm">
                    {cart.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                )}
              </button>

              {/* Admin switch / indicator */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 border border-emerald-500/15">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Painel Ativo
                  </span>
                  <button
                    onClick={handleLogout}
                    className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-900 hover:bg-red-500/10 text-neutral-500 hover:text-red-500 transition-colors"
                    title="Sair do Painel"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          {/* Main Tab Area - Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full w-full flex flex-col items-center justify-center p-8">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-neutral-400 mt-4">Carregando catálogo e dados de estoque...</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                
                {/* 1. PUBLIC PRODUCT CATALOG VIEW */}
                {currentTab === "catalog" && (
                  <motion.div
                    key="catalog-tab"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full"
                  >
                    {/* Immersive Store Banner (Sem Descrição Comercial Overlay) */}
                    <div className="relative overflow-hidden rounded-3xl h-44 sm:h-64 md:h-72 lg:h-80 w-full shadow-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 group">
                      <img
                        src={storeBanner}
                        alt="Banner da Loja"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.01]"
                      />
                      
                      {/* Admin interactive banner upload overlay */}
                      {isAuthenticated ? (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                          <label className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-lg flex items-center gap-2 transition-all">
                            <UploadCloud size={14} />
                            ALTERAR IMAGEM DO BANNER
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleBannerUpload}
                            />
                          </label>
                          {storeBanner !== "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1920&auto=format&fit=crop" && (
                            <button
                              onClick={() => {
                                const defaultImg = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1920&auto=format&fit=crop";
                                setStoreBanner(defaultImg);
                                localStorage.setItem("unistore_banner", defaultImg);
                                triggerNotification("Banner restaurado para o padrão.", "info");
                              }}
                              className="bg-neutral-900/80 hover:bg-neutral-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-lg flex items-center gap-2 transition-all border border-neutral-700"
                            >
                              RESTAURAR PADRÃO
                            </button>
                          )}
                          <p className="text-[10px] text-neutral-300 font-semibold bg-neutral-950/80 px-2 py-1 rounded-md">Resolução recomendada: 1920x450</p>
                        </div>
                      ) : (
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[10px] font-bold text-white px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {totalStockQuantity} peças em estoque
                        </div>
                      )}
                    </div>

                    {/* Interactive Filter Toolbar & Search */}
                    <div className="bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-3xl border border-neutral-200/85 dark:border-neutral-800/80 shadow-sm">
                      <div className="max-w-xl mx-auto text-center space-y-4">
                        <h3 className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest flex items-center justify-center gap-2">
                          <Search size={14} className="text-orange-500" /> Encontre seu Vestuário
                        </h3>
                        
                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nome, cor, detalhes do modelo..."
                            className="w-full bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900/60 dark:focus:bg-neutral-950 border border-neutral-250 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-2xl py-3.5 pl-12 pr-11 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-orange-500/10 text-neutral-900 dark:text-white transition-all shadow-sm"
                          />
                          <Search className="w-5 h-5 text-neutral-400 absolute left-4.5 top-3.5" />
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm("")}
                              className="absolute right-4 top-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Exibindo <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{filteredProducts.length}</span> de <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{products.length}</span> produtos no catálogo em tempo real
                        </p>
                      </div>
                    </div>

                    {/* Products Grid Section */}
                    {filteredProducts.length === 0 ? (
                      <div className="bg-neutral-50 dark:bg-neutral-900/40 p-12 text-center rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
                        <Package size={40} className="mx-auto text-neutral-400 mb-3" />
                        <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">Nenhum produto correspondente</h3>
                        <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                          Não encontramos nenhum produto com os filtros atuais ou termo buscado. Tente expandir sua pesquisa ou remover alguns filtros aplicados.
                        </p>
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setSelectedCategory("Todas");
                            setSelectedSizeFilter("Todos");
                            setSelectedAvailabilityFilter("Todos");
                            setSelectedColorFilter("Todas");
                          }}
                          className="mt-4 inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                        >
                          Mostrar Todos os Itens
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onViewProduct={viewProductDetails}
                            isAuthenticated={isAuthenticated}
                            onEdit={openEditProductModal}
                            onDelete={handleDeleteProduct}
                          />
                        ))}
                      </div>
                    )}

                  </motion.div>
                )}

                {/* 2. ADMINISTRATIVE DASHBOARD WORKSPACE */}
                {currentTab === "dashboard" && isAuthenticated && (
                  <motion.div
                    key="dashboard-tab"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full"
                  >
                    
                    {/* Bento Grid Header Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Products Count */}
                      <div className="bg-white p-5 rounded-2xl border border-neutral-200/60">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Package size={12} /> Itens Cadastrados
                        </p>
                        <h3 className="text-2xl font-extrabold mt-1 text-neutral-800">{products.length}</h3>
                      </div>

                      {/* Total Stock units */}
                      <div className="bg-white p-5 rounded-2xl border border-neutral-200/60">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                          <ArrowUpDown size={12} /> Total Estoque
                        </p>
                        <h3 className="text-2xl font-extrabold mt-1 text-neutral-800">{totalStockQuantity}</h3>
                      </div>

                      {/* Out of Stock units */}
                      <div className="bg-white p-5 rounded-2xl border border-neutral-200/60">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertCircle size={12} className="text-red-500" /> Sem Estoque
                        </p>
                        <h3 className="text-2xl font-extrabold mt-1 text-red-600">{outOfStockCount}</h3>
                      </div>

                      {/* Low Stock counts */}
                      <div className="bg-white p-5 rounded-2xl border border-neutral-200/60">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Info size={12} className="text-amber-500" /> Estoque Baixo
                        </p>
                        <h3 className="text-2xl font-extrabold mt-1 text-amber-600">{lowStockCount}</h3>
                      </div>

                    </div>

                    {/* Chart Layout row using Recharts */}
                    <div className="grid grid-cols-1 gap-6">

                      {/* Right Chart: Stock Movements trend */}
                      <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800/50 shadow-sm space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wider">Tendência de Movimentações</h4>
                          <p className="text-xs text-neutral-400">Fluxo cronológico de entradas e saídas de produtos</p>
                        </div>
                        {recentMovementsData.length === 0 ? (
                          <div className="h-64 flex items-center justify-center text-xs text-neutral-400">Sem histórico disponível</div>
                        ) : (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={recentMovementsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#333" : "#f0f0f0"} />
                                <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} />
                                <YAxis stroke="#888" fontSize={10} tickLine={false} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: darkMode ? "#111" : "#fff",
                                    borderColor: darkMode ? "#333" : "#eee",
                                    color: darkMode ? "#fff" : "#000",
                                    borderRadius: "8px"
                                  }}
                                />
                                <Line type="monotone" dataKey="quantidade" stroke="#FF6B00" strokeWidth={2.5} name="Qtd Movimentada" activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Bottom Split Row: Most Viewed Products vs Latest Additions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Left: Most accessed products */}
                      <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                          <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                            <Eye size={14} className="text-neutral-500" /> Produtos Mais Acessados
                          </h4>
                          <span className="text-[10px] text-neutral-400">Por visualizações</span>
                        </div>

                        <div className="divide-y divide-neutral-100">
                          {products
                            .slice()
                            .sort((a, b) => (b.views || 0) - (a.views || 0))
                            .slice(0, 5)
                            .map((p, idx) => (
                              <div key={p.id} className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono font-bold text-neutral-400">
                                    #{idx + 1}
                                  </span>
                                  <div>
                                    <h5 className="text-xs font-bold text-neutral-800">{p.name}</h5>
                                    <p className="text-[10px] text-neutral-400">{p.category}</p>
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                  <span className="text-xs font-bold text-neutral-600">{p.totalStock} un.</span>
                                  <span className="text-[10px] text-neutral-400 font-medium">
                                    {p.views || 0} views
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Right: Latest dynamic stock entries or logs */}
                      <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                          <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                            <ArrowUpDown size={14} className="text-neutral-500" /> Últimas Movimentações
                          </h4>
                          <button onClick={() => setCurrentTab("stock-control")} className="text-xs text-neutral-500 hover:text-neutral-800 font-bold transition-colors">
                            Ver Tudo
                          </button>
                        </div>

                        <div className="divide-y divide-neutral-100">
                          {movements.slice(0, 5).map((mov) => (
                            <div key={mov.id} className="flex items-center justify-between py-2.5 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold uppercase ${
                                    mov.type === "entrada"
                                      ? "text-emerald-600"
                                      : mov.type === "saída"
                                      ? "text-red-500"
                                      : "text-amber-500"
                                  }`}>
                                    {mov.type}
                                  </span>
                                  <span className="font-semibold text-neutral-800">{mov.productName}</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Tamanho: <span className="font-bold">{mov.size}</span> | Obs: {mov.notes}</p>
                              </div>
                              <div className="text-right">
                                <span className={`font-bold ${mov.type === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                                  {mov.type === "entrada" ? "+" : "-"}{mov.quantity}
                                </span>
                                <p className="text-[9px] text-neutral-400 font-mono mt-0.5">{mov.date} {mov.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Supabase Database Integration Status and Control */}
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 space-y-5 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                            <Database size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                              Banco de Dados Cloud & Sincronização Unificada
                            </h4>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              Sua empresa conectada. Todos os celulares e computadores acessam o mesmo estoque em tempo real.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${supabaseStatus?.online ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                          <span className={`text-xs font-bold ${supabaseStatus?.online ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                            {supabaseStatus?.online ? "Nuvem Conectada" : "Modo Local Ativo"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Status Item 1 */}
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Servidor de Aplicação</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`h-2 w-2 rounded-full ${isApiUnavailable ? "bg-amber-500" : "bg-emerald-500"}`} />
                            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 font-mono">
                              {isApiUnavailable ? "Offline (Estático/Netlify)" : "Online & Ativo"}
                            </span>
                          </div>
                        </div>

                        {/* Status Item 2 */}
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Banco Supabase Cloud</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`h-2 w-2 rounded-full ${supabaseStatus?.online ? "bg-emerald-500" : "bg-amber-500"}`} />
                            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 font-mono">
                              {supabaseStatus?.online ? "Conexão Segura" : "Erro / Tabela Ausente"}
                            </span>
                          </div>
                        </div>

                        {/* Status Item 3 */}
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Tempo Real (Live Update)</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`h-2 w-2 rounded-full ${isWsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 font-mono">
                              {isWsConnected ? "WebSockets Ativo" : (isApiUnavailable ? "Desativado em Estático" : "Polling de Back-up")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Explicit Error Help UI if Supabase table is missing */}
                      {supabaseStatus && !supabaseStatus.online && (
                        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-900/40 space-y-3">
                          <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-400">
                            <AlertCircle className="shrink-0 mt-0.5" size={16} />
                            <div className="space-y-1">
                              <h5 className="text-xs font-bold font-sans">Aviso de Configuração do Banco de Dados Cloud (Supabase)</h5>
                              <p className="text-[11px] leading-relaxed opacity-90 font-sans">
                                {supabaseStatus.error?.includes("schema cache") || supabaseStatus.error?.includes("app_state") || supabaseStatus.error?.includes("not found") ? (
                                  <>
                                    A conexão com o Supabase está configurada, mas a tabela <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded text-[10px] font-mono font-bold">app_state</code> não foi encontrada.
                                    Crie a tabela para sincronizar todos os aparelhos na nuvem automaticamente.
                                  </>
                                ) : (
                                  <>
                                    Ocorreu um erro ao conectar-se ou salvar dados na nuvem: <span className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded break-all font-bold">{supabaseStatus.error}</span>. O aplicativo continuará funcionando perfeitamente em modo local.
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {supabaseStatus.sqlSetup && (
                            <div className="space-y-2 pt-1">
                              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 font-sans uppercase tracking-wider">Execute este comando SQL no editor do Supabase:</p>
                              <div className="relative">
                                <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-[10px] font-mono overflow-x-auto border border-neutral-800 leading-normal max-h-40">
                                  {supabaseStatus.sqlSetup}
                                </pre>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(supabaseStatus.sqlSetup);
                                    triggerNotification("Código SQL copiado!", "success");
                                  }}
                                  className="absolute right-2 top-2 px-2 py-1 text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition-all cursor-pointer"
                                >
                                  Copiar SQL
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Precisa atualizar ou corrigir dados no aparelho?</h5>
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            Se algum celular antigo estiver exibindo dados desalinhados ou guardados no cache do navegador, clique ao lado para limpar e puxar a nuvem limpa.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2.5 shrink-0">
                          <button
                            onClick={() => {
                              // Force clean cache of this specific device
                              localStorage.removeItem("unistore_local_db");
                              localStorage.removeItem("direct_cloud_sync_enabled");
                              localStorage.removeItem("client_supabase_url");
                              localStorage.removeItem("client_supabase_key");
                              setDirectCloudSyncEnabled(false);
                              setClientSupabaseUrl("");
                              setClientSupabaseKey("");
                              triggerNotification("Cache limpo! Recarregando dados frescos do Supabase Cloud...", "success");
                              fetchDBState();
                            }}
                            className="px-4 py-2.5 text-xs font-bold bg-neutral-800 dark:bg-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-300 text-white dark:text-neutral-900 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            <RefreshCw size={13} />
                            Limpar Cache & Sincronizar Nuvem
                          </button>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* 3. GERENCIAR ITENS / ADMIN CADASTRO & EDIT PANEL */}
                {currentTab === "products-admin" && isAuthenticated && (
                  <motion.div
                    key="products-admin-tab"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full"
                  >
                    
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-[#111111] dark:text-white tracking-tight">Gerenciamento de Produtos</h2>
                        <p className="text-xs text-neutral-500">Cadastre novos vestuários, edite tamanhos, fotos, cores e estoque inicial.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {products.length > 0 && (
                          <button
                            onClick={handleDeleteAllProducts}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                          >
                            <Trash2 size={16} /> EXCLUIR TODOS OS PRODUTOS
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setXlsxFileError(null);
                            setXlsxImportResult(null);
                            setShowXlsxModal(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                        >
                          <FileSpreadsheet size={16} /> IMPORTAR PLANILHA (XLSX)
                        </button>
                        <button
                          onClick={openNewProductModal}
                          className="bg-[#111111] dark:bg-orange-600 hover:bg-neutral-800 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                        >
                          <Plus size={16} /> NOVO PRODUTO
                        </button>
                      </div>
                    </div>

                    {/* Simple search filters specifically for administration */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Pesquisar por nome de produto..."
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 hover:border-orange-500 dark:border-neutral-700 dark:hover:border-orange-500 focus:border-orange-500 dark:focus:border-orange-500 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-orange-500/20 text-neutral-900 dark:text-white transition-all shadow-sm"
                        />
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                      </div>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 border border-neutral-300 hover:border-orange-500 dark:border-neutral-700 dark:hover:border-orange-500 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer text-neutral-800 dark:text-neutral-200 focus:outline-none transition-all shadow-sm"
                      >
                        <option value="Todas" className="bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">Todas as Categorias</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name} className="bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">{c.name}</option>
                        ))}
                      </select>
                      <select
                        value={selectedAvailabilityFilter}
                        onChange={(e) => setSelectedAvailabilityFilter(e.target.value)}
                        className="bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 border border-neutral-300 hover:border-orange-500 dark:border-neutral-700 dark:hover:border-orange-500 focus:ring-4 focus:ring-orange-500/20 rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer text-neutral-800 dark:text-neutral-200 focus:outline-none transition-all shadow-sm"
                      >
                        <option value="Todos" className="bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">Status de Estoque</option>
                        <option value="Em Estoque" className="bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">Em Estoque</option>
                        <option value="Baixo Estoque" className="bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">Estoque Baixo (&lt;10 total)</option>
                        <option value="Esgotado" className="bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">Esgotado</option>
                      </select>
                    </div>

                    {/* Table View of products for rapid admin management */}
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800/80 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider">
                              <th className="p-4">Visual</th>
                              <th className="p-4">Nome</th>
                              <th className="p-4">Categoria</th>
                              <th className="p-4">Cor Principal</th>
                              <th className="p-4 text-center">Quantidades por Tamanho</th>
                              <th className="p-4 text-center">Total Estoque</th>
                              <th className="p-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {filteredProducts.map((p) => (
                              <tr key={p.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/40 transition-colors">
                                <td className="p-4">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-200/60">
                                    <ClothesVisualizer category={p.category} color={p.color} className="p-1 max-h-full" />
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="font-bold text-neutral-800 dark:text-neutral-200 block">{p.name}</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">ID: {p.id}</span>
                                </td>
                                <td className="p-4">
                                  <span className="bg-neutral-100 dark:bg-neutral-800 font-semibold px-2 py-1 rounded">
                                    {p.category}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full border border-neutral-300" style={{ backgroundColor: p.color }} />
                                    <span className="font-mono text-[10px]">{p.color}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {Object.entries(p.sizes).map(([sz, qty]) => {
                                      const numQty = qty as number;
                                      return (
                                        <span
                                          key={sz}
                                          className={`px-1.5 py-1 rounded-lg text-[10px] font-bold flex flex-col items-center min-w-[32px] border transition-colors ${
                                            numQty > 0
                                              ? "bg-orange-50 text-orange-700 border-orange-100"
                                              : "bg-neutral-50 text-neutral-300 border-neutral-100 opacity-30"
                                          }`}
                                        >
                                          <span className={`text-[8px] font-semibold uppercase ${numQty > 0 ? "text-orange-500/80" : "text-neutral-400"}`}>{sz}</span>
                                          <span className="font-extrabold">{numQty}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                                    p.totalStock === 0
                                      ? "text-red-600 bg-red-50 border border-red-100"
                                      : p.totalStock < 10
                                      ? "text-orange-600 bg-orange-50 border border-orange-100"
                                      : "text-emerald-600 bg-emerald-50 border border-emerald-100"
                                  }`}>
                                    {p.totalStock} peças
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => openFastStockMovement(p.id)}
                                      className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all cursor-pointer"
                                      title="Lançamento Rápido de Movimentação"
                                    >
                                      <ArrowUpDown size={14} />
                                    </button>
                                    <button
                                      onClick={() => openEditProductModal(p)}
                                      className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 transition-all cursor-pointer"
                                      title="Editar Produto"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(p.id, p.name)}
                                      className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                                      title="Excluir Produto"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {filteredProducts.length === 0 && (
                        <div className="p-8 text-center text-neutral-400">Nenhum produto cadastrado com esses critérios.</div>
                      )}
                    </div>

                  </motion.div>
                )}

                {/* 4. CONTROLE DE ESTOQUE / LOGS DE MOVIMENTAÇÃO */}
                {currentTab === "stock-control" && isAuthenticated && (
                  <motion.div
                    key="stock-control-tab"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-[#111111] dark:text-white tracking-tight">Histórico de Movimentações</h2>
                        <p className="text-xs text-neutral-500">Histórico completo e detalhado de todas as entradas, saídas e ajustes manuais do sistema.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (products.length > 0) {
                            setMovementForm({
                              productId: products[0].id,
                              size: "M",
                              quantity: 1,
                              type: "entrada",
                              notes: "",
                              user: "Administrador"
                            });
                            setShowStockMovementModal(true);
                          } else {
                            triggerNotification("Cadastre ao menos um produto antes.", "warning");
                          }
                        }}
                        className="bg-[#111111] dark:bg-orange-600 hover:bg-neutral-800 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Plus size={14} /> NOVA MOVIMENTAÇÃO MANUAL
                      </button>
                    </div>

                    {/* Log table */}
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800/80 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider">
                              <th className="p-4">Operador/User</th>
                              <th className="p-4">Produto</th>
                              <th className="p-4">Data &amp; Hora</th>
                              <th className="p-4 text-center">Tamanho</th>
                              <th className="p-4 text-center">Tipo</th>
                              <th className="p-4 text-center">Quantidade</th>
                              <th className="p-4">Observações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {movements.map((mov) => (
                              <tr key={mov.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/40 transition-colors">
                                <td className="p-4 font-semibold text-neutral-800 dark:text-neutral-200">
                                  {mov.user}
                                </td>
                                <td className="p-4">
                                  <span className="font-bold text-neutral-800 dark:text-neutral-100 block">{mov.productName}</span>
                                  <span className="text-[9px] text-neutral-400 font-mono">Prod ID: {mov.productId}</span>
                                </td>
                                <td className="p-4">
                                  <span className="block font-medium">{mov.date}</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">{mov.time}</span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className="text-xs font-bold text-neutral-600">
                                    {mov.size}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    mov.type === "entrada"
                                      ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                                      : mov.type === "saída"
                                      ? "text-red-600 bg-red-50 border-red-100"
                                      : "text-amber-600 bg-amber-50 border-amber-100"
                                  }`}>
                                    {mov.type}
                                  </span>
                                </td>
                                <td className="p-4 text-center font-extrabold text-sm">
                                  <span className={mov.type === "entrada" ? "text-emerald-600" : mov.type === "saída" ? "text-red-500" : "text-amber-500"}>
                                    {mov.type === "entrada" ? "+" : mov.type === "saída" ? "-" : ""}{mov.quantity}
                                  </span>
                                </td>
                                <td className="p-4 text-neutral-500 dark:text-neutral-300">
                                  {mov.notes}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {movements.length === 0 && (
                        <div className="p-8 text-center text-neutral-400">Nenhuma movimentação de estoque registrada.</div>
                      )}
                    </div>

                  </motion.div>
                )}

                {/* 6. ADMINISTRATIVE CUSTOMERS VIEW */}
                {currentTab === "customers-admin" && isAuthenticated && (
                  <motion.div
                    key="customers-admin-tab"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 bg-orange-600/10 text-orange-600 dark:bg-orange-600/20 dark:text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-orange-500/20">
                          <User size={10} /> Administração de Cadastros
                        </span>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight mt-1">
                          Clientes Cadastrados (Desconto)
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Consulte os clientes que se cadastraram no fluxo de finalização do carrinho para obter desconto de fábrica.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800/80 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 font-bold uppercase tracking-wider text-[9px] border-b border-neutral-100 dark:border-neutral-900">
                              <th className="p-4 pl-6">Nome / Data</th>
                              <th className="p-4">Contato / Email</th>
                              <th className="p-4">CPF</th>
                              <th className="p-4">Endereço de Entrega</th>
                              <th className="p-4 pr-6 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                            {customers.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-12 text-center text-neutral-400">
                                  <div className="max-w-xs mx-auto space-y-2">
                                    <User size={24} className="mx-auto opacity-40 text-orange-500" />
                                    <h4 className="font-bold text-neutral-700 dark:text-neutral-300">Nenhum cliente cadastrado</h4>
                                    <p className="text-[11px] leading-relaxed">
                                      Os dados dos clientes aparecerão aqui assim que realizarem o cadastro no fechamento do carrinho.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              customers.map((cust) => (
                                <tr key={cust.id || cust.cpf} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition-colors">
                                  <td className="p-4 pl-6 space-y-1">
                                    <div className="font-bold text-neutral-800 dark:text-neutral-200">{cust.nome}</div>
                                    <div className="text-[10px] text-neutral-400 font-mono">
                                      {cust.registeredAt ? new Date(cust.registeredAt).toLocaleString("pt-BR") : "N/A"}
                                    </div>
                                  </td>
                                  <td className="p-4 space-y-1">
                                    <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                                      {cust.telefone || "Sem telefone"}
                                    </div>
                                    <div className="text-[10px] text-neutral-400">{cust.email || "Sem e-mail"}</div>
                                  </td>
                                  <td className="p-4 font-mono text-neutral-600 dark:text-neutral-400">
                                    {cust.cpf || "Não informado"}
                                  </td>
                                  <td className="p-4 space-y-1 max-w-xs">
                                    <div className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                                      {cust.rua}, {cust.numero} {cust.bairro && ` - ${cust.bairro}`}
                                    </div>
                                    <div className="text-[10px] text-neutral-400">
                                      CEP: {cust.cep} | {cust.cidade} - {cust.estado}
                                    </div>
                                  </td>
                                  <td className="p-4 pr-6 text-right space-x-1.5 whitespace-nowrap">
                                    <button
                                      onClick={() => {
                                        setEditingCustomerId(cust.id);
                                        setCustomerFormMode("edit");
                                        setCustomerFormState({
                                          nome: cust.nome || "",
                                          cpf: cust.cpf || "",
                                          telefone: cust.telefone || "",
                                          email: cust.email || "",
                                          cep: cust.cep || "",
                                          cidade: cust.cidade || "",
                                          estado: cust.estado || "",
                                          bairro: cust.bairro || "",
                                          rua: cust.rua || "",
                                          numero: cust.numero || ""
                                        });
                                        setShowCustomerFormModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg hover:underline transition-all"
                                      title="Editar dados do cliente"
                                    >
                                      <Edit2 size={10} />
                                      Editar
                                    </button>

                                    <button
                                      onClick={() => handleDeleteCustomer(cust.id, cust.nome)}
                                      className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-lg hover:underline transition-all"
                                      title="Excluir cliente"
                                    >
                                      <Trash2 size={10} />
                                      Excluir
                                    </button>

                                    {cust.telefone && (
                                      <a
                                        href={`https://wa.me/${cust.telefone.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg hover:underline"
                                      >
                                        WhatsApp
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            )}
          </div>

          {/* Premium layout Footer */}
          <footer className="shrink-0 p-4 bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-900 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Informações de sistema removidas */}
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-[#111111] dark:text-neutral-300 uppercase tracking-tighter">
              <a href="#" className="hover:text-orange-500">Ajuda</a>
              <a href="#" className="hover:text-orange-500">Privacidade</a>
            </div>
          </footer>

          {/* Mobile Bottom Navigation Bar (App-like layout for smartphones) */}
          {isAuthenticated && (
            <div className="md:hidden shrink-0 h-16 bg-neutral-950 border-t border-neutral-900 flex items-center justify-around text-white px-2">
              <button
                onClick={() => setCurrentTab("catalog")}
                className={`flex flex-col items-center gap-1 text-center transition-colors ${currentTab === "catalog" ? "text-orange-500" : "text-neutral-400"}`}
              >
                <Grid size={20} />
                <span className="text-[9px] font-semibold">Catálogo</span>
              </button>
              
              <button
                onClick={() => setCurrentTab("dashboard")}
                className={`flex flex-col items-center gap-1 text-center transition-colors ${currentTab === "dashboard" ? "text-orange-500" : "text-neutral-400"}`}
              >
                <TrendingUp size={20} />
                <span className="text-[9px] font-semibold">Painel</span>
              </button>
              
              <button
                onClick={() => setCurrentTab("products-admin")}
                className={`flex flex-col items-center gap-1 text-center transition-colors ${currentTab === "products-admin" ? "text-orange-500" : "text-neutral-400"}`}
              >
                <Package size={20} />
                <span className="text-[9px] font-semibold">Itens</span>
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ==================== ALL MODALS ==================== */}

      {/* MODAL 1: CHAVE PIN / ADMIN ACCESS MODAL */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-100 dark:border-neutral-850 relative"
            >
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setPinInput("");
                  setPinError("");
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center mx-auto mb-2">
                  <Lock size={20} />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Acesso Administrativo</h3>
                <p className="text-xs text-neutral-500">
                  Insira o código PIN de administrador para acessar o dashboard de controle de estoque.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Código PIN / Senha</label>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-3 text-center text-lg font-black tracking-widest focus:outline-none focus:ring-4 focus:ring-orange-500/25 transition-all text-neutral-900 dark:text-white"
                    autoFocus
                  />
                  {pinError && (
                    <p className="text-xs text-red-500 mt-2 text-center font-medium">{pinError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer transition-colors"
                >
                  AUTENTICAR
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: DETALHES COMPLETOS DO PRODUTO (PUBLIC VIEW) */}
      <AnimatePresence>
        {selectedProductDetails && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-neutral-100 dark:border-neutral-800 relative my-8"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setSelectedProductDetails(null);
                  setZoomImage(false);
                }}
                className="absolute top-4 right-4 z-20 h-9 w-9 bg-white/90 dark:bg-neutral-900/90 rounded-full flex items-center justify-center shadow-md text-neutral-500 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2">
                
                {/* Left Side: Product interactive visualizer */}
                <div className="p-6 bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-between border-r border-neutral-100 dark:border-neutral-900 min-h-[380px] md:min-h-[500px]">
                  
                  {/* Category and color accent */}
                  <div className="flex items-center justify-between">
                    <span className="bg-orange-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                      {selectedProductDetails.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-full border border-neutral-300" style={{ backgroundColor: selectedProductDetails.color }} />
                      <span>{selectedProductDetails.color}</span>
                    </div>
                  </div>

                  {/* Main Display Image Visualizer with Hover Zoom capability */}
                  <div className="flex-1 flex items-center justify-center py-6 relative">
                    <motion.div
                      onMouseEnter={() => setZoomImage(true)}
                      onMouseLeave={() => setZoomImage(false)}
                      animate={{ scale: zoomImage ? 1.12 : 1 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-72 cursor-zoom-in"
                    >
                      {/* Check if customized base64 picture is available, else render custom vector visualizer */}
                      {selectedProductDetails.mainImage && selectedProductDetails.mainImage.startsWith("data:image") ? (
                        <img
                          src={selectedProductDetails.mainImage}
                          alt={selectedProductDetails.name}
                          className="w-full h-full object-contain rounded-2xl drop-shadow-2xl"
                        />
                      ) : (
                        <ClothesVisualizer
                          category={selectedProductDetails.category}
                          color={selectedProductDetails.color}
                          showPattern={selectedProductDetails.name.toLowerCase().includes("mônica") || selectedProductDetails.name.toLowerCase().includes("barbie")}
                          className="bg-transparent border-none"
                        />
                      )}
                    </motion.div>
                    
                    {/* Hover tooltip for zoom */}
                    <span className="absolute bottom-1 right-2 text-[10px] text-neutral-400/80 pointer-events-none flex items-center gap-1 bg-white/40 px-2 py-0.5 rounded">
                      <Maximize2 size={10} /> Passe o mouse para zoom
                    </span>
                  </div>

                  {/* Gallery Selection Bar if multiple photos exist */}
                  <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
                    <button
                      onClick={() => {
                        // Switch back to vector or original main image
                        setSelectedGalleryIndex(0);
                      }}
                      className={`h-11 w-11 rounded-lg p-0.5 border-2 transition-all shrink-0 ${
                        selectedGalleryIndex === 0 ? "border-orange-500 scale-105" : "border-neutral-200 hover:border-neutral-400"
                      }`}
                    >
                      <ClothesVisualizer category={selectedProductDetails.category} color={selectedProductDetails.color} className="p-0 border-none rounded-md" />
                    </button>

                    {/* Prepopulated or dynamic gallery base64 images */}
                    {selectedProductDetails.gallery && selectedProductDetails.gallery.map((img, i) => {
                      const isCustom = img.startsWith("data:image");
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedGalleryIndex(i + 1)}
                          className={`h-11 w-11 rounded-lg p-0.5 border-2 overflow-hidden transition-all shrink-0 bg-white ${
                            selectedGalleryIndex === i + 1 ? "border-orange-500 scale-105" : "border-neutral-200 hover:border-neutral-400"
                          }`}
                        >
                          {isCustom ? (
                            <img src={img} className="h-full w-full object-cover rounded-md" />
                          ) : (
                            <ClothesVisualizer category={selectedProductDetails.category} color={selectedProductDetails.color} className="p-0 border-none rounded-md" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                </div>

                {/* Right Side: Product Details */}
                <div className="p-6 md:p-8 space-y-6 flex flex-col justify-between">
                  
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-2xl font-extrabold text-[#111111] dark:text-white tracking-tight leading-none">
                        {selectedProductDetails.name}
                      </h2>
                      <span className="text-[11px] font-bold text-neutral-400 font-mono mt-1 block">Referência: ID-{selectedProductDetails.id}</span>
                    </div>

                    {selectedProductDetails.price !== undefined && selectedProductDetails.price !== null && (
                      <div className="flex items-baseline gap-1 mt-2.5">
                        <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Preço:</span>
                        <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">R$</span>
                        <span className="text-2xl font-black text-neutral-900 dark:text-white">
                          {Number(selectedProductDetails.price).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Descrição do Produto</span>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 font-medium leading-relaxed">
                        {selectedProductDetails.description || "Sem descrição disponível para este vestuário profissional."}
                      </p>
                    </div>

                    {/* Size and Specific Stock Breakdown */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disponibilidade por Tamanho</span>
                        <span className="text-xs font-extrabold text-neutral-800 dark:text-white bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded">
                          Total: {selectedProductDetails.totalStock} peças
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(["P", "M", "G", "GG", "XG"] as (keyof ProductSizes)[]).map((size) => {
                          const count = selectedProductDetails.sizes[size] || 0;
                          const inStock = count > 0;
                          const isSelected = selectedSizeForCart === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={!inStock}
                              onClick={() => {
                                setSelectedSizeForCart(size);
                                setSelectedQtyForCart(1);
                              }}
                              className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer select-none outline-none ${
                                isSelected
                                  ? "bg-orange-700 border-orange-700 text-white shadow-lg ring-4 ring-orange-500/30 scale-105 font-black"
                                  : inStock
                                    ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white border-transparent hover:scale-[1.02] active:scale-[0.98]"
                                    : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 opacity-30 cursor-not-allowed"
                              }`}
                            >
                              <span className={`block text-[10px] font-extrabold uppercase ${isSelected ? "text-orange-100" : inStock ? "text-orange-100" : "text-neutral-400"}`}>{size}</span>
                              <span className={`block text-base font-black mt-1 ${isSelected ? "text-white" : inStock ? "text-white" : "text-neutral-400"}`}>
                                {inStock ? count : "0"}
                              </span>
                              <span className={`text-[8px] font-black uppercase mt-1 block ${isSelected ? "text-orange-100" : inStock ? "text-white/90" : "text-neutral-400"}`}>
                                {isSelected ? "Selecionado" : inStock ? "Disponível" : "Esgotado"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Customer action button & Quantity */}
                  <div className="pt-6 border-t border-neutral-100 dark:border-neutral-850 space-y-4">
                    {selectedSizeForCart ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">Selecione a Quantidade</span>
                          <span className="font-semibold text-neutral-500">
                            {selectedProductDetails.sizes[selectedSizeForCart as keyof ProductSizes]} peças em estoque no tam. {selectedSizeForCart}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 rounded-xl p-1 border border-neutral-200 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() => setSelectedQtyForCart(prev => Math.max(1, prev - 1))}
                              disabled={selectedQtyForCart <= 1}
                              className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-black text-sm text-neutral-800 dark:text-white">
                              {selectedQtyForCart}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const maxVal = selectedProductDetails.sizes[selectedSizeForCart as keyof ProductSizes] || 1;
                                setSelectedQtyForCart(prev => Math.min(maxVal, prev + 1));
                              }}
                              disabled={selectedQtyForCart >= (selectedProductDetails.sizes[selectedSizeForCart as keyof ProductSizes] || 0)}
                              className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30 cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (selectedSizeForCart) {
                                addToCart(selectedProductDetails, selectedSizeForCart as keyof ProductSizes, selectedQtyForCart);
                                setSelectedProductDetails(null);
                              }
                            }}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs py-3.5 tracking-wider shadow-lg shadow-orange-500/15 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <ShoppingCart size={14} />
                            <span>ADICIONAR AO CARRINHO</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center rounded-xl bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/40 text-red-500 text-xs font-bold">
                        Não há tamanhos disponíveis para este produto no momento.
                      </div>
                    )}

                    {isAuthenticated && (
                      <div className="pt-4 border-t border-neutral-100 dark:border-neutral-850 space-y-2">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider block">Controle do Administrador</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              openEditProductModal(selectedProductDetails);
                              setSelectedProductDetails(null);
                            }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-extrabold text-[10px] sm:text-xs py-2.5 transition-all cursor-pointer border border-neutral-200 dark:border-neutral-700"
                          >
                            <Edit2 size={13} />
                            <span>EDITAR PRODUTO</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteProduct(selectedProductDetails.id, selectedProductDetails.name);
                              setSelectedProductDetails(null);
                            }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] sm:text-xs py-2.5 transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>EXCLUIR PRODUTO</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      <a
                        href={`https://wa.me/5585991781673?text=Ol%C3%A1%21+Gostaria+de+saber+mais+sobre+o+produto+*${encodeURIComponent(selectedProductDetails.name)}*.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold text-xs py-3 transition-all"
                      >
                        <span>DÚVIDAS? CONTATE O ATENDIMENTO</span>
                      </a>
                      <p className="text-[10px] text-center text-neutral-400">Navegação segura. Fale diretamente com a fábrica.</p>
                    </div>
                  </div>

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: SHOPPING CART DRAWER */}
      <AnimatePresence>
        {showCartModal && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50 flex justify-end">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => setShowCartModal(false)} />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col z-10 border-l border-neutral-100 dark:border-neutral-800"
            >
              {/* Header */}
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <ShoppingCart size={18} className="text-orange-600" />
                    Carrinho de Compras
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-medium">Confirme suas escolhas antes de finalizar</p>
                </div>
                <button
                  onClick={() => setShowCartModal(false)}
                  className="h-8 w-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center text-neutral-400">
                      <ShoppingCart size={28} />
                    </div>
                    <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Seu carrinho está vazio</h4>
                    <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                      Adicione batas, calças ou toucas de nossa coleção para realizar seu pedido diretamente com nossa equipe.
                    </p>
                    <button
                      onClick={() => setShowCartModal(false)}
                      className="text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-150 dark:border-orange-900/40 px-4 py-2.5 rounded-xl cursor-pointer"
                    >
                      Voltar ao Catálogo
                    </button>
                  </div>
                ) : (
                  cart.map((item) => {
                    const maxStock = item.product.sizes[item.size] || 0;
                    return (
                      <div
                        key={item.id}
                        className="bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-900 flex items-start gap-3.5 relative"
                      >
                        {/* Thumbnail Clothes Visualizer */}
                        <div className="w-14 h-14 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 p-1 flex-shrink-0">
                          {item.product.mainImage && item.product.mainImage.startsWith("data:image") ? (
                            <img src={item.product.mainImage} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <ClothesVisualizer category={item.product.category} color={item.product.color} className="p-0 border-none rounded-lg" />
                          )}
                        </div>

                        {/* Item Meta info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="text-xs font-black text-neutral-800 dark:text-neutral-200 truncate pr-6">
                            {item.product.name}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{item.product.category}</span>
                            <span className="bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-900/30">
                              TAM: {item.size}
                            </span>
                          </div>

                          {/* Interactive Qty Adjuster */}
                          <div className="flex items-center gap-3 pt-1.5">
                            <div className="flex items-center bg-white dark:bg-neutral-900 rounded-lg border border-neutral-250 dark:border-neutral-800 p-0.5">
                              <button
                                type="button"
                                onClick={() => updateCartItemQty(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="h-6 w-6 rounded flex items-center justify-center font-bold text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-20 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-black text-xs text-neutral-800 dark:text-white">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartItemQty(item.id, item.quantity + 1)}
                                disabled={item.quantity >= maxStock}
                                className="h-6 w-6 rounded flex items-center justify-center font-bold text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-20 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-[9px] text-neutral-400">
                              (máx. {maxStock} un.)
                            </span>
                          </div>

                          {/* Item Price and Subtotal if defined */}
                          {item.product.price !== undefined && item.product.price !== null && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                              <span>Unidade: R$ {Number(item.product.price).toFixed(2).replace(".", ",")}</span>
                              <span className="text-neutral-300 dark:text-neutral-850">|</span>
                              <span className="text-orange-600 dark:text-orange-400 font-extrabold">Subtotal: R$ {Number(Number(item.product.price) * item.quantity).toFixed(2).replace(".", ",")}</span>
                            </div>
                          )}
                        </div>

                        {/* Remove item button */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="absolute top-3 right-3 text-neutral-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                          title="Remover item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}

                {/* Optional Customer Registration for Discount */}
                {cart.length > 0 && (
                  <div className="pt-4 border-t border-neutral-150 dark:border-neutral-800 space-y-4">
                    <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-4 rounded-2xl border border-orange-500 shadow-sm">
                      <div className="flex items-start gap-3">
                        <input
                          id="register-toggle"
                          type="checkbox"
                          checked={isRegisteringCustomer}
                          onChange={(e) => setIsRegisteringCustomer(e.target.checked)}
                          className="mt-1 h-4 w-4 text-orange-600 focus:ring-white border-white/40 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <label htmlFor="register-toggle" className="block text-xs font-black text-white cursor-pointer">
                            Quero me cadastrar e ganhar 10% de desconto na primeira compra!
                          </label>
                          <p className="text-[10px] text-orange-100 mt-0.5">
                            Preencha seus dados de entrega e contato para receber um cupom exclusivo de 10% de desconto na primeira compra direto de fábrica no seu WhatsApp.
                          </p>
                        </div>
                      </div>
                    </div>

                    {isRegisteringCustomer && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 bg-neutral-900 p-4 rounded-2xl border border-neutral-800"
                      >
                        <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Dados de Cadastro & Entrega</h4>
                        
                        {/* CEP, Cidade, Estado */}
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">CEP</label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="99999-000"
                                required={isRegisteringCustomer}
                                value={customerForm.cep}
                                onChange={(e) => {
                                  const formatted = formatCep(e.target.value);
                                  setCustomerForm({ ...customerForm, cep: formatted });
                                  handleCepLookup(formatted);
                                }}
                                className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono"
                              />
                              {loadingCep && (
                                <span className="absolute right-2 top-2 w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
                              )}
                            </div>
                          </div>

                          <div className="col-span-5">
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Cidade</label>
                            <input
                              type="text"
                              placeholder="Ex: São Paulo"
                              required={isRegisteringCustomer}
                              value={customerForm.cidade}
                              onChange={(e) => setCustomerForm({ ...customerForm, cidade: e.target.value })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Estado (UF)</label>
                            <input
                              type="text"
                              placeholder="UF"
                              required={isRegisteringCustomer}
                              maxLength={2}
                              value={customerForm.estado}
                              onChange={(e) => setCustomerForm({ ...customerForm, estado: e.target.value.toUpperCase() })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-1 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-bold text-center"
                            />
                          </div>
                        </div>

                        {/* Bairro, Rua, Número */}
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Bairro</label>
                            <input
                              type="text"
                              placeholder="Ex: Centro"
                              required={isRegisteringCustomer}
                              value={customerForm.bairro}
                              onChange={(e) => setCustomerForm({ ...customerForm, bairro: e.target.value })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div className="col-span-5">
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Rua / Logradouro</label>
                            <input
                              type="text"
                              placeholder="Ex: Av. Paulista"
                              required={isRegisteringCustomer}
                              value={customerForm.rua}
                              onChange={(e) => setCustomerForm({ ...customerForm, rua: e.target.value })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Número</label>
                            <input
                              type="text"
                              placeholder="Nº"
                              required={isRegisteringCustomer}
                              value={customerForm.numero}
                              onChange={(e) => setCustomerForm({ ...customerForm, numero: e.target.value })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-1 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono text-center"
                            />
                          </div>
                        </div>

                        {/* Nome Completo & CPF */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Nome Completo</label>
                            <input
                              type="text"
                              placeholder="Seu nome completo"
                              required={isRegisteringCustomer}
                              value={customerForm.nome}
                              onChange={(e) => setCustomerForm({ ...customerForm, nome: e.target.value })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">CPF</label>
                            <input
                              type="text"
                              placeholder="000.000.000-00"
                              required={isRegisteringCustomer}
                              value={customerForm.cpf}
                              onChange={(e) => setCustomerForm({ ...customerForm, cpf: formatCpf(e.target.value) })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono"
                            />
                          </div>
                        </div>

                        {/* Telefone & E-mail */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">Telefone</label>
                            <input
                              type="text"
                              placeholder="(99) 99999-9999"
                              required={isRegisteringCustomer}
                              value={customerForm.telefone}
                              onChange={(e) => setCustomerForm({ ...customerForm, telefone: formatPhone(e.target.value) })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-bold text-white uppercase mb-1">E-mail</label>
                            <input
                              type="email"
                              placeholder="seu@email.com"
                              required={isRegisteringCustomer}
                              value={customerForm.email}
                              onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                              className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl py-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        {/* Glowing Success Discount Alert */}
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-bold flex items-center gap-1.5 justify-center">
                          <span>🎁 10% de Desconto Ativado para sua Primeira Compra!</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Checkout Actions */}
              {cart.length > 0 && (() => {
                const isFormValid = !isRegisteringCustomer || (
                  customerForm.nome.trim() !== "" &&
                  customerForm.cpf.trim() !== "" &&
                  customerForm.telefone.trim() !== "" &&
                  customerForm.email.trim() !== "" &&
                  customerForm.cep.trim() !== "" &&
                  customerForm.cidade.trim() !== "" &&
                  customerForm.estado.trim() !== "" &&
                  customerForm.bairro.trim() !== "" &&
                  customerForm.rua.trim() !== "" &&
                  customerForm.numero.trim() !== ""
                );

                const itemsWithPrice = cart.filter(item => item.product.price !== undefined && item.product.price !== null);
                const hasPrices = itemsWithPrice.length > 0;
                const rawTotalPrice = itemsWithPrice.reduce((total, item) => total + (Number(item.product.price) * item.quantity), 0);
                const discountPercent = (isRegisteringCustomer && isFormValid) ? 0.10 : 0.0;
                const finalTotalPrice = rawTotalPrice * (1 - discountPercent);

                return (
                  <div className="p-5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total do Pedido</span>
                        <h4 className="text-sm font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                          {cart.reduce((total, item) => total + item.quantity, 0)} peças 
                          {isRegisteringCustomer && isFormValid && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">
                              -10% Desconto
                            </span>
                          )}
                        </h4>
                        {hasPrices && (
                          <div className="mt-1">
                            {discountPercent > 0 && (
                              <div className="text-[10px] text-neutral-400">
                                Subtotal: R$ {rawTotalPrice.toFixed(2).replace(".", ",")}
                              </div>
                            )}
                            <div className="text-base font-extrabold text-orange-600 dark:text-orange-400">
                              Total: R$ {finalTotalPrice.toFixed(2).replace(".", ",")}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={clearCart}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors hover:underline cursor-pointer"
                      >
                        Esvaziar Carrinho
                      </button>
                    </div>

                    {!isFormValid && (
                      <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl text-[10px] text-amber-700 dark:text-amber-400 font-bold text-center">
                        ⚠️ Preencha todos os campos do endereço e cadastro acima para ativar o desconto e finalizar!
                      </div>
                    )}

                    <a
                      href={isFormValid ? getCartWhatsappLink() : "#"}
                      target={isFormValid ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!isFormValid) {
                          e.preventDefault();
                          triggerNotification("Por favor, preencha todos os campos de cadastro antes de finalizar!", "warning");
                          return;
                        }
                        if (isRegisteringCustomer) {
                          // Optimistic local save
                          const newCust = {
                            ...customerForm,
                            id: `cust-${Date.now()}`,
                            createdAt: new Date().toISOString()
                          };
                          const updatedCustomers = [newCust, ...customers];
                          const currentDB: DBState = {
                            products,
                            categories,
                            movements,
                            importReports,
                            customers: updatedCustomers
                          };

                          if (directCloudSyncEnabled && clientSupabaseUrl && clientSupabaseKey) {
                            saveClientDB(currentDB);
                          } else {
                            setCustomers(updatedCustomers);
                            safeSaveUnistoreLocalDB(currentDB);

                            fetch("/api/customers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(customerForm)
                            })
                            .then(res => {
                              const contentType = res.headers.get("content-type");
                              if (!res.ok || (contentType && contentType.includes("text/html"))) {
                                throw new Error("HTML response");
                              }
                              return res.json();
                            })
                            .then(data => {
                                if (data.success) {
                                  setCustomers(data.db.customers || []);
                                  safeSaveUnistoreLocalDB(data.db);
                                }
                            })
                            .catch(err => console.warn("Error saving customer info to db, using offline backup:", err));
                          }
                        }
                        setTimeout(() => clearCart(), 1000);
                        setShowCartModal(false);
                      }}
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl font-extrabold text-xs py-4 tracking-wider shadow-lg transition-all cursor-pointer ${
                        isFormValid
                          ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-emerald-600/10 active:scale-[0.98]"
                          : "bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600 cursor-not-allowed opacity-50 shadow-none"
                      }`}
                    >
                      <span>FINALIZAR COMPRA PELO WHATSAPP</span>
                    </a>
                    <p className="text-[9px] text-center text-neutral-400 uppercase tracking-wide">
                      Enviaremos uma grade detalhada ao nosso atendimento de fábrica.
                    </p>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CADASTRO OU EDIÇÃO DE PRODUTO (ADMIN FORM) */}
      <AnimatePresence>
        {showProductFormModal && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-neutral-100 dark:border-neutral-800 relative my-8"
            >
              <button
                onClick={() => setShowProductFormModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formMode === "create" ? "Cadastrar Novo Produto" : "Editar Produto Existente"}
                </h3>
                <p className="text-xs text-neutral-500">Insira as especificações, foto e quantitativos de grade para o catálogo.</p>
              </div>

              <form onSubmit={handleProductFormSubmit} className="space-y-4">
                
                {/* Name field */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Ex: Bata Princesa Azul Marinho"
                    className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-semibold focus:ring-4 focus:ring-orange-500/20 focus:outline-none text-neutral-900 dark:text-white transition-all shadow-sm"
                  />
                </div>

                {/* Price field */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Preço do Produto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="Ex: 89.90 (Deixe em branco se não houver preço definido)"
                    className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-semibold focus:ring-4 focus:ring-orange-500/20 focus:outline-none text-neutral-900 dark:text-white transition-all shadow-sm"
                  />
                </div>

                {/* Upload Photo Button */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Foto Principal / Galeria</label>
                  <label className="flex items-center justify-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl py-3 px-3 text-xs cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-950">
                    <UploadCloud size={14} className="text-orange-500" />
                    <span className="font-semibold text-neutral-600 dark:text-neutral-400">Carregar Imagem Real</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProductFormImageUpload}
                    />
                  </label>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Descrição do Produto</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Escreva detalhes de acabamento, bolsos, tipo de tecido..."
                    className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-semibold h-16 focus:ring-4 focus:ring-orange-500/20 focus:outline-none text-neutral-900 dark:text-white transition-all shadow-sm"
                  />
                </div>

                {/* Sizes Stock Quantities Grade */}
                <div className="space-y-2 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-150 dark:border-neutral-850 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Quantidades Físicas em Estoque</span>
                    <span className="text-xs font-extrabold text-orange-500">
                      Total Calculado: {Object.values(productForm.sizes).reduce((acc: number, q) => acc + (Number(q) || 0), 0)} peças
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {(["P", "M", "G", "GG", "XG"] as (keyof ProductSizes)[]).map((size) => (
                      <div key={size} className="text-center">
                        <label className="block text-[10px] font-bold text-neutral-400 mb-1">{size}</label>
                        <input
                          type="number"
                          min="0"
                          value={productForm.sizes[size] || ""}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setProductForm({
                              ...productForm,
                              sizes: {
                                ...productForm.sizes,
                                [size]: val
                              }
                            });
                          }}
                          placeholder="0"
                          className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-850 dark:focus:border-orange-500 rounded-xl py-2 text-center text-xs font-extrabold text-neutral-900 dark:text-white focus:ring-4 focus:ring-orange-500/20 focus:outline-none transition-all shadow-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-850">
                  <button
                    type="button"
                    onClick={() => setShowProductFormModal(false)}
                    className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-700"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-orange-500/10"
                  >
                    {formMode === "create" ? "SALVAR NOVO PRODUTO" : "SALVAR ALTERAÇÕES"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIÇÃO DE CLIENTE CADASTRADO */}
      <AnimatePresence>
        {showCustomerFormModal && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-neutral-100 dark:border-neutral-800 relative my-8 animate-in duration-200"
            >
              <button
                type="button"
                onClick={() => setShowCustomerFormModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Editar Cadastro do Cliente
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Atualize as informações de cadastro, contato e endereço de entrega do cliente.</p>
              </div>

              <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
                
                {/* Nome Completo */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={customerFormState.nome}
                    onChange={(e) => setCustomerFormState({ ...customerFormState, nome: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* CPF e Telefone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">CPF</label>
                    <input
                      type="text"
                      required
                      value={customerFormState.cpf}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, cpf: formatCpf(e.target.value) })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Telefone</label>
                    <input
                      type="text"
                      value={customerFormState.telefone}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, telefone: formatPhone(e.target.value) })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">E-mail</label>
                  <input
                    type="email"
                    value={customerFormState.email}
                    onChange={(e) => setCustomerFormState({ ...customerFormState, email: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* CEP, Cidade, Estado */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4">
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">CEP</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="99999-000"
                        value={customerFormState.cep}
                        onChange={(e) => {
                          const formatted = formatCep(e.target.value);
                          setCustomerFormState({ ...customerFormState, cep: formatted });
                          handleAdminCepLookup(formatted);
                        }}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-mono"
                      />
                      {loadingCep && (
                        <span className="absolute right-2 top-2.5 w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-5">
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Cidade</label>
                    <input
                      type="text"
                      value={customerFormState.cidade}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, cidade: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Estado</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={customerFormState.estado}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, estado: e.target.value.toUpperCase() })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-2 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 font-bold text-center"
                    />
                  </div>
                </div>

                {/* Bairro, Rua, Número */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4">
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Bairro</label>
                    <input
                      type="text"
                      value={customerFormState.bairro}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, bairro: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="col-span-5">
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      value={customerFormState.rua}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, rua: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Número</label>
                    <input
                      type="text"
                      value={customerFormState.numero}
                      onChange={(e) => setCustomerFormState({ ...customerFormState, numero: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 px-2 focus:ring-2 focus:ring-orange-500/10 focus:outline-none focus:border-orange-500 text-center font-mono"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCustomerFormModal(false)}
                    className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-orange-500/10"
                  >
                    SALVAR ALTERAÇÕES
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: LANÇAR MOVIMENTAÇÃO DE ESTOQUE (ADMIN MOVEMENT MANUAL FORM) */}
      <AnimatePresence>
        {showStockMovementModal && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800 relative"
            >
              <button
                onClick={() => setShowStockMovementModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
              >
                <X size={18} />
              </button>

              <div className="mb-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Lançar Movimentação de Estoque</h3>
                <p className="text-xs text-neutral-500">Ajuste quantitativo de estoque, registre venda (saída) ou recebimento de lote (entrada).</p>
              </div>

              <form onSubmit={handleStockMovementSubmit} className="space-y-4">
                
                {/* Select product */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Selecione o Produto</label>
                  <select
                    value={movementForm.productId}
                    onChange={(e) => setMovementForm({ ...movementForm, productId: e.target.value })}
                    className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm cursor-pointer"
                  >
                    <option value="">-- Selecione o Produto --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Select size */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Tamanho</label>
                    <select
                      value={movementForm.size}
                      onChange={(e) => setMovementForm({ ...movementForm, size: e.target.value as keyof ProductSizes })}
                      className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-extrabold text-neutral-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm cursor-pointer"
                    >
                      <option value="P">P</option>
                      <option value="M">M</option>
                      <option value="G">G</option>
                      <option value="GG">GG</option>
                      <option value="XG">XG</option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Quantidade Física</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                      className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs text-center font-extrabold text-neutral-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Action Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Tipo de Lançamento</label>
                    <select
                      value={movementForm.type}
                      onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as "entrada" | "saída" | "ajuste" })}
                      className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm cursor-pointer"
                    >
                      <option value="entrada">Entrada (Adicionar)</option>
                      <option value="saída">Saída (Remover)</option>
                      <option value="ajuste">Ajuste (Sobrescrever valor)</option>
                    </select>
                  </div>

                  {/* Operator */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Operador Responsável</label>
                    <input
                      type="text"
                      required
                      value={movementForm.user}
                      onChange={(e) => setMovementForm({ ...movementForm, user: e.target.value })}
                      placeholder="Nome do usuário"
                      className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Observações / Motivo</label>
                  <input
                    type="text"
                    required
                    value={movementForm.notes}
                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                    placeholder="Ex: Nota Fiscal 120, ajuste de balanço, perda física..."
                    className="w-full bg-neutral-50 hover:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-neutral-200 focus:border-orange-500 dark:border-neutral-800 dark:focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm"
                  />
                </div>

                {/* Actions */}
                <div className="pt-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-850">
                  <button
                    type="button"
                    onClick={() => setShowStockMovementModal(false)}
                    className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-700"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-orange-500/10"
                  >
                    CONFIRMAR LANÇAMENTO
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: IMPORTAR PRODUTOS VIA PLANILHA (XLSX) */}
      <AnimatePresence>
        {showXlsxModal && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-neutral-100 dark:border-neutral-800 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => {
                  setShowXlsxModal(false);
                  setXlsxPreviewRows(null);
                  setXlsxFileError(null);
                  setXlsxImportResult(null);
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <FileSpreadsheet size={20} />
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Importação em Massa via Planilha (XLSX)</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  Adicione novos produtos ou atualize estoque/preços de produtos existentes. O sistema fará a correspondência pelo <strong className="text-orange-500">Código ID</strong> ou pelo <strong className="text-orange-500">Nome exato</strong> do produto.
                </p>
              </div>

              {!xlsxImportResult ? (
                <div className="space-y-6">
                  {/* Download Template Card */}
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/10 border border-orange-200/50 dark:border-orange-900/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold text-neutral-900 dark:text-orange-400 uppercase tracking-wider">Planilha de Exemplo</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed max-w-md">
                        Use o nosso modelo para garantir que os nomes das colunas estejam perfeitamente mapeados (Nome, Categoria, Preço, Cor, Descrição, P, M, G, GG, XG).
                      </p>
                    </div>
                    <button
                      onClick={downloadXlsxTemplate}
                      className="whitespace-nowrap bg-[#111111] dark:bg-orange-600 hover:bg-neutral-850 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <ArrowDown size={14} /> Baixar Modelo .XLSX
                    </button>
                  </div>

                  {/* Drag and Drop Zone */}
                  {!xlsxPreviewRows ? (
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Selecione o arquivo da Planilha</label>
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleImportXLSXFile(file);
                        }}
                        className="border-2 border-dashed border-neutral-200 hover:border-orange-500 dark:border-neutral-850 dark:hover:border-orange-500 rounded-2xl p-8 text-center transition-all cursor-pointer bg-neutral-50 dark:bg-neutral-950 relative hover:bg-white dark:hover:bg-neutral-900"
                      >
                        <input
                          type="file"
                          accept=".xlsx, .xls, .ods, .csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImportXLSXFile(file);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-3">
                          <span className="p-3 bg-neutral-100 dark:bg-neutral-900 text-neutral-400 rounded-full">
                            <UploadCloud size={24} />
                          </span>
                          <div>
                            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200">Arraste a planilha para cá ou clique para selecionar</p>
                            <p className="text-[10px] text-neutral-400 mt-1">Suporta formatos .xlsx, .xls, .ods ou .csv</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Display preview before confirmation
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                          Detectamos <strong className="text-emerald-500">{xlsxPreviewRows.length}</strong> produtos na planilha:
                        </span>
                        <button
                          onClick={() => setXlsxPreviewRows(null)}
                          className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                        >
                          Limpar e selecionar outro arquivo
                        </button>
                      </div>

                      <div className="border border-neutral-150 dark:border-neutral-800 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 text-[10px] font-bold text-neutral-500 border-b border-neutral-150 dark:border-neutral-800">
                              <th className="p-2.5">Nome</th>
                              <th className="p-2.5">Categoria</th>
                              <th className="p-2.5">Preço</th>
                              <th className="p-2.5 text-center">Grade (P-M-G-GG-XG)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                            {xlsxPreviewRows.map((p, i) => (
                              <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40">
                                <td className="p-2.5 truncate max-w-[180px]">{p.name}</td>
                                <td className="p-2.5">{p.category}</td>
                                <td className="p-2.5 text-neutral-600 dark:text-neutral-400">
                                  {p.price !== undefined ? `R$ ${p.price.toFixed(2)}` : "Não definido"}
                                </td>
                                <td className="p-2.5 text-center font-mono text-neutral-500">
                                  {p.sizes.P}-{p.sizes.M}-{p.sizes.G}-{p.sizes.GG}-{p.sizes.XG}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-200/50 dark:border-emerald-900/25 rounded-2xl flex items-center justify-between gap-4 mt-2">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Tudo pronto para importar</h4>
                          <p className="text-[10px] text-neutral-500">Clique no botão para consolidar as alterações e sincronizar com o servidor.</p>
                        </div>
                        <button
                          onClick={submitXlsxImport}
                          disabled={importingXlsx}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-400 text-white font-extrabold text-xs px-5 py-3 rounded-xl cursor-pointer transition-all flex items-center gap-2 shadow-md"
                        >
                          {importingXlsx ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          CONFIRMAR IMPORTAÇÃO
                        </button>
                      </div>
                    </div>
                  )}

                  {xlsxFileError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>{xlsxFileError}</span>
                    </div>
                  )}

                  {importingXlsx && !xlsxPreviewRows && (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <RefreshCw size={24} className="animate-spin text-orange-500" />
                      <p className="text-xs font-bold text-neutral-500">Lendo e validando dados da planilha...</p>
                    </div>
                  )}
                </div>
              ) : (
                // Display success report
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/20 rounded-2xl flex flex-col items-center text-center gap-3">
                    <span className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full">
                      <CheckCircle size={32} />
                    </span>
                    <div>
                      <h4 className="text-base font-extrabold text-neutral-900 dark:text-white">Importação Concluída com Sucesso!</h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-md">
                        A planilha de estoque foi processada. O histórico de movimentações também foi atualizado para registrar as alterações.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl text-center border border-neutral-100 dark:border-neutral-850">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Novos Criados</span>
                      <strong className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1 block">{xlsxImportResult.insertedCount}</strong>
                    </div>
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl text-center border border-neutral-100 dark:border-neutral-850">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Atualizados</span>
                      <strong className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1 block">{xlsxImportResult.updatedCount}</strong>
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => {
                        setShowXlsxModal(false);
                        setXlsxPreviewRows(null);
                        setXlsxFileError(null);
                        setXlsxImportResult(null);
                      }}
                      className="bg-[#111111] dark:bg-orange-600 hover:bg-neutral-800 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      FECHAR IMPORTADOR
                    </button>
                  </div>
                </div>
              )}

              {!xlsxImportResult && (
                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-850 mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowXlsxModal(false);
                      setXlsxPreviewRows(null);
                      setXlsxFileError(null);
                      setXlsxImportResult(null);
                    }}
                    className="px-4 py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800 relative"
            >
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${confirmModal.isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-950/40' : 'bg-orange-100 text-orange-600 dark:bg-orange-950/40'} shrink-0`}>
                    <Trash2 size={24} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white leading-tight">
                      {confirmModal.title}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {confirmModal.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-xs font-bold rounded-xl text-neutral-500 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-md transition-all cursor-pointer ${
                      confirmModal.isDangerous
                        ? "bg-red-600 hover:bg-red-500 shadow-red-600/10"
                        : "bg-orange-600 hover:bg-orange-500 shadow-orange-500/10"
                    }`}
                  >
                    {confirmModal.confirmText || "Confirmar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Lock Button (Canto Inferior Esquerdo) - Extremamente Discreto / Escondido */}
      <div className="hidden sm:flex fixed bottom-1 left-1 z-45">
        <button
          id="btn-admin-padlock"
          onClick={() => {
            if (isAuthenticated) {
              if (currentTab === "catalog") {
                setCurrentTab("dashboard");
                triggerNotification("Entrando no Painel Administrativo", "info");
              } else {
                setCurrentTab("catalog");
                triggerNotification("Voltando ao Catálogo Público", "info");
              }
            } else {
              setShowLoginModal(true);
            }
          }}
          className="w-6 h-6 rounded-md transition-all duration-300 opacity-5 hover:opacity-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-pointer flex items-center justify-center border-none shadow-none focus:outline-none"
          title={isAuthenticated ? "Alternar Painel Admin / Catálogo" : "Acesso Administrativo"}
        >
          <Lock size={12} />
        </button>
      </div>

    </div>
  );
}
