
export type Page = 'Dashboard' | 'Sales' | 'Purchases' | 'Inventory' | 'Reports' | 'Contacts' | 'Settings';

export interface Product {
  id: string;
  name: string;
  sku?: string;
  hsnCode?: string;
  category?: string;
  salePrice: number;
  purchasePrice: number;
  taxRate?: number; // in percent
  isService: boolean;
  stock: number | null;
  reorderPoint: number | null;
}
export type ProductData = Omit<Product, 'id'>;

export interface Address {
    line1: string;
    line2: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  billingAddress: Address;
  shippingAddress: Address;
  gstin?: string;
}
export type CustomerData = Omit<Customer, 'id'>;


export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: Address;
  gstin?: string;
}
export type SupplierData = Omit<Supplier, 'id'>;


export interface InvoiceItem {
  productId?: string; // Optional for custom items or deleted products
  customItemName?: string; // For custom items or preserving name of deleted products
  hsnCode?: string;
  quantity: number;
  rate: number;
  taxRate: number; // tax rate in percent for this item
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  status: 'Paid' | 'Unpaid' | 'Overdue' | 'Partially Paid';
  amountPaid?: number;
}
export type SalesInvoiceData = Omit<SalesInvoice, 'id'>;


export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  quoteDate: string;
  expiryDate: string;
  items: InvoiceItem[];
  status: 'Sent' | 'Accepted' | 'Invoiced' | 'Expired';
}
export type QuotationData = Omit<Quotation, 'id'>;


export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  purchaseDate: string;
  items: InvoiceItem[];
  status: 'Paid' | 'Unpaid' | 'Partially Paid';
  amountPaid?: number;
}
export type PurchaseInvoiceData = Omit<PurchaseInvoice, 'id'>;

export interface StockAdjustment {
  id: string;
  productId: string;
  date: string;
  quantityChange: number;
  reason: string;
}
export type StockAdjustmentData = Omit<StockAdjustment, 'id'>;


export interface CompanyDetails {
    name: string;
    address: Address;
    email: string;
    phone: string;
    gstin: string;
    logoUrl: string;
}

export interface BankDetails {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
}

export interface InvoiceSettings {
    accentColor: string;
    notes: string;
    terms: string;
    bankDetails?: BankDetails;
    invoiceNumberPrefix: string;
    nextInvoiceNumber: number;
    quotationNumberPrefix: string;
    nextQuotationNumber: number;
}

export interface AppSettings {
    companyDetails: CompanyDetails;
    invoiceSettings: InvoiceSettings;
}

export interface AppDb {
    products: Product[];
    customers: Customer[];
    suppliers: Supplier[];
    salesInvoices: SalesInvoice[];
    quotations: Quotation[];
    purchaseInvoices: PurchaseInvoice[];
    stockAdjustments: StockAdjustment[];
    settings: AppSettings;
}