import { DUMMY_PRODUCTS, DUMMY_CUSTOMERS, DUMMY_SUPPLIERS, DUMMY_SALES_INVOICES, DUMMY_QUOTATIONS, DUMMY_PURCHASE_INVOICES, DUMMY_COMPANY_DETAILS, DUMMY_INVOICE_SETTINGS } from './constants';
import initSqlJs, { SqlJsStatic } from 'sql.js';
// @ts-ignore - Vite will handle this asset import
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { AppSettings, Product, ProductData, Customer, CustomerData, Supplier, SupplierData, SalesInvoice, SalesInvoiceData, Quotation, QuotationData, PurchaseInvoice, PurchaseInvoiceData, StockAdjustment, StockAdjustmentData, InvoiceItem } from './types';

// FIX: Renamed `db` to `_db` to avoid redeclaration error with exported `db` object.
let _db: any = null;
let isInitialized = false;

// --- IndexedDB Helpers ---
const IDB_NAME = 'lrgp_sqlite_db';
const IDB_STORE = 'db_file_store';
const IDB_KEY = 'db_file';

const openIdb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveDbToIdb = async (database: any) => {
  const data = database.export();
  const idb = await openIdb();
  const tx = idb.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(data, IDB_KEY);
  return new Promise<void>(resolve => { tx.oncomplete = () => resolve(); });
};

const loadDbFromIdb = async (): Promise<Uint8Array | undefined> => {
  const idb = await openIdb();
  const tx = idb.transaction(IDB_STORE, 'readonly');
  const request = tx.objectStore(IDB_STORE).get(IDB_KEY);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
  });
};


