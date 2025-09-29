import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../api';
import type { PurchaseInvoice, Supplier, Product, InvoiceItem, PurchaseInvoiceData, Address } from '../types';
import { EditIcon, TrashIcon, PlusIcon, XIcon, ViewIcon } from '../components/icons';
import Modal from '../components/Modal';
// FIX: Import Column type to strongly type column definitions for DataTable.
import { DataTable, Column } from '../components/DataTable';
import { SupplierForm } from './Contacts';
import { useSnackbar } from '../hooks/useSnackbar';
import ConfirmationDialog from '../components/ConfirmationDialog';

// A timezone-safe way to parse 'YYYY-MM-DD' strings from date inputs
const safeParseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
    }
  }
  return new Date(dateString); // Fallback for other formats
};

type FormItem = {
    id: number;
    productId: string;
    customItemName: string;
    hsnCode: string;
    quantity: string;
    rate: string;
    taxRate: string;
};

const ProductItemInput: React.FC<{
    item: FormItem;
    products: Product[];
    onItemChange: (itemId: number, field: keyof Omit<FormItem, 'id'>, value: string) => void;
}> = ({ item, products, onItemChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (item.productId && item.productId !== 'custom') {
            const selectedProduct = products.find(p => p.id === item.productId);
            setSearchTerm(selectedProduct?.name || '');
        } else if(item.productId === '' && !item.customItemName) {
            setSearchTerm('');
        } else {
             setSearchTerm(item.customItemName);
        }
    }, [item.productId, item.customItemName, products]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
                if (!item.productId) {
                    setSearchTerm('');
                } else {
                    const selectedProduct = products.find(p => p.id === item.productId);
                    setSearchTerm(selectedProduct?.name || item.customItemName || '');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [item.productId, item.customItemName, products, wrapperRef]);
    
    if (item.productId === 'custom') {
        return (
            <input
                type="text"
                autoFocus
                value={item.customItemName}
                onChange={e => {
                    const value = e.target.value;
                    onItemChange(item.id, 'customItemName', value);
                    if (value === '') {
                        onItemChange(item.id, 'productId', '');
                    }
                }}
                placeholder="Custom Item Name"
                className="p-2 border rounded w-full bg-background border-input"
            />
        );
    }

     // Handle case where product was deleted
    if (!item.productId && item.customItemName) {
        return (
            <input
                type="text"
                value={item.customItemName}
                disabled
                className="p-2 border rounded w-full bg-muted border-input italic"
            />
        );
    }

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSelectProduct = (product: Product | 'custom') => {
        setIsDropdownOpen(false);
        if (product === 'custom') {
            onItemChange(item.id, 'productId', 'custom');
        } else {
            setSearchTerm(product.name);
            onItemChange(item.id, 'productId', product.id);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={searchTerm}
                onChange={e => {
                    setSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                    if (item.productId && item.productId !== 'custom') {
                        onItemChange(item.id, 'productId', '');
                    }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search or select a product..."
                className="p-2 border rounded w-full bg-background border-input"
            />
            {isDropdownOpen && (
                <div className="absolute z-10 w-full bg-card border mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <ul>
                        {filteredProducts.map(p => (
                            <li key={p.id} onMouseDown={() => handleSelectProduct(p)} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm">
                                {p.name}
                            </li>
                        ))}
                        <li onMouseDown={() => handleSelectProduct('custom')} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm font-semibold border-t">
                            -- Custom Item --
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

// Form Component for Purchase Invoice
const PurchaseForm: React.FC<{
  record?: PurchaseInvoice | null;
  suppliers: Supplier[];
  products: Product[];
  onSave: () => void;
  onCancel: () => void;
  onDataRefresh: () => void;
}> = ({ record, suppliers, products, onSave, onCancel, onDataRefresh }) => {
  const { showSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
    supplierId: record?.supplierId || '',
    purchaseDate: record?.purchaseDate || new Date().toISOString().split('T')[0],
    invoiceNumber: record?.invoiceNumber || '',
    status: record?.status || 'Unpaid',
    amountPaid: (record?.amountPaid || '').toString(),
  });
  
  const [items, setItems] = useState<FormItem[]>(
    record?.items.map((item, index) => ({
        id: index,
        productId: item.productId || 'custom',
        customItemName: item.customItemName || '',
        hsnCode: item.hsnCode || '',
        quantity: item.quantity.toString(),
        rate: item.rate.toString(),
        taxRate: (item.taxRate || 0).toString(),
    })) || [{ id: Date.now(), productId: '', customItemName: '', hsnCode: '', quantity: '1', rate: '', taxRate: '' }]
  );
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)), 0), [items]);
  const totalTax = useMemo(() => items.reduce((acc, item) => acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) * ((parseFloat(item.taxRate) || 0)/100)), 0), [items]);
  const grandTotal = useMemo(() => subtotal + totalTax, [subtotal, totalTax]);

  useEffect(() => {
    if (formData.status === 'Paid') {
        setFormData(prev => ({ ...prev, amountPaid: grandTotal.toString() }));
    }
  }, [formData.status, grandTotal]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (itemId: number, field: keyof Omit<FormItem, 'id'>, value: string) => {
    setItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
            const updatedItem = { ...item, [field]: value };
            if (field === 'productId') {
                const productId = value as string;
                if (productId && productId !== 'custom') {
                    const product = products.find(p => p.id === productId);
                    updatedItem.rate = product?.purchasePrice?.toString() || '';
                    updatedItem.taxRate = product?.taxRate?.toString() || '';
                    updatedItem.hsnCode = product?.hsnCode || '';
                    updatedItem.customItemName = '';
                } else {
                     updatedItem.rate = '';
                     updatedItem.taxRate = '';
                     updatedItem.hsnCode = '';
                }
            }
            return updatedItem;
        }
        return item;
    }));
  };
  
  const addItem = () => setItems([...items, { id: Date.now(), productId: '', customItemName: '', hsnCode: '', quantity: '1', rate: '', taxRate: '' }]);
  const removeItem = (id: number) => setItems(items.filter(item => item.id !== id));

  const handleSaveSupplier = () => {
    setIsSupplierModalOpen(false);
    onDataRefresh();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalItems: InvoiceItem[] = items
        .filter(item => (item.productId && (parseFloat(item.quantity) || 0) > 0))
        .map(item => ({
            productId: item.productId === 'custom' ? undefined : item.productId,
            customItemName: item.productId === 'custom' ? item.customItemName : undefined,
            hsnCode: item.hsnCode,
            quantity: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            taxRate: parseFloat(item.taxRate) || 0,
        }));

    if (!formData.supplierId || finalItems.length === 0) {
        showSnackbar("Please select a supplier and add at least one valid item.", "error");
        return;
    }

    const data: PurchaseInvoiceData = {
        invoiceNumber: formData.invoiceNumber || `PI-${Date.now()}`,
        supplierId: formData.supplierId,
        purchaseDate: formData.purchaseDate,
        status: formData.status as PurchaseInvoice['status'],
        items: finalItems,
        amountPaid: (formData.status === 'Paid' || formData.status === 'Partially Paid') ? Number(formData.amountPaid) || 0 : 0,
    };

    if (record) {
      await api.updatePurchaseInvoice(record.id, data);
    } else {
      await api.createPurchaseInvoice(data);
    }
    onSave();
  };

  const title = `${record ? 'Edit' : 'Create'} Purchase Invoice`;

  return (
    <>
    {isSupplierModalOpen && (
        <Modal onClose={() => setIsSupplierModalOpen(false)}>
            <SupplierForm onSave={handleSaveSupplier} onCancel={() => setIsSupplierModalOpen(false)} />
        </Modal>
    )}
    <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label htmlFor="invoiceNumber" className="block text-sm font-medium text-muted-foreground mb-1">Invoice #</label>
              <input id="invoiceNumber" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" required/>
            </div>
            <div>
              <label htmlFor="supplierId" className="block text-sm font-medium text-muted-foreground mb-1">Supplier</label>
              <div className="flex items-center gap-2">
                <select id="supplierId" name="supplierId" value={formData.supplierId} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" required>
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"><PlusIcon /></button>
              </div>
            </div>
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-medium text-muted-foreground mb-1">Purchase Date</label>
              <input id="purchaseDate" type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div>
                <label htmlFor="status" className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                <select id="status" name="status" value={formData.status} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input">
                    <option>Unpaid</option>
                    <option>Partially Paid</option>
                    <option>Paid</option>
                </select>
            </div>
            {(formData.status === 'Paid' || formData.status === 'Partially Paid') && (
                <div>
                    <label htmlFor="amountPaid" className="block text-sm font-medium text-muted-foreground mb-1">Amount Paid</label>
                    <input
                        id="amountPaid"
                        type="number"
                        step="0.01"
                        name="amountPaid"
                        value={formData.amountPaid}
                        onChange={handleFormChange}
                        className="p-2 border rounded w-full bg-background border-input"
                        readOnly={formData.status === 'Paid'}
                    />
                </div>
            )}
        </div>

        <div className="space-y-2 pt-4">
            <h3 className="font-semibold text-lg">Items</h3>
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                <div className="col-span-4">Product</div>
                <div className="col-span-2">HSN/SAC</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-1">Tax%</div>
                <div className="col-span-2">Amount</div>
            </div>
            {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                       <ProductItemInput
                           item={item}
                           products={products}
                           onItemChange={handleItemChange}
                       />
                    </div>
                     <div className="col-span-2"><input type="text" value={item.hsnCode} onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)} placeholder="HSN" className="p-2 border rounded w-full bg-background border-input" /></div>
                    <div className="col-span-1"><input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="Qty" className="p-2 border rounded w-full bg-background border-input" /></div>
                    <div className="col-span-2"><input type="number" step="0.01" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', e.target.value)} placeholder="Rate" className="p-2 border rounded w-full bg-background border-input" /></div>
                    <div className="col-span-1"><input type="number" step="0.01" value={item.taxRate} onChange={e => handleItemChange(item.id, 'taxRate', e.target.value)} placeholder="Tax" className="p-2 border rounded w-full bg-background border-input" /></div>
                    <div className="col-span-2 flex items-center">
                       <span className="p-2 w-full text-right">{((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                       <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 p-1 ml-1"><XIcon className="h-4 w-4" /></button>
                    </div>
                </div>
            ))}
            <button type="button" onClick={addItem} className="text-sm text-primary flex items-center gap-1 pt-2"><PlusIcon /> Add Item</button>
        </div>

        <div className="flex justify-end pt-4">
            <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between"><span>Subtotal:</span> <span>{subtotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                <div className="flex justify-between"><span>Total Tax:</span> <span>{totalTax.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Grand Total:</span> <span>{grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
            </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onCancel} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Cancel</button>
            <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">{record ? 'Update' : 'Save'}</button>
        </div>
    </form>
    </>
  )
};

