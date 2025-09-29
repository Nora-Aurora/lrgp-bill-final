import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import type { Product, ProductData, StockAdjustment, SalesInvoice, PurchaseInvoice, Quotation } from '../types';
import Modal from '../components/Modal';
import { EditIcon, TrashIcon, ViewIcon } from '../components/icons';
// FIX: Import Column type to strongly type column definitions for DataTable.
import { DataTable, Column } from '../components/DataTable';
import { useSnackbar } from '../hooks/useSnackbar';
import ConfirmationDialog from '../components/ConfirmationDialog';

const CategoryInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: string[];
}> = ({ value, onChange, options }) => {
    const [searchTerm, setSearchTerm] = useState(value);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setSearchTerm(value);
    }, [value]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);
    
    const filteredOptions = options.filter(opt => opt && opt.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSelect = (option: string) => {
        onChange(option);
        setSearchTerm(option);
        setIsDropdownOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        onChange(newValue);
        setIsDropdownOpen(true);
    };

    const showCreateOption = searchTerm.trim() && !options.some(o => o.toLowerCase() === searchTerm.trim().toLowerCase());

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search or add category..."
                className="p-2 border rounded w-full bg-background border-input"
                autoComplete="off"
            />
            {isDropdownOpen && (
                <div className="absolute z-10 w-full bg-card border mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <ul>
                        {filteredOptions.map((opt, index) => (
                            <li key={index} onMouseDown={() => handleSelect(opt)} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm">
                                {opt}
                            </li>
                        ))}
                        {showCreateOption && (
                             <li onMouseDown={() => handleSelect(searchTerm.trim())} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm font-semibold border-t">
                                Create new: "{searchTerm.trim()}"
                            </li>
                        )}
                         {filteredOptions.length === 0 && !showCreateOption && (
                             <li className="px-3 py-2 text-sm text-muted-foreground">No categories found.</li>
                         )}
                    </ul>
                </div>
            )}
        </div>
    );
};


const ProductForm: React.FC<{ product?: Product | null; onSave: () => void; onCancel: () => void; categories: string[]; }> = ({ product, onSave, onCancel, categories }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    hsnCode: product?.hsnCode || '',
    category: product?.category || '',
    salePrice: product?.salePrice?.toString() || '',
    purchasePrice: product?.purchasePrice?.toString() || '',
    taxRate: (product?.taxRate ?? '').toString(),
    stock: (product?.stock ?? '0').toString(),
    reorderPoint: (product?.reorderPoint ?? '0').toString(),
    isService: product?.isService || false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave: ProductData = {
        name: formData.name,
        sku: formData.sku || undefined,
        hsnCode: formData.hsnCode || undefined,
        category: formData.category || undefined,
        salePrice: parseFloat(formData.salePrice) || 0,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
        isService: formData.isService,
        stock: formData.isService ? null : (parseFloat(formData.stock) || 0),
        reorderPoint: formData.isService ? null : (parseFloat(formData.reorderPoint) || 0),
    };

    if (product) {
        if(dataToSave.isService) {
            await api.updateProduct(product.id, dataToSave);
        } else {
            // If it's not a service, we don't update stock from the form on edit.
            const { stock, ...updateData } = dataToSave;
            await api.updateProduct(product.id, updateData);
        }
    } else {
      await api.createProduct(dataToSave);
    }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">{product ? 'Edit Product' : 'Add New Product'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Product Name</label>
                <input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Product Name" className="p-2 border rounded w-full bg-background border-input" required />
            </div>
            <div>
                <label htmlFor="sku" className="block text-sm font-medium text-muted-foreground mb-1">SKU</label>
                <input id="sku" name="sku" value={formData.sku} onChange={handleChange} placeholder="SKU" className="p-2 border rounded w-full bg-background border-input" />
            </div>
             <div>
                <label htmlFor="hsnCode" className="block text-sm font-medium text-muted-foreground mb-1">HSN/SAC Code</label>
                <input id="hsnCode" name="hsnCode" value={formData.hsnCode} onChange={handleChange} placeholder="HSN/SAC Code" className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
                <CategoryInput
                    value={formData.category}
                    onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    options={categories}
                />
            </div>
            <div>
                <label htmlFor="salePrice" className="block text-sm font-medium text-muted-foreground mb-1">Sale Price</label>
                <input id="salePrice" type="number" step="0.01" name="salePrice" value={formData.salePrice} onChange={handleChange} placeholder="Sale Price" className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div>
                <label htmlFor="purchasePrice" className="block text-sm font-medium text-muted-foreground mb-1">Purchase Price</label>
                <input id="purchasePrice" type="number" step="0.01" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} placeholder="Purchase Price" className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div>
                <label htmlFor="taxRate" className="block text-sm font-medium text-muted-foreground mb-1">Tax Rate (%)</label>
                <input id="taxRate" type="number" name="taxRate" value={formData.taxRate} onChange={handleChange} placeholder="Tax Rate (%)" className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div className="flex items-center pt-6">
                <input id="isService" type="checkbox" name="isService" checked={formData.isService} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <label htmlFor="isService" className="ml-2 block text-sm font-medium text-muted-foreground">Set as Service (disables stock management)</label>
            </div>
            <div>
                <label htmlFor="stock" className="block text-sm font-medium text-muted-foreground mb-1">Stock Quantity</label>
                <input id="stock" type="number" name="stock" value={formData.stock} onChange={handleChange} placeholder="Initial Stock Quantity" className="p-2 border rounded w-full bg-background border-input" disabled={!!product || formData.isService} />
                {product && !formData.isService && <p className="text-xs text-muted-foreground mt-1">Stock is managed via Stock Adjustments after creation.</p>}
            </div>
            <div>
                <label htmlFor="reorderPoint" className="block text-sm font-medium text-muted-foreground mb-1">Reorder Point</label>
                <input id="reorderPoint" type="number" name="reorderPoint" value={formData.reorderPoint} onChange={handleChange} placeholder="Reorder Point" className="p-2 border rounded w-full bg-background border-input" disabled={formData.isService} />
            </div>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onCancel} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Cancel</button>
            <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">{product ? 'Update' : 'Save'}</button>
        </div>
    </form>
  );
};