// --- DB Initialization ---
const init = async () => {
    if (isInitialized) return;
    try {
        const SQL: SqlJsStatic = await initSqlJs({ locateFile: () => wasmUrl });
        const dbData = await loadDbFromIdb();
        if (dbData) {
            console.log("Loading database from IndexedDB...");
            _db = new SQL.Database(dbData);
        } else {
            console.log("Creating new database...");
            _db = new SQL.Database();
            createTables();
            seedDatabase();
            await saveDbToIdb(_db);
        }
        isInitialized = true;
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
};

const createTables = () => {
  _db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, sku TEXT, hsnCode TEXT, category TEXT, salePrice REAL, purchasePrice REAL, taxRate REAL, stock REAL, reorderPoint REAL, isService INTEGER DEFAULT 0);
    CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, billingAddress TEXT, shippingAddress TEXT, gstin TEXT);
    CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, address TEXT, gstin TEXT);
    CREATE TABLE sales_invoices (id TEXT PRIMARY KEY, invoiceNumber TEXT, customerId TEXT, invoiceDate TEXT, dueDate TEXT, items TEXT, status TEXT, amountPaid REAL);
    CREATE TABLE quotations (id TEXT PRIMARY KEY, quotationNumber TEXT, customerId TEXT, quoteDate TEXT, expiryDate TEXT, items TEXT, status TEXT);
    CREATE TABLE purchase_invoices (id TEXT PRIMARY KEY, invoiceNumber TEXT, supplierId TEXT, purchaseDate TEXT, items TEXT, status TEXT, amountPaid REAL);
    CREATE TABLE stock_adjustments (id TEXT PRIMARY KEY, productId TEXT, date TEXT, quantityChange REAL, reason TEXT);
  `);
};

const seedDatabase = () => {
    console.log("Seeding database with initial data...");
    _db.exec("BEGIN TRANSACTION;");
    try {
        _db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(['companyDetails', JSON.stringify(DUMMY_COMPANY_DETAILS)]);
        _db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(['invoiceSettings', JSON.stringify(DUMMY_INVOICE_SETTINGS)]);

        // const productStmt = _db.prepare("INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        // DUMMY_PRODUCTS.forEach(p => productStmt.run([p.id, p.name, p.sku, p.hsnCode, p.category, p.salePrice, p.purchasePrice, p.taxRate, p.stock, p.reorderPoint, p.isService ? 1 : 0]));
        
        // const customerStmt = _db.prepare("INSERT INTO customers VALUES (?,?,?,?,?,?,?)");
        // DUMMY_CUSTOMERS.forEach(c => customerStmt.run([c.id, c.name, c.email, c.phone, JSON.stringify(c.billingAddress), JSON.stringify(c.shippingAddress), c.gstin]));
        
        // const supplierStmt = _db.prepare("INSERT INTO suppliers VALUES (?,?,?,?,?,?)");
        // DUMMY_SUPPLIERS.forEach(s => supplierStmt.run([s.id, s.name, s.email, s.phone, JSON.stringify(s.address), s.gstin]));

        // const salesStmt = _db.prepare("INSERT INTO sales_invoices VALUES (?,?,?,?,?,?,?,?)");
        // DUMMY_SALES_INVOICES.forEach(i => salesStmt.run([i.id, i.invoiceNumber, i.customerId, i.invoiceDate, i.dueDate, JSON.stringify(i.items), i.status, i.amountPaid || 0]));
        
        // const quoteStmt = _db.prepare("INSERT INTO quotations VALUES (?,?,?,?,?,?,?)");
        // DUMMY_QUOTATIONS.forEach(q => quoteStmt.run([q.id, q.quotationNumber, q.customerId, q.quoteDate, q.expiryDate, JSON.stringify(q.items), q.status]));

        // const purchaseStmt = _db.prepare("INSERT INTO purchase_invoices VALUES (?,?,?,?,?,?,?)");
        // DUMMY_PURCHASE_INVOICES.forEach(p => purchaseStmt.run([p.id, p.invoiceNumber, p.supplierId, p.purchaseDate, JSON.stringify(p.items), p.status, p.amountPaid || 0]));

        _db.exec("COMMIT;");
    } catch (e) {
        console.error("Seeding failed:", e);
        _db.exec("ROLLBACK;");
    }
};

const parseJsonFields = (obj: any, fields: string[]) => {
    if (!obj) return obj;
    const newObj = { ...obj };
    fields.forEach(field => {
        if (newObj[field] && typeof newObj[field] === 'string') {
            try { newObj[field] = JSON.parse(newObj[field]); } catch(e) { console.error(`Failed to parse JSON for field ${field}`, e); }
        }
    });
    return newObj;
};

// --- DB Export/Import ---
const exportDb = (): Uint8Array => _db.export();

const importDb = async (data: Uint8Array) => {
    const SQL: SqlJsStatic = await initSqlJs({ locateFile: () => wasmUrl });
    _db = new SQL.Database(data);
    await saveDbToIdb(_db);
};


// --- Stores ---
const settingsStore = {
    async get(): Promise<AppSettings> {
        // Ensure table exists in case of legacy DBs
        _db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);

        const companyRow = _db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject(['companyDetails']);
        const invoiceRow = _db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject(['invoiceSettings']);

        let companyDetails;
        let invoiceSettings;

        try {
            companyDetails = companyRow && (companyRow as any).value ? JSON.parse((companyRow as any).value as string) : DUMMY_COMPANY_DETAILS;
        } catch (e) {
            console.warn('Invalid companyDetails JSON in DB. Resetting to defaults.');
            companyDetails = DUMMY_COMPANY_DETAILS;
        }

        try {
            invoiceSettings = invoiceRow && (invoiceRow as any).value ? JSON.parse((invoiceRow as any).value as string) : DUMMY_INVOICE_SETTINGS;
        } catch (e) {
            console.warn('Invalid invoiceSettings JSON in DB. Resetting to defaults.');
            invoiceSettings = DUMMY_INVOICE_SETTINGS;
        }

        // If any missing, persist defaults so subsequent reads are fast
        _db.exec('BEGIN TRANSACTION;');
        try {
            _db.prepare("REPLACE INTO settings (key, value) VALUES (?,?)").run(['companyDetails', JSON.stringify(companyDetails)]);
            _db.prepare("REPLACE INTO settings (key, value) VALUES (?,?)").run(['invoiceSettings', JSON.stringify(invoiceSettings)]);
            _db.exec('COMMIT;');
            await saveDbToIdb(_db);
        } catch (e) {
            _db.exec('ROLLBACK;');
        }

        return { companyDetails, invoiceSettings } as AppSettings;
    },
    async update(data: Partial<AppSettings>): Promise<AppSettings> {
        const current = await this.get();
        const newSettings = {
            companyDetails: { ...current.companyDetails, ...(data.companyDetails || {}) },
            invoiceSettings: { ...current.invoiceSettings, ...(data.invoiceSettings || {}) },
        };
        _db.prepare("REPLACE INTO settings (key, value) VALUES (?,?)").run(['companyDetails', JSON.stringify(newSettings.companyDetails)]);
        _db.prepare("REPLACE INTO settings (key, value) VALUES (?,?)").run(['invoiceSettings', JSON.stringify(newSettings.invoiceSettings)]);
        await saveDbToIdb(_db);
        return newSettings as AppSettings;
    }
};

const createStore = <T extends { id: string }, TData>(
    tableName: string, 
    fields: (keyof TData | 'id')[],
    jsonFields: string[] = []
) => ({
    async getAll(): Promise<T[]> {
        const stmt = _db.prepare(`SELECT * FROM ${tableName}`);
        const results: T[] = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            if ('isService' in row && typeof row.isService === 'number') {
                (row as any).isService = row.isService === 1;
            }
            results.push(parseJsonFields(row, jsonFields) as T);
        }
        stmt.free();
        return results;
    },
    async getById(id: string): Promise<T | undefined> {
        const stmt = _db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
        stmt.bind([id]);
        let result: T | undefined = undefined;
        if (stmt.step()) {
            const row = stmt.getAsObject();
            if ('isService' in row && typeof row.isService === 'number') {
                (row as any).isService = row.isService === 1;
            }
            result = parseJsonFields(row, jsonFields) as T;
        }
        stmt.free();
        return result;
    },
    async create(data: TData): Promise<T> {
        const id = `${tableName.slice(0, 2)}-${Date.now()}`;
        // FIX: Changed type assertion to `as unknown as T` to fix complex generic conversion error.
        const newItem = { id, ...data } as unknown as T;
        const placeholders = fields.map(() => '?').join(',');
        const fieldNames = fields.join(',');
        const values = fields.map(f => {
            const val = (newItem as any)[f];
            if (jsonFields.includes(f as string)) {
                return JSON.stringify(val || null);
            }
            return val === undefined ? null : val;
        });
        _db.prepare(`INSERT INTO ${tableName} (${fieldNames}) VALUES (${placeholders})`).run(values);
        await saveDbToIdb(_db);
        return parseJsonFields(newItem, jsonFields);
    },
    async update(id: string, data: Partial<TData>): Promise<T | undefined> {
        const fieldEntries = Object.entries(data);
        if (fieldEntries.length === 0) return this.getById(id);
        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([key, val]) => {
            if (jsonFields.includes(key as string)) {
                return JSON.stringify(val || null);
            }
            return val === undefined ? null : val;
        });
        _db.prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`).run([...values, id]);
        await saveDbToIdb(_db);
        return this.getById(id);
    },
    async delete(id: string): Promise<boolean> {
        _db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run([id]);
        await saveDbToIdb(_db);
        return true;
    }
});

