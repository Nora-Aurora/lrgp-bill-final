import type { Product, Customer, Supplier, SalesInvoice, Quotation, PurchaseInvoice, CompanyDetails, InvoiceSettings } from './types';

export const DUMMY_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Wireless Mouse', sku: 'WM-001', hsnCode: '847160', category: 'Electronics', salePrice: 2499, purchasePrice: 1200, taxRate: 18, stock: 150, reorderPoint: 20, isService: false },
  { id: 'p2', name: 'Mechanical Keyboard', sku: 'MK-002', hsnCode: '847160', category: 'Electronics', salePrice: 7499, purchasePrice: 4500, taxRate: 18, stock: 80, reorderPoint: 15, isService: false },
  { id: 'p3', name: '27-inch 4K Monitor', sku: 'MON-4K-27', hsnCode: '852852', category: 'Electronics', salePrice: 29999, purchasePrice: 20000, taxRate: 28, stock: 45, reorderPoint: 10, isService: false },
  { id: 'p4', name: 'Ergonomic Office Chair', sku: 'CHR-ERG-01', hsnCode: '940130', category: 'Furniture', salePrice: 19999, purchasePrice: 12000, taxRate: 18, stock: 30, reorderPoint: 5, isService: false },
  { id: 'p5', name: 'Standing Desk', sku: 'DSK-STD-01', hsnCode: '940330', category: 'Furniture', salePrice: 39999, purchasePrice: 28000, taxRate: 18, stock: 12, reorderPoint: 5, isService: false },
  { id: 'p6', name: 'USB-C Hub', sku: 'HUB-USBC-01', hsnCode: '850440', category: 'Accessories', salePrice: 3999, purchasePrice: 2000, taxRate: 18, stock: 200, reorderPoint: 30, isService: false },
  { id: 'p7', name: 'Laptop Stand', sku: 'LPS-001', hsnCode: '940320', category: 'Accessories', salePrice: 2999, purchasePrice: 1500, taxRate: 12, stock: 8, reorderPoint: 10, isService: false },
];