const formatAddress = (address: Address) => {
  if (!address) return '';
  const parts = [
    address.line1,
    address.line2,
    `${address.district || ''}, ${address.state || ''}`.replace(/^, |, $/g, ''),
    `${address.country || ''} - ${address.pincode || ''}`.replace(/^- | -$/g, ''),
  ];
  return parts.filter(Boolean).join('\n');
};

const PurchaseInvoicePreview: React.FC<{
    invoice: PurchaseInvoice,
    supplier: Supplier | undefined,
    products: Product[],
}> = ({ invoice, supplier, products }) => {
    
    const getItemName = (item: InvoiceItem) => item.customItemName || products.find(p=>p.id === item.productId)?.name || 'Product not found';
    const subtotal = invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
    const totalTax = invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate/100)), 0);
    const grandTotal = subtotal + totalTax;
    const balance = grandTotal - (invoice.amountPaid || 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">Purchase Details</h2>
                    <p className="text-muted-foreground">Invoice #: {invoice.invoiceNumber}</p>
                </div>
                <div className="text-right">
                    <p><strong>Purchase Date:</strong> {invoice.purchaseDate}</p>
                </div>
            </div>
            
            <div>
                <h3 className="font-semibold text-lg mb-2 border-b pb-2">Supplier Details</h3>
                <p className="font-bold text-primary">{supplier?.name || 'Unknown Supplier'}</p>
                <p className="text-muted-foreground">{supplier?.email}</p>
                <p className="text-muted-foreground whitespace-pre-line">{supplier ? formatAddress(supplier.address) : ''}</p>
                {supplier?.gstin && <p><strong>GSTIN:</strong> {supplier.gstin}</p>}
            </div>

            <div>
                <h3 className="font-semibold text-lg mb-2 border-b pb-2">Items</h3>
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-muted-foreground text-sm">
                            <th className="p-2">Item</th>
                            <th className="p-2 text-center">Qty</th>
                            <th className="p-2 text-right">Rate</th>
                            <th className="p-2 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, i) => (
                            <tr key={i} className="border-b">
                                <td className="p-2 font-medium">{getItemName(item)}</td>
                                <td className="p-2 text-center">{item.quantity}</td>
                                <td className="p-2 text-right">{item.rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                                <td className="p-2 text-right">{(item.rate * item.quantity).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

             <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between"><span>Subtotal:</span> <span>{subtotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    <div className="flex justify-between"><span>Total Tax:</span> <span>{totalTax.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Grand Total:</span> <span>{grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    <div className="flex justify-between font-bold text-lg text-primary"><span>Balance Due:</span> <span>{balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                </div>
            </div>

        </div>
    );
};


const Purchases: React.FC = () => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PurchaseInvoice | null>(null);
  const [viewingRecord, setViewingRecord] = useState<PurchaseInvoice | null>(null);
  const { showSnackbar } = useSnackbar();
  
  const [filters, setFilters] = useState({ supplierId: '', startDate: '', endDate: '' });
  const [recordToDelete, setRecordToDelete] = useState<PurchaseInvoice | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<React.ReactNode>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invs, supps, prods] = await Promise.all([
        api.getPurchaseInvoices(),
        api.getSuppliers(),
        api.getProducts(),
      ]);
      setInvoices(invs.sort((a, b) => b.id.localeCompare(a.id)));
      setSuppliers(supps);
      setProducts(prods);
    } catch (error) {
      console.error("Failed to fetch purchase data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
        const invDate = safeParseDate(inv.purchaseDate);
        const startDate = safeParseDate(filters.startDate);
        const endDate = safeParseDate(filters.endDate);

        if (!invDate) return false;
        if (startDate) startDate.setHours(0,0,0,0);
        if (endDate) endDate.setHours(23,59,59,999);
        
        return (
            (filters.supplierId ? inv.supplierId === filters.supplierId : true) &&
            (startDate ? invDate >= startDate : true) &&
            (endDate ? invDate <= endDate : true)
        )
    })
  }, [invoices, filters]);


  const handleAddNew = () => {
    setEditingRecord(null);
    setIsFormModalOpen(true);
  };
  
  const handleView = (record: PurchaseInvoice) => {
    setViewingRecord(record);
  }

  const handleEdit = (record: PurchaseInvoice) => {
    setEditingRecord(record);
    setIsFormModalOpen(true);
  };

  const handleSave = () => {
    setIsFormModalOpen(false);
    setEditingRecord(null);
    fetchData();
  };

  const handleOpenDeleteDialog = (invoice: PurchaseInvoice) => {
      let messageParts = [`Are you sure you want to delete Purchase #${invoice.invoiceNumber}? The quantities for all items will be removed from your stock. This action cannot be undone.`];
      
      const negativeStockItems: string[] = [];
      invoice.items.forEach(item => {
        if (item.productId) {
            const product = products.find(p => p.id === item.productId);
            if (product && (product.stock - item.quantity < 0)) {
                negativeStockItems.push(product.name);
            }
        }
      });

      if (negativeStockItems.length > 0) {
        messageParts.push(`\n\nWARNING: This will result in negative stock for the following items: ${negativeStockItems.join(', ')}.`);
      }
      
      setRecordToDelete(invoice);
      setDeleteMessage(messageParts.join(''));
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const success = await api.deletePurchaseInvoice(recordToDelete.id);
    if (success) {
        showSnackbar(`Purchase ${recordToDelete.invoiceNumber} deleted successfully.`, 'success');
        fetchData();
    } else {
        showSnackbar(`Failed to delete purchase #${recordToDelete.invoiceNumber}.`, 'error');
    }
    setRecordToDelete(null);
  };

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';

  const calculateTotal = (items: InvoiceItem[]): number => {
      const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
      const tax = items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0);
      return subtotal + tax;
  };
  const calculateBalance = (invoice: PurchaseInvoice) => calculateTotal(invoice.items) - (invoice.amountPaid || 0);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }
  
    const statusColors: { [key in PurchaseInvoice['status']]: string } = {
      Paid: 'bg-green-100 text-green-800',
      Unpaid: 'bg-yellow-100 text-yellow-800',
      'Partially Paid': 'bg-blue-100 text-blue-800',
  }
  
  // FIX: Define a specific type for purchase invoice data used in the table.
  type PurchaseInvoiceForTable = PurchaseInvoice & { total: number; balance: number; };

  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const columns: Column<PurchaseInvoiceForTable>[] = [
    { header: 'Invoice #', accessor: 'invoiceNumber', isSortable: true, render: (row: PurchaseInvoiceForTable) => <span className="font-medium text-primary">{row.invoiceNumber}</span> },
    { header: 'Supplier', accessor: 'supplierId', isSortable: true, render: (row: PurchaseInvoiceForTable) => getSupplierName(row.supplierId) },
    { header: 'Purchase Date', accessor: 'purchaseDate', isSortable: true },
    { header: 'Total', accessor: 'total', isSortable: true, render: (row: PurchaseInvoiceForTable) => calculateTotal(row.items).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    { header: 'Balance Due', accessor: 'balance', isSortable: true, render: (row: PurchaseInvoiceForTable) => calculateBalance(row).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    { header: 'Status', accessor: 'status', isSortable: true, render: (row: PurchaseInvoiceForTable) => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[row.status]}`}>{row.status}</span> },
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
       {isFormModalOpen && (
        <Modal onClose={() => setIsFormModalOpen(false)}>
            <PurchaseForm
                record={editingRecord}
                suppliers={suppliers}
                products={products}
                onSave={handleSave}
                onCancel={() => setIsFormModalOpen(false)}
                onDataRefresh={fetchData}
            />
        </Modal>
       )}
       {viewingRecord && (
        <Modal onClose={() => setViewingRecord(null)}>
            <PurchaseInvoicePreview
                invoice={viewingRecord}
                supplier={suppliers.find(s => s.id === viewingRecord.supplierId)}
                products={products}
            />
        </Modal>
       )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Purchase Invoices</h2>
        <button onClick={handleAddNew} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm">
          Record Purchase
        </button>
      </div>

       {loading ? <div>Loading...</div> : (
        <DataTable
            columns={columns}
            data={filteredInvoices.map(i => ({...i, total: calculateTotal(i.items), balance: calculateBalance(i) }))}
            renderActions={(invoice) => (
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => handleView(invoice)} className="p-1 hover:bg-muted rounded-md" title="View"><ViewIcon /></button>
                  <button onClick={() => handleEdit(invoice)} className="p-1 hover:bg-muted rounded-md" title="Edit"><EditIcon /></button>
                  <button onClick={() => handleOpenDeleteDialog(invoice)} className="p-1 hover:bg-muted rounded-md" title="Delete"><TrashIcon /></button>
                </div>
            )}
            filterConfig={
                <div className="flex flex-wrap items-center gap-4">
                    <select name="supplierId" value={filters.supplierId} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm">
                        <option value="">All Suppliers</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                        <label htmlFor="startDate" className="text-sm font-medium text-muted-foreground">Start Date:</label>
                        <input id="startDate" type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="endDate" className="text-sm font-medium text-muted-foreground">End Date:</label>
                        <input id="endDate" type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                    </div>
                </div>
            }
            searchConfig={{ placeholder: "Search Invoice # or Supplier...", searchKeys: ['invoiceNumber', 'supplierId'] }}
        />
       )}
    </div>
  );
};

export default Purchases;