const productStore = {
    ...createStore<Product, ProductData>('products', ['id', 'name', 'sku', 'hsnCode', 'category', 'salePrice', 'purchasePrice', 'taxRate', 'stock', 'reorderPoint', 'isService']),
    async adjustStock(productId: string, quantity: number, reason: string): Promise<Product | undefined> {
        _db.exec("BEGIN TRANSACTION;");
        try {
            const productStmt = _db.prepare("SELECT stock FROM products WHERE id = ?");
            productStmt.bind([productId]);
            let currentStock: number | undefined;
            if (productStmt.step()) {
                const result = productStmt.getAsObject();
                currentStock = result.stock as number;
            }
            productStmt.free();

            if (currentStock === undefined) {
                throw new Error(`Product with id ${productId} not found.`);
            }

            if (quantity < 0 && (currentStock + quantity < 0)) {
                throw new Error(`Stock cannot be negative. Current stock is ${currentStock}, but adjustment is ${quantity}.`);
            }

            _db.prepare("INSERT INTO stock_adjustments VALUES (?,?,?,?,?)").run([`sa-${Date.now()}`, productId, new Date().toISOString(), quantity, reason]);
            _db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run([quantity, productId]);
            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return this.getById(productId);
        } catch(e) {
            _db.exec("ROLLBACK;");
            console.error("Stock adjustment transaction failed", e);
            throw e;
        }
    },
    async delete(id: string): Promise<boolean> {
        const productToDelete = await this.getById(id);
        if (!productToDelete) return false;

        _db.exec("BEGIN TRANSACTION;");
        try {
            const updateLinkedItems = (table: string) => {
                const selectStmt = _db.prepare(`SELECT id, items FROM ${table}`);
                const toUpdate: { id: string; items: string }[] = [];
                while (selectStmt.step()) {
                    const row = selectStmt.getAsObject();
                    let items: InvoiceItem[];
                    try {
                        items = JSON.parse(row.items as string);
                    } catch (e) {
                        console.warn(`Could not parse items for ${table} id ${row.id}`);
                        continue;
                    }
                    
                    let wasModified = false;
                    const newItems = items.map(item => {
                        if (item.productId === id) {
                            wasModified = true;
                            return {
                                ...item,
                                productId: undefined,
                                customItemName: `[Deleted] ${productToDelete.name}`,
                            };
                        }
                        return item;
                    });
                    if (wasModified) {
                        toUpdate.push({ id: row.id as string, items: JSON.stringify(newItems) });
                    }
                }
                selectStmt.free();

                if (toUpdate.length > 0) {
                    const updateStmt = _db.prepare(`UPDATE ${table} SET items = ? WHERE id = ?`);
                    toUpdate.forEach(doc => updateStmt.run([doc.items, doc.id]));
                    updateStmt.free();
                }
            };
            
            updateLinkedItems('sales_invoices');
            updateLinkedItems('purchase_invoices');
            updateLinkedItems('quotations');
            
            _db.prepare(`DELETE FROM stock_adjustments WHERE productId = ?`).run([id]);

            _db.prepare(`DELETE FROM products WHERE id = ?`).run([id]);

            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return true;
        } catch (e) {
            _db.exec("ROLLBACK;");
            console.error("Delete product transaction failed", e);
            return false;
        }
    }
};

