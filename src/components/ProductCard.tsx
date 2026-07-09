/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Product } from "../types";
import { ClothesVisualizer } from "./ClothesVisualizer";
import { ShoppingBag, Edit2, Trash2 } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onViewProduct: (product: Product) => void;
  isAuthenticated?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string, name: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewProduct,
  isAuthenticated = false,
  onEdit,
  onDelete,
}) => {
  const { id, name, category, color, sizes, totalStock, mainImage } = product;

  // Determine which sizes have stock
  const sizeKeys: (keyof typeof sizes)[] = ["P", "M", "G", "GG", "XG"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -6, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 shadow-sm"
      id={`product-card-${id}`}
    >
      {/* Product Image Area with Hover Scale */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-50 dark:bg-neutral-950">
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full h-56 cursor-pointer flex items-center justify-center p-2"
          onClick={() => onViewProduct(product)}
        >
          {mainImage && mainImage.startsWith("data:image") ? (
            <img src={mainImage} alt={name} className="w-full h-full object-contain rounded-xl drop-shadow-md" />
          ) : (
            <ClothesVisualizer category={category} color={color} className="h-full" />
          )}
        </motion.div>

        {/* Floating Quick view action on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex gap-1.5">
          {isAuthenticated && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white shadow-md hover:bg-orange-500 transition-colors cursor-pointer"
              title="Editar Produto"
            >
              <Edit2 size={12} />
            </button>
          )}
          {isAuthenticated && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id, name);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-500 transition-colors cursor-pointer"
              title="Excluir Produto"
            >
              <Trash2 size={12} />
            </button>
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-900/90 shadow-md backdrop-blur-sm text-neutral-800 dark:text-neutral-200 pointer-events-none">
            <ShoppingBag size={14} className="text-orange-500" />
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-4 flex flex-col flex-grow">
        {/* Category & Stock Row */}
        <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span>{category}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${totalStock > 0 ? "bg-orange-500 text-white" : "bg-red-550 text-white"}`}>
            {totalStock > 0 ? `${totalStock} un.` : "Esgotado"}
          </span>
        </div>

        {/* Product Name */}
        <h3
          className="mt-1 text-base font-semibold text-neutral-800 dark:text-neutral-100 hover:text-orange-500 transition-colors cursor-pointer line-clamp-1"
          onClick={() => onViewProduct(product)}
        >
          {name}
        </h3>

        {/* Price display */}
        {product.price !== undefined && product.price !== null && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">R$</span>
            <span className="text-base font-black text-neutral-900 dark:text-white">
              {Number(product.price).toFixed(2).replace(".", ",")}
            </span>
          </div>
        )}

        {/* Sizes Badges / Cards - Vibrant Orange for high visibility of stock counts */}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {sizeKeys.map((size) => {
            const qty = sizes[size] || 0;
            const hasStock = qty > 0;
            return (
              <span
                key={size}
                className={`flex h-8 items-center justify-center rounded-xl text-[10px] font-black border px-2.5 shadow-sm transition-colors ${
                  hasStock
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700 opacity-40 line-through"
                }`}
                title={hasStock ? `${qty} unidades em estoque` : "Esgotado"}
              >
                {size}
                {hasStock && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-lg bg-white/20 text-[9px] font-black text-white">
                    {qty}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* View Product CTA Button */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onViewProduct(product)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-500 shadow-md shadow-orange-500/10 active:scale-[0.98] transition-all cursor-pointer"
        >
          VER PRODUTO
        </button>
      </div>
    </motion.div>
  );
};
