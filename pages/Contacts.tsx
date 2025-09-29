import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Customer, CustomerData, Supplier, SupplierData, Address, SalesInvoice, PurchaseInvoice, InvoiceItem, Quotation } from '../types';
import Modal from '../components/Modal';
import { EditIcon, TrashIcon, ViewIcon } from '../components/icons';
// FIX: Import Column type to strongly type column definitions for DataTable.
import { DataTable, Column } from '../components/DataTable';
import { INDIAN_STATES } from '../constants';
import { useSnackbar } from '../hooks/useSnackbar';
import ConfirmationDialog from '../components/ConfirmationDialog';

const emptyAddress: Address = { line1: '', line2: '', district: '', state: '', country: 'India', pincode: '' };

const AddressFields: React.FC<{
  type: 'billingAddress' | 'shippingAddress' | 'address';
  address: Address;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, type: 'billingAddress' | 'shippingAddress' | 'address') => void;
  disabled?: boolean;
}> = ({ type, address, onChange, disabled }) => (
    <div className="space-y-2">
        <input name="line1" value={address.line1} onChange={e => onChange(e, type)} placeholder="Address Line 1" className="p-2 border rounded w-full bg-background border-input" disabled={disabled} />
        <input name="line2" value={address.line2} onChange={e => onChange(e, type)} placeholder="Address Line 2" className="p-2 border rounded w-full bg-background border-input" disabled={disabled} />
        <div className="grid grid-cols-2 gap-2">
            <input name="district" value={address.district} onChange={e => onChange(e, type)} placeholder="District" className="p-2 border rounded w-full bg-background border-input" disabled={disabled} />
            <select name="state" value={address.state} onChange={e => onChange(e, type)} className="p-2 border rounded w-full bg-background border-input" disabled={disabled}>
                <option value="">Select State</option>
                {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
            </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <input name="pincode" value={address.pincode} onChange={e => onChange(e, type)} placeholder="Pincode" className="p-2 border rounded w-full bg-background border-input" disabled={disabled} />
            <input name="country" value={address.country} onChange={e => onChange(e, type)} placeholder="Country" className="p-2 border rounded w-full bg-background border-input" disabled={disabled} />
        </div>
    </div>
);


export const CustomerForm: React.FC<{ customer?: Customer | null; onSave: () => void; onCancel: () => void; }> = ({ customer, onSave, onCancel }) => {
  const [formData, setFormData] = useState<CustomerData>({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    billingAddress: customer?.billingAddress || { ...emptyAddress },
    shippingAddress: customer?.shippingAddress || { ...emptyAddress },
    gstin: customer?.gstin || '',
  });
   const [isSameAddress, setIsSameAddress] = useState(
    customer ? 
    (JSON.stringify(customer.billingAddress || emptyAddress) === JSON.stringify(customer.shippingAddress || emptyAddress)) : 
    false
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, type: 'billingAddress' | 'shippingAddress') => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newAddress = { ...prev[type], [name]: value };
        if (type === 'billingAddress' && isSameAddress) {
            return {
                ...prev,
                billingAddress: newAddress,
                shippingAddress: newAddress,
            };
        }
        return {
            ...prev,
            [type]: newAddress,
        };
    });
  };
  
  useEffect(() => {
    if (isSameAddress) {
        setFormData(prev => ({ ...prev, shippingAddress: prev.billingAddress }));
    }
  }, [isSameAddress, formData.billingAddress]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customer) {
      await api.updateCustomer(customer.id, formData);
    } else {
      await api.createCustomer(formData);
    }
    onSave();
  };
  

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">{customer ? 'Edit Customer' : 'Add New Customer'}</h2>
        <div className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Customer Name</label>
                <input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Customer Name" className="p-2 border rounded w-full bg-background border-input" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                    <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="p-2 border rounded w-full bg-background border-input" />
                </div>
                 <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                    <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone Number" className="p-2 border rounded w-full bg-background border-input" />
                </div>
            </div>
             <div>
                <label htmlFor="gstin" className="block text-sm font-medium text-muted-foreground mb-1">GSTIN</label>
                <input id="gstin" name="gstin" value={formData.gstin} onChange={handleChange} placeholder="Customer GSTIN" className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Billing Address</label>
                    <AddressFields type="billingAddress" address={formData.billingAddress} onChange={handleAddressChange} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Shipping Address</label>
                     <div className="flex items-center mb-2">
                        <input type="checkbox" id="sameAsBilling" checked={isSameAddress} onChange={e => setIsSameAddress(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <label htmlFor="sameAsBilling" className="ml-2 block text-sm text-gray-900">Same as billing address</label>
                    </div>
                    <AddressFields type="shippingAddress" address={formData.shippingAddress} onChange={handleAddressChange} disabled={isSameAddress}/>
                </div>
            </div>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onCancel} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Cancel</button>
            <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">{customer ? 'Update' : 'Save'}</button>
        </div>
    </form>
  );
};