const customerStore = {
    ...createStore<Customer, CustomerData>('customers', ['id', 'name', 'email', 'phone', 'billingAddress', 'shippingAddress', 'gstin'], ['billingAddress', 'shippingAddress']),
    async delete(id: string): Promise<boolean> {
        try {
            const salesStmt = _db.prepare(`SELECT 1 FROM sales_invoices WHERE customerId = ? LIMIT 1`);
            if (salesStmt.step([id])) {
                salesStmt.free();
                console.error(`Attempted to delete customer ${id} with linked sales invoices.`);
                return false;
            }
            salesStmt.free();

            const quoteStmt = _db.prepare(`SELECT 1 FROM quotations WHERE customerId = ? LIMIT 1`);
            if (quoteStmt.step([id])) {
                quoteStmt.free();
                console.error(`Attempted to delete customer ${id} with linked quotations.`);
                return false;
            }
            quoteStmt.free();

            _db.prepare(`DELETE FROM customers WHERE id = ?`).run([id]);
            await saveDbToIdb(_db);
            return true;
        } catch (e) {
            console.error(`Failed to delete customer ${id}`, e);
            return false;
        }
    }
};

const supplierStore = {
    ...createStore<Supplier, SupplierData>('suppliers', ['id', 'name', 'email', 'phone', 'address', 'gstin'], ['address']),
    async delete(id: string): Promise<boolean> {
        try {
            const purchaseStmt = _db.prepare(`SELECT 1 FROM purchase_invoices WHERE supplierId = ? LIMIT 1`);
            if (purchaseStmt.step([id])) {
                purchaseStmt.free();
                console.error(`Attempted to delete supplier ${id} with linked purchase invoices.`);
                return false;
            }
            purchaseStmt.free();

            _db.prepare(`DELETE FROM suppliers WHERE id = ?`).run([id]);
            await saveDbToIdb(_db);
            return true;
        } catch (e) {
            console.error(`Failed to delete supplier ${id}`, e);
            return false;
        }
    }
};
const quotationStore = createStore<Quotation, QuotationData>('quotations', ['id', 'quotationNumber', 'customerId', 'quoteDate', 'expiryDate', 'items', 'status'], ['items']);
const stockAdjustmentStore = createStore<StockAdjustment, StockAdjustmentData>('stock_adjustments', ['id', 'productId', 'date', 'quantityChange', 'reason']);

