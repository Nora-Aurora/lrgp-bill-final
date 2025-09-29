import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { api } from '../api';
import type { Quotation, SalesInvoice, Customer, Product, InvoiceItem, QuotationData, SalesInvoiceData, AppSettings, Address } from '../types';
import { EditIcon, TrashIcon, PlusIcon, XIcon, ViewIcon } from '../components/icons';
import Modal from '../components/Modal';
// FIX: Import Column type to strongly type column definitions for DataTable.
import { DataTable, Column } from '../components/DataTable';
import { CustomerForm } from './Contacts';
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

// FIX: Moved calculateTotal to module scope to be accessible by InvoicePreview
const calculateTotal = (items: InvoiceItem[]): number => {
      const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
      const tax = items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0);
      return subtotal + tax;
};

const toWords = (s: number | string): string => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const num = parseFloat(s.toString());
    if (isNaN(num)) return '';
    if (num === 0) return 'zero';

    const numStr = num.toFixed(2).toString();
    const [integerPart, decimalPart] = numStr.split('.');

    const inWords = (num: string): string => {
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return '';
        let str = '';
        str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim();
    };

    let words = inWords(integerPart);
    if (words) words += ' rupees';

    if (decimalPart && parseInt(decimalPart) > 0) {
        const paisaWords = inWords(decimalPart);
        if (words) words += ' and ';
        words += paisaWords + ' paise';
    }

    return words + ' only';
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
        } else if (item.productId === '') {
            setSearchTerm('');
        }
    }, [item.productId, products]);

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