export const SupplierForm: React.FC<{ supplier?: Supplier | null; onSave: () => void; onCancel: () => void; }> = ({ supplier, onSave, onCancel }) => {
  const [formData, setFormData] = useState<SupplierData>({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || { ...emptyAddress },
    gstin: supplier?.gstin || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
        ...prev,
        address: {
            ...prev.address,
            [name]: value
        }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (supplier) {
      await api.updateSupplier(supplier.id, formData);
    } else {
      await api.createSupplier(formData);
    }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
        <div className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Supplier Name</label>
                <input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Supplier Name" className="p-2 border rounded w-full bg-background border-input" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                  <input id="email" type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="Email" className="p-2 border rounded w-full bg-background border-input" />
              </div>
              <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                  <input id="phone" type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="Phone Number" className="p-2 border rounded w-full bg-background border-input" />
              </div>
            </div>
            <div>
                <label htmlFor="gstin" className="block text-sm font-medium text-muted-foreground mb-1">GSTIN</label>
                <input id="gstin" name="gstin" value={formData.gstin} onChange={handleChange} placeholder="Supplier GSTIN" className="p-2 border rounded w-full bg-background border-input" />
            </div>
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Address</label>
                <AddressFields type="address" address={formData.address} onChange={(e) => handleAddressChange(e)} />
            </div>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onCancel} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">Cancel</button>
            <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">{supplier ? 'Update' : 'Save'}</button>
        </div>
    </form>
  );
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

const calculateTotal = (items: InvoiceItem[]) => {
    const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
    const tax = items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0);
    return subtotal + tax;
};