const salesInvoiceStore = {
    ...createStore<SalesInvoice, SalesInvoiceData>('sales_invoices', ['id', 'invoiceNumber', 'customerId', 'invoiceDate', 'dueDate', 'items', 'status', 'amountPaid'], ['items']),
    async create(data: SalesInvoiceData): Promise<SalesInvoice> {
        const id = `si-${Date.now()}`;
        const newItem = { id, ...data };
        _db.exec("BEGIN TRANSACTION;");
        try {
            _db.prepare("INSERT INTO sales_invoices VALUES (?,?,?,?,?,?,?,?)").run([id, newItem.invoiceNumber, newItem.customerId, newItem.invoiceDate, newItem.dueDate, JSON.stringify(newItem.items), newItem.status, newItem.amountPaid || 0]);
            newItem.items.forEach(item => {
                if (item.productId) {
                    _db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run([item.quantity, item.productId]);
                }
            });
            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return parseJsonFields(newItem, ['items']) as SalesInvoice;
        } catch (e) {
            _db.exec("ROLLBACK;");
            console.error("Create sales invoice transaction failed", e);
            throw e;
        }
    },
    async update(id: string, data: Partial<SalesInvoiceData>): Promise<SalesInvoice | undefined> {
        const oldInvoice = await this.getById(id);
        if (!oldInvoice) return undefined;
        _db.exec("BEGIN TRANSACTION;");
        try {
            oldInvoice.items.forEach(item => {
                if (item.productId) _db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run([item.quantity, item.productId]);
            });
            const newItems = data.items || oldInvoice.items;
            newItems.forEach(item => {
                if (item.productId) _db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run([item.quantity, item.productId]);
            });
            
            const fieldEntries = Object.entries(data);
            const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
            const values = fieldEntries.map(([key, val]) => {
                if (key === 'items') {
                    return JSON.stringify(val || null);
                }
                return val === undefined ? null : val;
            });
            _db.prepare(`UPDATE sales_invoices SET ${setClause} WHERE id = ?`).run([...values, id]);

            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return this.getById(id);
        } catch(e) {
            _db.exec("ROLLBACK;");
            console.error("Update sales invoice transaction failed", e);
            throw e;
        }
    },
    async delete(id: string): Promise<boolean> {
        const invoice = await this.getById(id);
        if (!invoice) return false;
        _db.exec("BEGIN TRANSACTION;");
        try {
            invoice.items.forEach(item => {
                if(item.productId) _db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run([item.quantity, item.productId]);
            });
            _db.prepare("DELETE FROM sales_invoices WHERE id = ?").run([id]);
            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return true;
        } catch(e) {
            _db.exec("ROLLBACK;");
            console.error("Delete sales invoice transaction failed", e);
            return false;
        }
    }
};

const purchaseInvoiceStore = {
    ...createStore<PurchaseInvoice, PurchaseInvoiceData>('purchase_invoices', ['id', 'invoiceNumber', 'supplierId', 'purchaseDate', 'items', 'status', 'amountPaid'], ['items']),
    async create(data: PurchaseInvoiceData): Promise<PurchaseInvoice> {
        const id = `pi-${Date.now()}`;
        const newItem = { id, ...data };
        _db.exec("BEGIN TRANSACTION;");
        try {
            _db.prepare("INSERT INTO purchase_invoices VALUES (?,?,?,?,?,?,?)").run([id, newItem.invoiceNumber, newItem.supplierId, newItem.purchaseDate, JSON.stringify(newItem.items), newItem.status, newItem.amountPaid || 0]);
            newItem.items.forEach(item => {
                if (item.productId) {
                    _db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run([item.quantity, item.productId]);
                }
            });
            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return parseJsonFields(newItem, ['items']) as PurchaseInvoice;
        } catch (e) {
            _db.exec("ROLLBACK;");
            console.error("Create purchase invoice transaction failed", e);
            throw e;
        }
    },
    async update(id: string, data: Partial<PurchaseInvoiceData>): Promise<PurchaseInvoice | undefined> {
        const oldInvoice = await this.getById(id);
        if (!oldInvoice) return undefined;
        _db.exec("BEGIN TRANSACTION;");
        try {
            oldInvoice.items.forEach(item => {
                if (item.productId) _db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run([item.quantity, item.productId]);
            });
            const newItems = data.items || oldInvoice.items;
            newItems.forEach(item => {
                if (item.productId) _db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run([item.quantity, item.productId]);
            });
            
            const fieldEntries = Object.entries(data);
            const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
            const values = fieldEntries.map(([key, val]) => {
                if (key === 'items') {
                    return JSON.stringify(val || null);
                }
                return val === undefined ? null : val;
            });
            _db.prepare(`UPDATE purchase_invoices SET ${setClause} WHERE id = ?`).run([...values, id]);

            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return this.getById(id);
        } catch(e) {
            _db.exec("ROLLBACK;");
            console.error("Update purchase invoice transaction failed", e);
            throw e;
        }
    },
    async delete(id: string): Promise<boolean> {
        const invoice = await this.getById(id);
        if (!invoice) return false;
        _db.exec("BEGIN TRANSACTION;");
        try {
            invoice.items.forEach(item => {
                if(item.productId) _db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run([item.quantity, item.productId]);
            });
            _db.prepare("DELETE FROM purchase_invoices WHERE id = ?").run([id]);
            _db.exec("COMMIT;");
            await saveDbToIdb(_db);
            return true;
        } catch(e) {
            _db.exec("ROLLBACK;");
            console.error("Delete purchase invoice transaction failed", e);
            return false;
        }
    }
};

export const db = {
  init,
  exportDb,
  importDb,
  products: productStore,
  customers: customerStore,
  suppliers: supplierStore,
  salesInvoices: salesInvoiceStore,
  quotations: quotationStore,
  purchaseInvoices: purchaseInvoiceStore,
  stockAdjustments: stockAdjustmentStore,
  settings: settingsStore,
};