// Form Component for Sales Invoice and Quotation
const SalesForm: React.FC<{
  formType: 'invoice' | 'quotation';
  record?: SalesInvoice | Quotation | null;
  customers: Customer[];
  products: Product[];
  settings: AppSettings;
  onSave: () => void;
  onCancel: () => void;
  onDataRefresh: () => void;
}> = ({ formType, record, customers, products, settings, onSave, onCancel, onDataRefresh }) => {
  const isInvoice = formType === 'invoice';
  const { showSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
    customerId: record?.customerId || '',
    invoiceDate: (record && 'invoiceDate' in record) ? record.invoiceDate : new Date().toISOString().split('T')[0],
    dueDate: (record && 'dueDate' in record) ? record.dueDate : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    quoteDate: (record && 'quoteDate' in record) ? record.quoteDate : new Date().toISOString().split('T')[0],
    expiryDate: (record && 'expiryDate' in record) ? record.expiryDate : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: record?.status || (isInvoice ? 'Unpaid' : 'Sent'),
    amountPaid: (record && 'amountPaid' in record) ? (record.amountPaid || '').toString() : '',
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

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)), 0), [items]);
  const totalTax = useMemo(() => items.reduce((acc, item) => acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) * ((parseFloat(item.taxRate) || 0)/100)), 0), [items]);
  const grandTotal = useMemo(() => subtotal + totalTax, [subtotal, totalTax]);

  useEffect(() => {
      if (isInvoice) {
          if (formData.status === 'Paid') {
              setFormData(prev => ({ ...prev, amountPaid: grandTotal.toString() }));
          }
      }
  }, [formData.status, grandTotal, isInvoice]);

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
                    updatedItem.rate = product?.salePrice?.toString() || '';
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

  const handleSaveCustomer = () => {
      setIsCustomerModalOpen(false);
      onDataRefresh();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericItems = items.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        rate: parseFloat(item.rate) || 0,
        taxRate: parseFloat(item.taxRate) || 0
    }));

    // Check stock availability before creating/updating an invoice
    if (isInvoice) {
      for (const item of numericItems) {
        // Check only for items that are actual products, not custom entries
        if (item.productId && item.productId !== 'custom' && item.quantity > 0) {
          const product = products.find(p => p.id === item.productId);
          if (!product || product.isService) continue;

          // When editing an invoice, the stock was already reduced by the original quantity.
          // We add it back to the current stock to get the total available for this transaction.
          const originalQuantity = (record as SalesInvoice)?.items?.find(i => i.productId === item.productId)?.quantity || 0;
          
          const totalAvailableForSale = (product.stock || 0) + originalQuantity;

          if (item.quantity > totalAvailableForSale) {
            showSnackbar(`Low stock for "${product.name}". Only ${totalAvailableForSale} items available.`, 'error');
            return; // Stop the submission
          }
        }
      }
    }

    const finalItems: InvoiceItem[] = numericItems
        .filter(item => ((item.productId && item.quantity > 0) || (item.productId === 'custom' && item.customItemName)))
        .map(item => ({
            productId: item.productId === 'custom' ? undefined : item.productId,
            customItemName: item.productId === 'custom' ? item.customItemName : undefined,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            rate: item.rate,
            taxRate: item.taxRate,
        }));

    if (!formData.customerId || finalItems.length === 0) {
        showSnackbar("Please select a customer and add at least one valid item.", 'error');
        return;
    }
    
    if (isInvoice) {
        if (record) {
            const data: SalesInvoiceData = {
                invoiceNumber: (record as SalesInvoice).invoiceNumber,
                customerId: formData.customerId,
                invoiceDate: formData.invoiceDate,
                dueDate: formData.dueDate,
                status: formData.status as SalesInvoice['status'],
                items: finalItems,
                amountPaid: (formData.status === 'Paid' || formData.status === 'Partially Paid') ? Number(formData.amountPaid) || 0 : 0,
            };
            await api.updateSalesInvoice(record.id, data);
        } else {
            const prefix = settings.invoiceSettings.invoiceNumberPrefix ?? 'INV-';
            const nextNumber = settings.invoiceSettings.nextInvoiceNumber ?? 1;
            const invoiceNumber = `${prefix}${String(nextNumber).padStart(5, '0')}`;
            
            const data: SalesInvoiceData = {
                invoiceNumber,
                customerId: formData.customerId,
                invoiceDate: formData.invoiceDate,
                dueDate: formData.dueDate,
                status: formData.status as SalesInvoice['status'],
                items: finalItems,
                amountPaid: (formData.status === 'Paid' || formData.status === 'Partially Paid') ? Number(formData.amountPaid) || 0 : 0,
            };
            await api.createSalesInvoice(data);
            await api.updateSettings({
                ...settings,
                invoiceSettings: {
                    ...settings.invoiceSettings,
                    nextInvoiceNumber: nextNumber + 1
                }
            });
        }
    } else { // It's a quotation
        const data: QuotationData = {
            quotationNumber: '', // will be set below
            customerId: formData.customerId,
            quoteDate: formData.quoteDate,
            expiryDate: formData.expiryDate,
            status: formData.status as Quotation['status'],
            items: finalItems,
        };

        if (record) {
            data.quotationNumber = (record as Quotation).quotationNumber;
            await api.updateQuotation(record.id, data);
            // If status changed to Invoiced, create a new sales invoice automatically
            if (data.status === 'Invoiced' && (record as Quotation).status !== 'Invoiced') {
                const prefix = settings.invoiceSettings.invoiceNumberPrefix ?? 'INV-';
                const nextNumber = settings.invoiceSettings.nextInvoiceNumber ?? 1;
                const invoiceNumber = `${prefix}${String(nextNumber).padStart(5, '0')}`;

                const invoiceData: SalesInvoiceData = {
                    invoiceNumber,
                    customerId: data.customerId,
                    invoiceDate: new Date().toISOString().split('T')[0],
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    items: data.items,
                    status: 'Unpaid',
                    amountPaid: 0,
                };
                await api.createSalesInvoice(invoiceData);
                await api.updateSettings({
                    ...settings,
                    invoiceSettings: {
                        ...settings.invoiceSettings,
                        nextInvoiceNumber: nextNumber + 1
                    }
                });
                showSnackbar(`Invoice ${invoiceData.invoiceNumber} created from Quotation ${data.quotationNumber}.`, 'success');
            }
        } else {
            const prefix = settings.invoiceSettings.quotationNumberPrefix ?? 'QUO-';
            const nextNumber = settings.invoiceSettings.nextQuotationNumber ?? 1;
            data.quotationNumber = `${prefix}${String(nextNumber).padStart(5, '0')}`;
            await api.createQuotation(data);
            await api.updateSettings({
                ...settings,
                invoiceSettings: {
                    ...settings.invoiceSettings,
                    nextQuotationNumber: nextNumber + 1,
                }
            });
        }
    }
    onSave();
  };

  const title = `${record ? 'Edit' : 'Create'} ${isInvoice ? 'Invoice' : 'Quotation'}`;

  return (
    <>
    {isCustomerModalOpen && (
        <Modal onClose={() => setIsCustomerModalOpen(false)}>
            <CustomerForm onSave={handleSaveCustomer} onCancel={() => setIsCustomerModalOpen(false)} />
        </Modal>
    )}
    <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-muted-foreground mb-1">Customer</label>
              <div className="flex items-center gap-2">
                <select id="customerId" name="customerId" value={formData.customerId} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" required>
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"><PlusIcon /></button>
              </div>
            </div>
            {isInvoice ? (
                <>
                    <div>
                        <label htmlFor="invoiceDate" className="block text-sm font-medium text-muted-foreground mb-1">Invoice Date</label>
                        <input id="invoiceDate" type="date" name="invoiceDate" value={formData.invoiceDate} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" />
                    </div>
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-muted-foreground mb-1">Due Date</label>
                        <input id="dueDate" type="date" name="dueDate" value={formData.dueDate} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" />
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                        <select id="status" name="status" value={formData.status} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input">
                            <option>Unpaid</option>
                            <option>Partially Paid</option>
                            <option>Paid</option>
                            <option>Overdue</option>
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
                </>
            ) : (
                <>
                    <div>
                        <label htmlFor="quoteDate" className="block text-sm font-medium text-muted-foreground mb-1">Quote Date</label>
                        <input id="quoteDate" type="date" name="quoteDate" value={formData.quoteDate} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" />
                    </div>
                    <div>
                        <label htmlFor="expiryDate" className="block text-sm font-medium text-muted-foreground mb-1">Expiry Date</label>
                        <input id="expiryDate" type="date" name="expiryDate" value={formData.expiryDate} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input" />
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                        <select id="status" name="status" value={formData.status} onChange={handleFormChange} className="p-2 border rounded w-full bg-background border-input">
                            <option>Sent</option><option>Accepted</option><option>Invoiced</option><option>Expired</option>
                        </select>
                    </div>
                </>
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

const InvoicePreview: React.FC<{
    invoice: SalesInvoice,
    customer: Customer,
    settings: AppSettings,
    products: Product[],
    onClose: () => void,
}> = ({invoice, customer, settings, products, onClose}) => {

    const isInterState = useMemo(() => {
        if (!customer.billingAddress.state || !settings.companyDetails.address.state) return true; // Default to IGST if states are unknown
        return customer.billingAddress.state.trim().toLowerCase() !== settings.companyDetails.address.state.trim().toLowerCase();
    }, [customer.billingAddress.state, settings.companyDetails.address.state]);

    const subtotal = invoice.items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
    const totalCgst = isInterState ? 0 : invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 200)), 0);
    const totalSgst = isInterState ? 0 : invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 200)), 0);
    const totalIgst = isInterState ? invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0) : 0;
    const grandTotal = subtotal + totalCgst + totalSgst + totalIgst;
    const balance = grandTotal - (invoice.amountPaid || 0);

    const getItemName = (item: InvoiceItem) => item.customItemName || products.find(p=>p.id === item.productId)?.name || 'Product not found';
    
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

    const downloadInvoice = async () => {

        const contentEl = document.getElementById('invoice-preview-content');
        if (!contentEl) return;
        
        const canvas = await html2canvas(contentEl, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
    };

    return (
        <div>
            <div id="invoice-preview-content" className="bg-background p-8 text-base">
                <div className="flex justify-between items-start pb-6 border-b">
                    <div>
                        {settings.companyDetails.logoUrl && <img src={settings.companyDetails.logoUrl} alt="Company Logo" className="h-12 mb-4"/>}
                        <h1 className="font-bold text-lg">{settings.companyDetails.name}</h1>
                        <p className="text-muted-foreground whitespace-pre-line text-sm">{formatAddress(settings.companyDetails.address)}</p>
                        <p className="text-muted-foreground text-sm mt-1"><strong>GSTIN:</strong> {settings.companyDetails.gstin}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold uppercase" style={{color: settings.invoiceSettings.accentColor}}>Invoice</h2>
                        <p className="mt-2"><strong className="text-muted-foreground">Invoice #:</strong> {invoice.invoiceNumber}</p>
                        <p><strong className="text-muted-foreground">Invoice Date:</strong> {invoice.invoiceDate}</p>
                        <p><strong className="text-muted-foreground">Due Date:</strong> {invoice.dueDate}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                        <h3 className="font-semibold mb-2">Bill To:</h3>
                        <p className="font-bold">{customer.name}</p>
                        <p className="text-muted-foreground whitespace-pre-line text-sm">{formatAddress(customer.billingAddress)}</p>
                        {customer.gstin && <p className="text-muted-foreground mt-1 text-sm"><strong>GSTIN:</strong> {customer.gstin}</p>}
                    </div>
                    {customer.shippingAddress && (
                        <div className="text-right">
                            <h3 className="font-semibold mb-2">Ship To:</h3>
                            <p className="font-bold">{customer.name}</p>
                            <p className="text-muted-foreground whitespace-pre-line text-sm">{formatAddress(customer.shippingAddress)}</p>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <table className="w-full text-left text-sm">
                        <thead style={{backgroundColor: settings.invoiceSettings.accentColor}} className="text-primary-foreground">
                             {isInterState ? (
                                <tr>
                                    <th className="p-2 font-semibold">Item</th>
                                    <th className="p-2 text-center font-semibold">HSN</th>
                                    <th className="p-2 text-center font-semibold">Qty</th>
                                    <th className="p-2 text-right font-semibold">Rate</th>
                                    <th className="p-2 text-right font-semibold">Taxable Amt</th>
                                    <th className="p-2 text-center font-semibold">IGST %</th>
                                    <th className="p-2 text-right font-semibold">IGST Amt</th>
                                    <th className="p-2 text-right font-semibold">Total</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-2 font-semibold">Item</th>
                                    <th className="p-2 text-center font-semibold">HSN</th>
                                    <th className="p-2 text-center font-semibold">Qty</th>
                                    <th className="p-2 text-right font-semibold">Rate</th>
                                    <th className="p-2 text-right font-semibold">Taxable Amt</th>
                                    <th className="p-2 text-center font-semibold">CGST %</th>
                                    <th className="p-2 text-right font-semibold">CGST Amt</th>
                                    <th className="p-2 text-center font-semibold">SGST %</th>
                                    <th className="p-2 text-right font-semibold">SGST Amt</th>
                                    <th className="p-2 text-right font-semibold">Total</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                             {invoice.items.map((item, i) => {
                                const taxableValue = item.rate * item.quantity;
                                const taxAmount = taxableValue * (item.taxRate / 100);
                                const itemTotal = taxableValue + taxAmount;
                                return (
                                    <tr key={i} className="border-b">
                                        <td className="p-2">{getItemName(item)}</td>
                                        <td className="p-2 text-center">{item.hsnCode}</td>
                                        <td className="p-2 text-center">{item.quantity}</td>
                                        <td className="p-2 text-right">{item.rate.toFixed(2)}</td>
                                        <td className="p-2 text-right">{taxableValue.toFixed(2)}</td>
                                        {isInterState ? (
                                            <>
                                                <td className="p-2 text-center">{item.taxRate}%</td>
                                                <td className="p-2 text-right">{taxAmount.toFixed(2)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-2 text-center">{item.taxRate / 2}%</td>
                                                <td className="p-2 text-right">{(taxAmount / 2).toFixed(2)}</td>
                                                <td className="p-2 text-center">{item.taxRate / 2}%</td>
                                                <td className="p-2 text-right">{(taxAmount / 2).toFixed(2)}</td>
                                            </>
                                        )}
                                        <td className="p-2 text-right font-semibold">{itemTotal.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-start mt-6">
                    <div className="w-1/2">
                        <p className="font-bold">Amount in Words:</p>
                        <p className="text-muted-foreground capitalize text-sm">{toWords(grandTotal)}</p>
                    </div>
                    <div className="w-full max-w-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span> <span>{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                         {isInterState ? (
                            <div className="flex justify-between"><span className="text-muted-foreground">IGST:</span> <span>{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        ) : (
                            <>
                                <div className="flex justify-between"><span className="text-muted-foreground">CGST:</span> <span>{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">SGST:</span> <span>{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                            </>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-1"><span >Grand Total:</span> <span>{grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between font-bold text-lg" style={{color: settings.invoiceSettings.accentColor}}><span>Balance Due:</span> <span>{balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    </div>
                </div>

                <div className="mt-8 border-t pt-4 text-muted-foreground text-sm">
                    {settings.invoiceSettings.bankDetails && (settings.invoiceSettings.bankDetails.bankName || settings.invoiceSettings.bankDetails.accountNumber) && (
                        <div className="mb-4">
                            <h4 className="font-semibold text-foreground mb-1">Bank Details:</h4>
                            <p className="whitespace-pre-line">
                                <strong>Bank Name:</strong> {settings.invoiceSettings.bankDetails.bankName}<br />
                                <strong>A/C No:</strong> {settings.invoiceSettings.bankDetails.accountNumber}<br />
                                <strong>IFSC Code:</strong> {settings.invoiceSettings.bankDetails.ifscCode}<br />
                                <strong>Branch:</strong> {settings.invoiceSettings.bankDetails.branch}
                            </p>
                        </div>
                    )}
                    {settings.invoiceSettings.notes && (
                        <div>
                            <h4 className="font-semibold text-foreground mb-1">Notes:</h4>
                            <p className="whitespace-pre-line">{settings.invoiceSettings.notes}</p>
                        </div>
                    )}
                    {settings.invoiceSettings.terms && (
                        <div className="mt-4">
                            <h4 className="font-semibold text-foreground mb-1">Terms & Conditions:</h4>
                            <p className="whitespace-pre-line">{settings.invoiceSettings.terms}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-8 flex justify-end gap-2 noprint">
                <button onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Close</button>
                <button onClick={downloadInvoice} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">Download Invoice</button>
            </div>
        </div>
    );
};

const QuotationPreview: React.FC<{
    quotation: Quotation,
    customer: Customer,
    settings: AppSettings,
    products: Product[],
    onClose: () => void,
}> = ({quotation, customer, settings, products, onClose}) => {
    
    const isInterState = useMemo(() => {
        if (!customer.billingAddress.state || !settings.companyDetails.address.state) return true;
        return customer.billingAddress.state.trim().toLowerCase() !== settings.companyDetails.address.state.trim().toLowerCase();
    }, [customer.billingAddress.state, settings.companyDetails.address.state]);

    const subtotal = quotation.items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
    const totalCgst = isInterState ? 0 : quotation.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 200)), 0);
    const totalSgst = isInterState ? 0 : quotation.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 200)), 0);
    const totalIgst = isInterState ? quotation.items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0) : 0;
    const grandTotal = subtotal + totalCgst + totalSgst + totalIgst;

    const getItemName = (item: InvoiceItem) => item.customItemName || products.find(p=>p.id === item.productId)?.name || 'Product not found';
    
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

    const downloadQuotation = async () => {

        const contentEl = document.getElementById('quotation-preview-content');
        if (!contentEl) return;
        
        const canvas = await html2canvas(contentEl, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Quotation-${quotation.quotationNumber}.pdf`);
    };

    return (
        <div>
            <div id="quotation-preview-content" className="bg-background p-8 text-sm">
                <div className="flex justify-between items-start pb-6 border-b">
                     <div>
                        {settings.companyDetails.logoUrl && <img src={settings.companyDetails.logoUrl} alt="Company Logo" className="h-12 mb-4"/>}
                        <h1 className="font-bold text-lg">{settings.companyDetails.name}</h1>
                        <p className="text-muted-foreground whitespace-pre-line text-xs">{formatAddress(settings.companyDetails.address)}</p>
                        <p className="text-muted-foreground text-xs mt-1"><strong>GSTIN:</strong> {settings.companyDetails.gstin}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold uppercase" style={{color: settings.invoiceSettings.accentColor}}>Quotation</h2>
                        <p className="mt-2"><strong className="text-muted-foreground">Quotation #:</strong> {quotation.quotationNumber}</p>
                        <p><strong className="text-muted-foreground">Quote Date:</strong> {quotation.quoteDate}</p>
                        <p><strong className="text-muted-foreground">Expiry Date:</strong> {quotation.expiryDate}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                        <h3 className="font-semibold mb-2">Quote To:</h3>
                        <p className="font-bold">{customer.name}</p>
                        <p className="text-muted-foreground whitespace-pre-line text-xs">{formatAddress(customer.billingAddress)}</p>
                        {customer.gstin && <p className="text-muted-foreground mt-1 text-xs"><strong>GSTIN:</strong> {customer.gstin}</p>}
                    </div>
                     {customer.shippingAddress && (
                        <div className="text-right">
                            <h3 className="font-semibold mb-2">Ship To:</h3>
                            <p className="font-bold">{customer.name}</p>
                            <p className="text-muted-foreground whitespace-pre-line text-xs">{formatAddress(customer.shippingAddress)}</p>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <table className="w-full text-left text-xs">
                         <thead style={{backgroundColor: settings.invoiceSettings.accentColor}} className="text-primary-foreground">
                             {isInterState ? (
                                <tr>
                                    <th className="p-2 font-semibold">Item</th>
                                    <th className="p-2 text-center font-semibold">HSN</th>
                                    <th className="p-2 text-center font-semibold">Qty</th>
                                    <th className="p-2 text-right font-semibold">Rate</th>
                                    <th className="p-2 text-right font-semibold">Taxable Amt</th>
                                    <th className="p-2 text-center font-semibold">IGST %</th>
                                    <th className="p-2 text-right font-semibold">IGST Amt</th>
                                    <th className="p-2 text-right font-semibold">Total</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-2 font-semibold">Item</th>
                                    <th className="p-2 text-center font-semibold">HSN</th>
                                    <th className="p-2 text-center font-semibold">Qty</th>
                                    <th className="p-2 text-right font-semibold">Rate</th>
                                    <th className="p-2 text-right font-semibold">Taxable Amt</th>
                                    <th className="p-2 text-center font-semibold">CGST %</th>
                                    <th className="p-2 text-right font-semibold">CGST Amt</th>
                                    <th className="p-2 text-center font-semibold">SGST %</th>
                                    <th className="p-2 text-right font-semibold">SGST Amt</th>
                                    <th className="p-2 text-right font-semibold">Total</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {quotation.items.map((item, i) => {
                                const taxableValue = item.rate * item.quantity;
                                const taxAmount = taxableValue * (item.taxRate / 100);
                                const itemTotal = taxableValue + taxAmount;
                                return (
                                    <tr key={i} className="border-b">
                                        <td className="p-2">{getItemName(item)}</td>
                                        <td className="p-2 text-center">{item.hsnCode}</td>
                                        <td className="p-2 text-center">{item.quantity}</td>
                                        <td className="p-2 text-right">{item.rate.toFixed(2)}</td>
                                        <td className="p-2 text-right">{taxableValue.toFixed(2)}</td>
                                        {isInterState ? (
                                            <>
                                                <td className="p-2 text-center">{item.taxRate}%</td>
                                                <td className="p-2 text-right">{taxAmount.toFixed(2)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-2 text-center">{item.taxRate / 2}%</td>
                                                <td className="p-2 text-right">{(taxAmount / 2).toFixed(2)}</td>
                                                <td className="p-2 text-center">{item.taxRate / 2}%</td>
                                                <td className="p-2 text-right">{(taxAmount / 2).toFixed(2)}</td>
                                            </>
                                        )}
                                        <td className="p-2 text-right font-semibold">{itemTotal.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-start mt-6">
                    <div className="w-1/2">
                        <p className="font-bold">Amount in Words:</p>
                        <p className="text-muted-foreground capitalize text-xs">{toWords(grandTotal)}</p>
                    </div>
                     <div className="w-full max-w-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span> <span>{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                         {isInterState ? (
                            <div className="flex justify-between"><span className="text-muted-foreground">IGST:</span> <span>{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        ) : (
                            <>
                                <div className="flex justify-between"><span className="text-muted-foreground">CGST:</span> <span>{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">SGST:</span> <span>{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                            </>
                        )}
                        <div className="flex justify-between font-bold text-base border-t pt-1" style={{color: settings.invoiceSettings.accentColor}}><span>Grand Total:</span> <span>{grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    </div>
                </div>

                <div className="mt-8 border-t pt-4 text-muted-foreground text-xs">
                    {settings.invoiceSettings.notes && (
                        <div>
                            <h4 className="font-semibold text-foreground mb-1">Notes:</h4>
                            <p className="whitespace-pre-line">{settings.invoiceSettings.notes}</p>
                        </div>
                    )}
                    {settings.invoiceSettings.terms && (
                        <div className="mt-4">
                            <h4 className="font-semibold text-foreground mb-1">Terms & Conditions:</h4>
                            <p className="whitespace-pre-line">{settings.invoiceSettings.terms}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-8 flex justify-end gap-2 noprint">
                <button onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Close</button>
                <button onClick={downloadQuotation} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">Download Quotation</button>
            </div>
        </div>
    );
};

const Sales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotations'>('invoices');
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [isQuotationPreviewOpen, setIsQuotationPreviewOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalesInvoice | Quotation | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState<SalesInvoice | null>(null);
  const [previewingQuotation, setPreviewingQuotation] = useState<Quotation | null>(null);
  const [filters, setFilters] = useState({ customerId: '', startDate: '', endDate: '' });
  const [recordToDelete, setRecordToDelete] = useState<SalesInvoice | Quotation | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<React.ReactNode>('');
  const { showSnackbar } = useSnackbar();
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invs, quots, custs, prods, sets] = await Promise.all([
        api.getSalesInvoices(),
        api.getQuotations(),
        api.getCustomers(),
        api.getProducts(),
        api.getSettings(),
      ]);
      setInvoices(invs.sort((a, b) => b.invoiceNumber.localeCompare(a.invoiceNumber)));
      setQuotations(quots.sort((a, b) => b.quotationNumber.localeCompare(a.quotationNumber)));
      setCustomers(custs);
      setProducts(prods);
      setSettings(sets);
    } catch (error) {
      console.error("Failed to fetch sales data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
        const invDate = safeParseDate(inv.invoiceDate);
        const startDate = safeParseDate(filters.startDate);
        const endDate = safeParseDate(filters.endDate);
        
        if (!invDate) return false;
        if (startDate) startDate.setHours(0,0,0,0);
        if (endDate) endDate.setHours(23,59,59,999);

        return (
            (filters.customerId ? inv.customerId === filters.customerId : true) &&
            (startDate ? invDate >= startDate : true) &&
            (endDate ? invDate <= endDate : true)
        )
    })
  }, [invoices, filters]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter(quote => {
        const quoteDate = safeParseDate(quote.quoteDate);
        const startDate = safeParseDate(filters.startDate);
        const endDate = safeParseDate(filters.endDate);
        
        if (!quoteDate) return false;
        if (startDate) startDate.setHours(0,0,0,0);
        if (endDate) endDate.setHours(23,59,59,999);

        return (
            (filters.customerId ? quote.customerId === filters.customerId : true) &&
            (startDate ? quoteDate >= startDate : true) &&
            (endDate ? quoteDate <= endDate : true)
        )
    })
  }, [quotations, filters]);

  const handleAddNew = () => {
    setEditingRecord(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (record: SalesInvoice | Quotation) => {
    setEditingRecord(record);
    setIsFormModalOpen(true);
  };
  
  const handlePreviewInvoice = (invoice: SalesInvoice) => {
    setPreviewingInvoice(invoice);
    setIsInvoicePreviewOpen(true);
  }

  const handlePreviewQuotation = (quotation: Quotation) => {
    setPreviewingQuotation(quotation);
    setIsQuotationPreviewOpen(true);
  }

  const handleSave = () => {
    setIsFormModalOpen(false);
    setEditingRecord(null);
    fetchData();
  };

  const handleOpenDeleteDialog = (record: SalesInvoice | Quotation) => {
    let message: React.ReactNode;
    if (activeTab === 'invoices') {
        const invoice = record as SalesInvoice;
        message = (
            <>
                <p>Are you sure you want to delete Invoice <strong>#{invoice.invoiceNumber}</strong>?</p>
                <p className="mt-2 text-sm text-yellow-600">The quantities for all items in this invoice will be added back to your stock. This action cannot be undone.</p>
            </>
        );
    } else {
        const quotation = record as Quotation;
        message = `Are you sure you want to delete Quotation #${quotation.quotationNumber}?`;
    }
    setRecordToDelete(record);
    setDeleteMessage(message);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    if (activeTab === 'invoices') {
        const invoice = recordToDelete as SalesInvoice;
        const success = await api.deleteSalesInvoice(invoice.id);
        if (success) {
            showSnackbar(`Invoice ${invoice.invoiceNumber} deleted successfully.`, 'success');
            fetchData();
        } else {
            showSnackbar(`Failed to delete invoice #${invoice.invoiceNumber}.`, 'error');
        }
    } else {
        const quotation = recordToDelete as Quotation;
        const success = await api.deleteQuotation(quotation.id);
        if (success) {
            showSnackbar(`Quotation ${quotation.quotationNumber} deleted successfully.`, 'success');
            fetchData();
        } else {
            showSnackbar(`Failed to delete quotation #${quotation.quotationNumber}.`, 'error');
        }
    }
    setRecordToDelete(null);
    setDeleteMessage('');
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown';
  const getCustomer = (id: string) => customers.find(c => c.id === id);
  const calculateBalance = (invoice: SalesInvoice) => calculateTotal(invoice.items) - (invoice.amountPaid || 0);

  const statusColors: { [key in SalesInvoice['status']]: string } = {
      Paid: 'bg-green-100 text-green-800',
      Unpaid: 'bg-yellow-100 text-yellow-800',
      Overdue: 'bg-red-100 text-red-800',
      'Partially Paid': 'bg-blue-100 text-blue-800',
  }

  // FIX: Define a specific type for invoice data used in the table.
  type InvoiceForTable = SalesInvoice & { total: number; balance: number; };

  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const invoiceColumns: Column<InvoiceForTable>[] = [
    { header: 'Invoice #', accessor: 'invoiceNumber', isSortable: true, render: (row: InvoiceForTable) => <span className="font-medium text-primary">{row.invoiceNumber}</span> },
    { header: 'Customer', accessor: 'customerId', isSortable: true, render: (row: InvoiceForTable) => getCustomerName(row.customerId) },
    { header: 'Invoice Date', accessor: 'invoiceDate', isSortable: true },
    { header: 'Amount', accessor: 'total', isSortable: true, render: (row: InvoiceForTable) => calculateTotal(row.items).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    { header: 'Balance Due', accessor: 'balance', isSortable: true, render: (row: InvoiceForTable) => calculateBalance(row).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    { header: 'Status', accessor: 'status', isSortable: true, render: (row: InvoiceForTable) => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[row.status]}`}>{row.status}</span> },
  ];
  
  // FIX: Define a specific type for quotation data used in the table.
  type QuotationForTable = Quotation & { total: number };

  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const quotationColumns: Column<QuotationForTable>[] = [
    { header: 'Quote #', accessor: 'quotationNumber', isSortable: true, render: (row: QuotationForTable) => <span className="font-medium text-primary">{row.quotationNumber}</span> },
    { header: 'Customer', accessor: 'customerId', isSortable: true, render: (row: QuotationForTable) => getCustomerName(row.customerId) },
    { header: 'Quote Date', accessor: 'quoteDate', isSortable: true },
    { header: 'Expiry Date', accessor: 'expiryDate', isSortable: true },
    { header: 'Amount', accessor: 'total', isSortable: true, render: (row: QuotationForTable) => calculateTotal(row.items).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    { header: 'Status', accessor: 'status', isSortable: true, render: (row: QuotationForTable) => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.status === 'Accepted' || row.status === 'Invoiced' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{row.status}</span> },
  ];

  const currentInvoiceCustomer = previewingInvoice ? getCustomer(previewingInvoice.customerId) : null;
  const currentQuotationCustomer = previewingQuotation ? getCustomer(previewingQuotation.customerId) : null;
  
  const filterComponent = (
        <div className="flex flex-wrap items-center gap-4">
            <select name="customerId" value={filters.customerId} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm">
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
    );

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
       {isFormModalOpen && settings && (
        <Modal onClose={() => setIsFormModalOpen(false)}>
            <SalesForm
                formType={activeTab === 'invoices' ? 'invoice' : 'quotation'}
                record={editingRecord}
                customers={customers}
                products={products}
                settings={settings}
                onSave={handleSave}
                onCancel={() => setIsFormModalOpen(false)}
                onDataRefresh={fetchData}
            />
        </Modal>
       )}
       {isInvoicePreviewOpen && previewingInvoice && currentInvoiceCustomer && settings && (
         <Modal onClose={() => setIsInvoicePreviewOpen(false)}>
            <InvoicePreview 
                invoice={previewingInvoice}
                customer={currentInvoiceCustomer}
                settings={settings}
                products={products}
                onClose={() => setIsInvoicePreviewOpen(false)}
            />
         </Modal>
       )}
       {isQuotationPreviewOpen && previewingQuotation && currentQuotationCustomer && settings && (
         <Modal onClose={() => setIsQuotationPreviewOpen(false)}>
            <QuotationPreview 
                quotation={previewingQuotation}
                customer={currentQuotationCustomer}
                settings={settings}
                products={products}
                onClose={() => setIsQuotationPreviewOpen(false)}
            />
         </Modal>
       )}

      <div className="flex justify-between items-center">
        <div className="flex border-b border-border">
          <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'invoices' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
            Invoices
          </button>
          <button onClick={() => setActiveTab('quotations')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'quotations' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
            Quotations
          </button>
        </div>
        <button onClick={handleAddNew} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm">
          Create {activeTab === 'invoices' ? 'Invoice' : 'Quotation'}
        </button>
      </div>

       {loading ? <div>Loading...</div> : (activeTab === 'invoices' ? (
        <DataTable
            columns={invoiceColumns}
            data={filteredInvoices.map(i => ({...i, total: calculateTotal(i.items), balance: calculateBalance(i)}))}
            renderActions={(invoice) => (
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => handlePreviewInvoice(invoice)} className="p-1 hover:bg-muted rounded-md" title="View"><ViewIcon /></button>
                  <button onClick={() => handleEdit(invoice)} className="p-1 hover:bg-muted rounded-md" title="Edit"><EditIcon /></button>
                  <button onClick={() => handleOpenDeleteDialog(invoice)} className="p-1 hover:bg-muted rounded-md" title="Delete"><TrashIcon /></button>
                </div>
            )}
            filterConfig={filterComponent}
            searchConfig={{ placeholder: "Search Invoice # or Customer...", searchKeys: ['invoiceNumber', 'customerId'] }}
        />
       ) : (
        <DataTable
            columns={quotationColumns}
            data={filteredQuotations.map(q => ({...q, total: calculateTotal(q.items)}))}
            renderActions={(quote) => (
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => handlePreviewQuotation(quote)} className="p-1 hover:bg-muted rounded-md" title="View"><ViewIcon /></button>
                  <button onClick={() => handleEdit(quote)} className="p-1 hover:bg-muted rounded-md" title="Edit"><EditIcon /></button>
                  <button onClick={() => handleOpenDeleteDialog(quote)} className="p-1 hover:bg-muted rounded-md" title="Delete"><TrashIcon /></button>
                </div>
            )}
            filterConfig={filterComponent}
            searchConfig={{ placeholder: "Search Quote # or Customer...", searchKeys: ['quotationNumber', 'customerId'] }}
        />
       ))}
    </div>
  );
};

export default Sales;