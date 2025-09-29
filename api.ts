
import { db } from './database';
import type { AppSettings, Product, ProductData, Customer, CustomerData, Supplier, SupplierData, SalesInvoice, SalesInvoiceData, Quotation, QuotationData, PurchaseInvoice, PurchaseInvoiceData, StockAdjustment } from './types';

export const api = {
  getProducts: () => db.products.getAll(),
  createProduct: (data: ProductData) => db.products.create(data),
  updateProduct: (id: string, data: Partial<ProductData>) => db.products.update(id, data),
  deleteProduct: (id: string) => db.products.delete(id),
  adjustProductStock: (productId: string, quantity: number, reason: string) => db.products.adjustStock(productId, quantity, reason),

  getCustomers: () => db.customers.getAll(),
  createCustomer: (data: CustomerData) => db.customers.create(data),
  updateCustomer: (id: string, data: Partial<CustomerData>) => db.customers.update(id, data),
  deleteCustomer: (id: string) => db.customers.delete(id),
  
  getSuppliers: () => db.suppliers.getAll(),
  createSupplier: (data: SupplierData) => db.suppliers.create(data),
  updateSupplier: (id: string, data: Partial<SupplierData>) => db.suppliers.update(id, data),
  deleteSupplier: (id: string) => db.suppliers.delete(id),

  getQuotations: () => db.quotations.getAll(),
  createQuotation: (data: QuotationData) => db.quotations.create(data),
  updateQuotation: (id: string, data: Partial<QuotationData>) => db.quotations.update(id, data),
  deleteQuotation: (id: string) => db.quotations.delete(id),
  
  getSalesInvoices: () => db.salesInvoices.getAll(),
  createSalesInvoice: (data: SalesInvoiceData) => db.salesInvoices.create(data),
  updateSalesInvoice: (id: string, data: Partial<SalesInvoiceData>) => db.salesInvoices.update(id, data),
  deleteSalesInvoice: (id: string) => db.salesInvoices.delete(id),

  getPurchaseInvoices: () => db.purchaseInvoices.getAll(),
  createPurchaseInvoice: (data: PurchaseInvoiceData) => db.purchaseInvoices.create(data),
  updatePurchaseInvoice: (id: string, data: Partial<PurchaseInvoiceData>) => db.purchaseInvoices.update(id, data),
  deletePurchaseInvoice: (id: string) => db.purchaseInvoices.delete(id),

  getStockAdjustments: () => db.stockAdjustments.getAll(),

  getSettings: () => db.settings.get(),
  updateSettings: (data: Partial<AppSettings>) => db.settings.update(data),
  
  exportDb: () => db.exportDb(),
  importDb: (data: Uint8Array) => db.importDb(data),
};