export const DUMMY_CUSTOMERS: Customer[] = [
  { 
    id: 'c1', 
    name: 'Tech Solutions Pvt. Ltd.', 
    email: 'contact@techsolutions.com', 
    phone: '9876543210',
    billingAddress: { line1: '123 Tech Park', line2: 'Silicon Valley', district: 'Bangalore Urban', state: 'Karnataka', country: 'India', pincode: '560001' }, 
    shippingAddress: { line1: '123 Tech Park', line2: 'Silicon Valley', district: 'Bangalore Urban', state: 'Karnataka', country: 'India', pincode: '560001' }, 
    gstin: '29ABCDE1234F1Z5' 
  },
  { 
    id: 'c2', 
    name: 'Creative Designs Co.', 
    email: 'hello@creativedesigns.co', 
    phone: '8765432109',
    billingAddress: { line1: '456 Art Avenue', line2: 'Bandra West', district: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400050' }, 
    shippingAddress: { line1: '456 Art Avenue', line2: 'Bandra West', district: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400050' }, 
    gstin: '27FGHIJ5678K1Z4' 
  },
  { 
    id: 'c3', 
    name: 'Global Exports', 
    email: 'sales@globalexports.net', 
    phone: '7654321098',
    billingAddress: { line1: '789 Trade Center', line2: 'Connaught Place', district: 'New Delhi', state: 'Delhi', country: 'India', pincode: '110001' }, 
    shippingAddress: { line1: '789 Trade Center', line2: 'Connaught Place', district: 'New Delhi', state: 'Delhi', country: 'India', pincode: '110001' }, 
    gstin: '07LMNOP9012Q1Z3' 
  },
];

export const DUMMY_SUPPLIERS: Supplier[] = [
    { 
        id: 's1', 
        name: 'Electro Supplies India', 
        email: 'sales@electrosupplies.in', 
        phone: '9123456780',
        address: { line1: '101 Component Rd', line2: '', district: 'Pune', state: 'Maharashtra', country: 'India', pincode: '411001' }, 
        gstin: '27RSTUV3456W1Z2' 
    },
    { 
        id: 's2', 
        name: 'Office Furniture Direct', 
        email: 'support@ofd.com', 
        phone: '9098765432',
        address: { line1: '202 Factory Lane', line2: '', district: 'Chennai', state: 'Tamil Nadu', country: 'India', pincode: '600001' },
        gstin: '33WXYZ7890A1Z1' 
    },
];

export const DUMMY_SALES_INVOICES: SalesInvoice[] = [
  { id: 'si1', invoiceNumber: 'INV-00001', customerId: 'c1', invoiceDate: '2024-07-15', dueDate: '2024-08-14', items: [{ productId: 'p1', quantity: 10, rate: 2499, taxRate: 18 }, { productId: 'p2', quantity: 5, rate: 7499, taxRate: 18 }], status: 'Paid' },
  { id: 'si2', invoiceNumber: 'INV-00002', customerId: 'c2', invoiceDate: '2024-07-18', dueDate: '2024-08-17', items: [{ productId: 'p4', quantity: 2, rate: 19999, taxRate: 18 }], status: 'Unpaid' },
  { id: 'si3', invoiceNumber: 'INV-00003', customerId: 'c1', invoiceDate: '2024-07-20', dueDate: '2024-08-19', items: [{ productId: 'p3', quantity: 3, rate: 29999, taxRate: 28 }], status: 'Unpaid' },
  { id: 'si4', invoiceNumber: 'INV-00004', customerId: 'c3', invoiceDate: '2024-06-10', dueDate: '2024-07-10', items: [{ productId: 'p5', quantity: 1, rate: 39999, taxRate: 18 }], status: 'Overdue' },
];

export const DUMMY_QUOTATIONS: Quotation[] = [
  { id: 'q1', quotationNumber: 'QUO-00001', customerId: 'c2', quoteDate: '2024-07-10', expiryDate: '2024-07-25', items: [{ productId: 'p4', quantity: 2, rate: 19999, taxRate: 18 }], status: 'Accepted' },
  { id: 'q2', quotationNumber: 'QUO-00002', customerId: 'c3', quoteDate: '2024-07-12', expiryDate: '2024-07-27', items: [{ productId: 'p1', quantity: 20, rate: 2499, taxRate: 18 }, { productId: 'p6', quantity: 15, rate: 3999, taxRate: 18 }], status: 'Sent' },
  { id: 'q3', quotationNumber: 'QUO-00003', customerId: 'c1', quoteDate: '2024-07-01', expiryDate: '2024-07-16', items: [{ productId: 'p3', quantity: 5, rate: 29999, taxRate: 28 }], status: 'Invoiced' },
];

export const DUMMY_PURCHASE_INVOICES: PurchaseInvoice[] = [
  { id: 'pi1', invoiceNumber: 'PI-ES-2024-101', supplierId: 's1', purchaseDate: '2024-07-05', items: [{ productId: 'p1', quantity: 100, rate: 1200, taxRate: 18 }, { productId: 'p2', quantity: 50, rate: 4500, taxRate: 18 }], status: 'Unpaid' },
  { id: 'pi2', invoiceNumber: 'PI-OFD-2024-202', supplierId: 's2', purchaseDate: '2024-07-08', items: [{ productId: 'p4', quantity: 20, rate: 12000, taxRate: 18 }], status: 'Paid' },
  { id: 'pi3', invoiceNumber: 'PI-ES-2024-105', supplierId: 's1', purchaseDate: '2024-07-19', items: [{ productId: 'p6', quantity: 150, rate: 2000, taxRate: 18 }], status: 'Paid' },
];


export const DUMMY_COMPANY_DETAILS: CompanyDetails = {
    name: 'LRGP',
    address: {
        line1: '456 Business Avenue',
        line2: 'Industrial Area',
        district: 'Bangalore Urban',
        state: 'Karnataka',
        country: 'India',
        pincode: '560098'
    },
    email: 'billing@zenithinc.com',
    phone: '+91 98765 43210',
    gstin: '29AAAAA0000A1Z5',
    logoUrl: 'https://www.lrgp.in/images/logo.png',
};

// FIX: Added missing properties 'quotationNumberPrefix' and 'nextQuotationNumber' to satisfy the InvoiceSettings type.
export const DUMMY_INVOICE_SETTINGS: InvoiceSettings = {
    accentColor: '#4f46e5', // indigo-600
    notes: 'Thank you for your business!',
    terms: 'Payment is due within 30 days. Late payments are subject to a 2% monthly interest charge.',
    bankDetails: {
        bankName: 'Bank of India',
        accountNumber: '826720110000378',
        ifscCode: 'BKID0008267',
        branch: 'Dindigul',
    },
    invoiceNumberPrefix: 'INV-',
    nextInvoiceNumber: 5,
    quotationNumberPrefix: 'QUO-',
    nextQuotationNumber: 4,
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

// Generate sales data for the last 30 days for chart
export const getSalesForLast30Days = () => {
    const data: { name: string; sales: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        // FIX: Corrected typo from toLocaleDateDateString to toLocaleDateString
        const day = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        // Simulate sales data
        const sales = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
        data.push({ name: day, sales });
    }
    return data;
};