const CustomerDetails: React.FC<{ customer: Customer; balance: number }> = ({ customer, balance }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold">{customer.name}</h2>
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className={`text-xl font-bold ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </p>
            </div>
        </div>
        <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
            <p><strong>GSTIN:</strong> {customer.gstin || 'N/A'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                    <h4 className="font-semibold text-muted-foreground">Billing Address</h4>
                    <p className="whitespace-pre-line">{formatAddress(customer.billingAddress)}</p>
                </div>
                <div>
                    <h4 className="font-semibold text-muted-foreground">Shipping Address</h4>
                    <p className="whitespace-pre-line">{formatAddress(customer.shippingAddress)}</p>
                </div>
            </div>
        </div>
    </div>
);

const SupplierDetails: React.FC<{ supplier: Supplier; balance: number }> = ({ supplier, balance }) => (
    <div className="space-y-4">
         <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold">{supplier.name}</h2>
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className={`text-xl font-bold ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </p>
            </div>
        </div>
        <div className="space-y-2">
            <p><strong>Email:</strong> {supplier.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {supplier.phone || 'N/A'}</p>
            <p><strong>GSTIN:</strong> {supplier.gstin || 'N/A'}</p>
            <div>
                <h4 className="font-semibold text-muted-foreground">Address</h4>
                <p className="whitespace-pre-line">{formatAddress(supplier.address)}</p>
            </div>
        </div>
    </div>
);


const Contacts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Customer | Supplier | null>(null);
  const [viewingRecord, setViewingRecord] = useState<Customer | Supplier | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<Customer | Supplier | null>(null);
  const { showSnackbar } = useSnackbar();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [custs, supps, sales, purchases, quotes] = await Promise.all([
        api.getCustomers(),
        api.getSuppliers(),
        api.getSalesInvoices(),
        api.getPurchaseInvoices(),
        api.getQuotations(),
      ]);
      setCustomers(custs.sort((a, b) => b.id.localeCompare(a.id)));
      setSuppliers(supps.sort((a, b) => b.id.localeCompare(a.id)));
      setSalesInvoices(sales);
      setPurchaseInvoices(purchases);
      setQuotations(quotes);
    } catch (error) {
      console.error("Failed to fetch contacts data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };
  
  const handleView = (record: Customer | Supplier) => {
    setViewingRecord(record);
  };

  const handleEdit = (record: Customer | Supplier) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    fetchData();
  };

  const handleOpenDeleteDialog = (record: Customer | Supplier) => {
    if (activeTab === 'customers') {
        const customer = record as Customer;
        const linkedInvoices = salesInvoices.filter(inv => inv.customerId === customer.id);
        const linkedQuotations = quotations.filter(q => q.customerId === customer.id);
        if (linkedInvoices.length > 0 || linkedQuotations.length > 0) {
            const links = [];
            if (linkedInvoices.length > 0) links.push(`${linkedInvoices.length} invoice(s)`);
            if (linkedQuotations.length > 0) links.push(`${linkedQuotations.length} quotation(s)`);
            showSnackbar(`Cannot delete '${customer.name}'. This customer is associated with ${links.join(' and ')}. Please delete or reassign these records first.`, 'error');
            return;
        }
    } else {
        const supplier = record as Supplier;
        const linkedPurchases = purchaseInvoices.filter(inv => inv.supplierId === supplier.id);
        if (linkedPurchases.length > 0) {
            showSnackbar(`Cannot delete '${supplier.name}'. This supplier is associated with ${linkedPurchases.length} purchase(s). Please delete or reassign these records first.`, 'error');
            return;
        }
    }
    setRecordToDelete(record);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    
    let success = false;
    if (activeTab === 'customers') {
        success = await api.deleteCustomer(recordToDelete.id);
    } else {
        success = await api.deleteSupplier(recordToDelete.id);
    }

    if (success) {
        showSnackbar(`${activeTab === 'customers' ? 'Customer' : 'Supplier'} '${recordToDelete.name}' deleted successfully.`, 'success');
        fetchData();
    } else {
        showSnackbar(`Failed to delete '${recordToDelete.name}'. They may still have linked transactions.`, 'error');
    }
    setRecordToDelete(null);
  };

  
  const getCustomerBalance = (customerId: string) => {
      return salesInvoices
          .filter(inv => inv.customerId === customerId && inv.status !== 'Paid')
          .reduce((sum, inv) => {
              const total = calculateTotal(inv.items);
              const balance = total - (inv.amountPaid || 0);
              return sum + balance;
          }, 0);
  };

  const getSupplierBalance = (supplierId: string) => {
      return purchaseInvoices
          .filter(inv => inv.supplierId === supplierId && inv.status !== 'Paid')
          .reduce((sum, inv) => {
              const total = calculateTotal(inv.items);
              const balance = total - (inv.amountPaid || 0);
              return sum + balance;
          }, 0);
  }

  // FIX: Define a specific type for customer data used in the table.
  type CustomerWithBalance = Customer & { balance: number };
  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const customerColumns: Column<CustomerWithBalance>[] = [
    { header: 'Name', accessor: 'name', isSortable: true, render: (c: CustomerWithBalance) => <span className="font-medium">{c.name}</span> },
    { header: 'Email', accessor: 'email', isSortable: true },
    { header: 'Phone', accessor: 'phone', isSortable: true },
    { header: 'Outstanding', accessor: 'balance', isSortable: true, render: (c: CustomerWithBalance) => getCustomerBalance(c.id).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
  ];
  
  // FIX: Define a specific type for supplier data used in the table.
  type SupplierWithBalance = Supplier & { balance: number };
  // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
  const supplierColumns: Column<SupplierWithBalance>[] = [
    { header: 'Name', accessor: 'name', isSortable: true, render: (s: SupplierWithBalance) => <span className="font-medium">{s.name}</span> },
    { header: 'Email', accessor: 'email', isSortable: true },
    { header: 'Phone', accessor: 'phone', isSortable: true },
    { header: 'Outstanding', accessor: 'balance', isSortable: true, render: (s: SupplierWithBalance) => getSupplierBalance(s.id).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
  ];

  return (
    <div className="space-y-6">
       <ConfirmationDialog
            isOpen={!!recordToDelete}
            onClose={() => setRecordToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Confirm Deletion"
            message={`Are you sure you want to delete ${recordToDelete?.name}? This action cannot be undone.`}
            confirmButtonText="Delete"
            confirmButtonVariant="destructive"
        />
       {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
            {activeTab === 'customers' ? 
                <CustomerForm customer={editingRecord as Customer | null} onSave={handleSave} onCancel={() => setIsModalOpen(false)} /> :
                <SupplierForm supplier={editingRecord as Supplier | null} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            }
        </Modal>
       )}
       {viewingRecord && (
        <Modal onClose={() => setViewingRecord(null)}>
            {activeTab === 'customers' ? 
                <CustomerDetails customer={viewingRecord as Customer} balance={getCustomerBalance(viewingRecord.id)} /> :
                <SupplierDetails supplier={viewingRecord as Supplier} balance={getSupplierBalance(viewingRecord.id)} />
            }
        </Modal>
       )}
      <div className="flex justify-between items-center">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'customers' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'suppliers' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            Suppliers
          </button>
        </div>
        <button onClick={handleAddNew} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm">
          Add New {activeTab === 'customers' ? 'Customer' : 'Supplier'}
        </button>
      </div>

      {loading ? <div>Loading...</div> : (activeTab === 'customers' ? (
        <DataTable
            columns={customerColumns}
            data={customers.map(c => ({...c, balance: getCustomerBalance(c.id)}))}
            renderActions={(c) => (
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => handleView(c)} className="p-1 hover:bg-muted rounded-md" title="View"><ViewIcon /></button>
                  <button onClick={() => handleEdit(c)} className="p-1 hover:bg-muted rounded-md" title="Edit"><EditIcon /></button>
                  <button onClick={() => handleOpenDeleteDialog(c)} className="p-1 hover:bg-muted rounded-md" title="Delete"><TrashIcon /></button>
                </div>
            )}
            searchConfig={{ placeholder: "Search by Customer Name...", searchKeys: ['name', 'email', 'phone'] }}
        />
      ) : (
        <DataTable
            columns={supplierColumns}
            data={suppliers.map(s => ({...s, balance: getSupplierBalance(s.id)}))}
            renderActions={(s) => (
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => handleView(s)} className="p-1 hover:bg-muted rounded-md" title="View"><ViewIcon /></button>
                  <button onClick={() => handleEdit(s)} className="p-1 hover:bg-muted rounded-md" title="Edit"><EditIcon /></button>
                  <button onClick={() => handleOpenDeleteDialog(s)} className="p-1 hover:bg-muted rounded-md" title="Delete"><TrashIcon /></button>
                </div>
            )}
            searchConfig={{ placeholder: "Search by Supplier Name...", searchKeys: ['name'] }}
        />
      ))}
    </div>
  );
};

export default Contacts;