const ProductDetailsView: React.FC<{ product: Product }> = ({ product }) => (
    <div className="space-y-4">
        <h2 className="text-2xl font-bold">{product.name}</h2>
        {product.isService && <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Service</span>}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div className="space-y-1">
                <p className="text-muted-foreground">SKU</p>
                <p className="font-medium">{product.sku}</p>
            </div>
             <div className="space-y-1">
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{product.category}</p>
            </div>
             <div className="space-y-1">
                <p className="text-muted-foreground">HSN/SAC</p>
                <p className="font-medium">{product.hsnCode}</p>
            </div>
             <div className="space-y-1">
                <p className="text-muted-foreground">Tax Rate</p>
                <p className="font-medium">{product.taxRate}%</p>
            </div>
            <div className="space-y-1">
                <p className="text-muted-foreground">Sale Price</p>
                <p className="font-medium">{product.salePrice.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
            </div>
            <div className="space-y-1">
                <p className="text-muted-foreground">Purchase Price</p>
                <p className="font-medium">{product.purchasePrice.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
            </div>
            {!product.isService && (
                <>
                 <div className="space-y-1">
                    <p className="text-muted-foreground">Current Stock</p>
                    <p className={`font-bold text-lg ${product.stock !== null && product.reorderPoint !== null && product.stock <= product.reorderPoint ? 'text-red-500' : 'text-green-600'}`}>{product.stock}</p>
                </div>
                 <div className="space-y-1">
                    <p className="text-muted-foreground">Reorder Point</p>
                    <p className="font-medium">{product.reorderPoint}</p>
                </div>
                </>
            )}
        </div>
    </div>
);


const StockAdjustmentForm: React.FC<{ products: Product[]; onSave: () => void; onCancel: () => void; }> = ({ products, onSave, onCancel }) => {
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const { showSnackbar } = useSnackbar();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericQuantity = parseInt(quantity, 10) || 0;
        
        if (!productId || numericQuantity === 0) {
            showSnackbar("Please select a product and enter a non-zero quantity.", "error");
            return;
        }

        if (numericQuantity < 0) {
            const product = products.find(p => p.id === productId);
            if (product && product.stock !== null && (product.stock + numericQuantity < 0)) {
                showSnackbar(`Adjustment failed. Current stock for "${product.name}" is ${product.stock}. Stock cannot go below zero.`, 'error');
                return;
            }
        }
        
        try {
            await api.adjustProductStock(productId, numericQuantity, reason);
            onSave();
        } catch (error) {
             console.error(error);
             showSnackbar(error instanceof Error ? error.message : 'An unknown error occurred during stock adjustment.', 'error');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold">Make Stock Entry</h2>
            <div>
                <label htmlFor="productId" className="block text-sm font-medium text-muted-foreground mb-1">Product</label>
                <select id="productId" value={productId} onChange={e => setProductId(e.target.value)} className="p-2 border rounded w-full bg-background border-input" required>
                    <option value="">Select a product</option>
                    {products.filter(p => !p.isService).map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) - Current: {p.stock}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-muted-foreground mb-1">Adjustment Quantity</label>
                <input id="quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g., 10 (add) or -5 (remove)" className="p-2 border rounded w-full bg-background border-input" required />
            </div>
            <div>
                <label htmlFor="reason" className="block text-sm font-medium text-muted-foreground mb-1">Reason for Entry</label>
                <input id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., stock count, spoilage, goods returned" className="p-2 border rounded w-full bg-background border-input" required />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={onCancel} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Cancel</button>
                <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">Save Entry</button>
            </div>
        </form>
    )
}


const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'adjustments'>('products');
  const [recordToDelete, setRecordToDelete] = useState<Product | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<React.ReactNode>('');
  const { showSnackbar } = useSnackbar();
  
  const [filters, setFilters] = useState({ category: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const [productsData, adjustmentsData, salesData, purchaseData, quoteData] = await Promise.all([
            api.getProducts(),
            api.getStockAdjustments(),
            api.getSalesInvoices(),
            api.getPurchaseInvoices(),
            api.getQuotations(),
        ]);
        setProducts(productsData.sort((a, b) => b.id.localeCompare(a.id)));
        setAdjustments(adjustmentsData.sort((a, b) => b.id.localeCompare(a.id)));
        setSalesInvoices(salesData);
        setPurchaseInvoices(purchaseData);
        setQuotations(quoteData);
    } catch(error) {
        console.error("Failed to fetch inventory data:", error);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => filters.category ? p.category === filters.category : true);
  }, [products, filters]);

  const uniqueCategories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))] as string[], [products]);

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };
  
  const handleView = (product: Product) => {
    setViewingProduct(product);
  };

  const handleOpenDeleteDialog = (product: Product) => {
    const linkedSales = salesInvoices.filter(inv => inv.items.some(item => item.productId === product.id)).length;
    const linkedPurchases = purchaseInvoices.filter(inv => inv.items.some(item => item.productId === product.id)).length;
    const linkedQuotes = quotations.filter(q => q.items.some(item => item.productId === product.id)).length;

    let messageParts = [`Are you sure you want to delete '${product.name}'?`];
    const links = [];
    if (linkedSales > 0) links.push(`${linkedSales} sales invoices`);
    if (linkedPurchases > 0) links.push(`${linkedPurchases} purchase invoices`);
    if (linkedQuotes > 0) links.push(`${linkedQuotes} quotations`);

    if (links.length > 0) {
        messageParts.push(`\n\nThis product is linked to ${links.join(', ')}.`);
        messageParts.push(`\nDeleting it will mark it as '[Deleted]' in these records.`);
    }
    
    messageParts.push(`\n\nAll stock adjustment history for this item will also be permanently deleted. This action cannot be undone.`);

    setRecordToDelete(product);
    setDeleteMessage(messageParts.join(''));
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const success = await api.deleteProduct(recordToDelete.id);
    if (success) {
        showSnackbar(`Product '${recordToDelete.name}' deleted successfully.`, 'success');
        fetchData();
    } else {
        showSnackbar(`Failed to delete product '${recordToDelete.name}'.`, 'error');
    }
    setRecordToDelete(null);
  };

  const handleSave = () => {
    setIsModalOpen(false);
    setIsAdjustmentModalOpen(false);
    setEditingProduct(null);
    fetchData();
  };
  
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'Unknown Product';

  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const productColumns: Column<Product>[] = [
    { header: 'Item Name', accessor: 'name', isSortable: true, render: (p: Product) => (
        <div>
          <span className="font-medium text-primary">{p.name}</span>
          {p.isService && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Service</span>}
        </div>
    ) },
    { header: 'SKU', accessor: 'sku', isSortable: true },
    { header: 'HSN/SAC', accessor: 'hsnCode', isSortable: false },
    { header: 'Category', accessor: 'category', isSortable: true },
    { header: 'Sale Price', accessor: 'salePrice', isSortable: true, render: (p: Product) => p.salePrice.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    { header: 'Stock', accessor: 'stock', isSortable: true, render: (p: Product) => p.isService ? <span className="text-muted-foreground">N/A</span> : <span className={`font-bold ${p.stock !== null && p.reorderPoint !== null && p.stock <= p.reorderPoint ? 'text-red-500' : 'text-green-600'}`}>{p.stock}</span> },
  ];

  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const adjustmentColumns: Column<StockAdjustment>[] = [
      { header: 'Date', accessor: 'date', isSortable: true, render: (a: StockAdjustment) => new Date(a.date).toLocaleString() },
      { header: 'Product', accessor: 'productId', isSortable: true, render: (a: StockAdjustment) => getProductName(a.productId) },
      { header: 'Quantity Change', accessor: 'quantityChange', isSortable: true, render: (a: StockAdjustment) => <span className={`font-bold ${a.quantityChange > 0 ? 'text-green-600' : 'text-red-500'}`}>{a.quantityChange > 0 ? `+${a.quantityChange}` : a.quantityChange}</span> },
      { header: 'Reason', accessor: 'reason', isSortable: false },
  ];

  return (
    <div className="space-y-6">
       <ConfirmationDialog
            isOpen={!!recordToDelete}
            onClose={() => setRecordToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Confirm Deletion"
            message={deleteMessage}
            confirmButtonText="Delete"
            confirmButtonVariant="destructive"
        />
       {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
            <ProductForm product={editingProduct} onSave={handleSave} onCancel={() => setIsModalOpen(false)} categories={uniqueCategories} />
        </Modal>
       )}
       {isAdjustmentModalOpen && (
        <Modal onClose={() => setIsAdjustmentModalOpen(false)}>
            <StockAdjustmentForm products={products} onSave={handleSave} onCancel={() => setIsAdjustmentModalOpen(false)} />
        </Modal>
       )}
        {viewingProduct && (
        <Modal onClose={() => setViewingProduct(null)}>
            <ProductDetailsView product={viewingProduct} />
        </Modal>
       )}

      <div className="flex justify-between items-center">
        <div className="flex border-b border-border">
          <button onClick={() => setActiveTab('products')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'products' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
            Product Master
          </button>
          <button onClick={() => setActiveTab('adjustments')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'adjustments' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
            Stock Adjustments
          </button>
        </div>
        <div className="space-x-2">
            <button onClick={() => setIsAdjustmentModalOpen(true)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-sm">
              Make Stock Entry
            </button>
            <button onClick={handleAddNew} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm">
              Add New Product
            </button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        activeTab === 'products' ? (
             <DataTable
                columns={productColumns}
                data={filteredProducts}
                renderActions={(product) => (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleView(product)} className="p-1 hover:bg-muted rounded-md" title="View"><ViewIcon /></button>
                      <button onClick={() => handleEdit(product)} className="p-1 hover:bg-muted rounded-md" title="Edit"><EditIcon /></button>
                      <button onClick={() => handleOpenDeleteDialog(product)} className="p-1 hover:bg-muted rounded-md" title="Delete"><TrashIcon /></button>
                    </div>
                )}
                filterConfig={
                    <select name="category" value={filters.category} onChange={e => setFilters({category: e.target.value})} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm">
                        <option value="">All Categories</option>
                        {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                }
                searchConfig={{ placeholder: "Search by Name or SKU...", searchKeys: ['name', 'sku'] }}
            />
        ) : (
            <DataTable
                columns={adjustmentColumns}
                data={adjustments}
                renderActions={() => <div />} // No actions for adjustments log
                searchConfig={{ placeholder: "Search by Reason...", searchKeys: ['reason'] }}
            />
        )
      )}
    </div>
  );
};

export default Inventory;