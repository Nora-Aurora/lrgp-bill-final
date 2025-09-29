import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import type { SalesInvoice, Product, Customer, PurchaseInvoice, Supplier, InvoiceItem, AppSettings } from '../types';
// FIX: Import Column type to strongly type column definitions for DataTable.
import { DataTable, Column } from '../components/DataTable';
import StatCard from '../components/StatCard';
import { CreditCardIcon, PackageIcon, DownloadIcon } from '../components/icons';

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


const GstReport: React.FC<{
    salesInvoices: SalesInvoice[];
    purchaseInvoices: PurchaseInvoice[];
    customers: Customer[];
    suppliers: Supplier[];
    settings: AppSettings;
}> = ({ salesInvoices, purchaseInvoices, customers, suppliers, settings }) => {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({ startDate: firstDayOfMonth, endDate: today });

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    const companyState = settings.companyDetails.address.state?.trim().toLowerCase();

    const gstData = useMemo(() => {
        const startDate = safeParseDate(filters.startDate);
        const endDate = safeParseDate(filters.endDate);
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);

        const filteredSales = salesInvoices.filter(inv => {
            const invDate = safeParseDate(inv.invoiceDate);
            // GST liability is considered on paid or partially paid invoices for this report
            const isValidStatus = inv.status === 'Paid' || inv.status === 'Partially Paid';
            return isValidStatus && invDate && (!startDate || invDate >= startDate) && (!endDate || invDate <= endDate);
        });

        const filteredPurchases = purchaseInvoices.filter(inv => {
            const invDate = safeParseDate(inv.purchaseDate);
            // Input tax credit is considered on paid or partially paid invoices for this report
            const isValidStatus = inv.status === 'Paid' || inv.status === 'Partially Paid';
            return isValidStatus && invDate && (!startDate || invDate >= startDate) && (!endDate || invDate <= endDate);
        });

        // Calculate Output Tax
        let outputCgst = 0, outputSgst = 0, outputIgst = 0;
        const salesGstDetails = filteredSales.map(inv => {
            const customer = customers.find(c => c.id === inv.customerId);
            const customerState = customer?.billingAddress?.state?.trim().toLowerCase();
            const isInterState = !customerState || !companyState || customerState !== companyState;
            
            let invTaxable = 0, invCgst = 0, invSgst = 0, invIgst = 0, invTotal = 0;

            inv.items.forEach(item => {
                const taxableValue = item.quantity * item.rate;
                const taxAmount = taxableValue * (item.taxRate / 100);
                invTaxable += taxableValue;
                invTotal += taxableValue + taxAmount;
                if (isInterState) {
                    invIgst += taxAmount;
                } else {
                    invCgst += taxAmount / 2;
                    invSgst += taxAmount / 2;
                }
            });
            outputCgst += invCgst;
            outputSgst += invSgst;
            outputIgst += invIgst;

            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                date: inv.invoiceDate,
                contactName: customer?.name || 'N/A',
                gstin: customer?.gstin || 'N/A',
                taxableValue: invTaxable,
                cgst: invCgst,
                sgst: invSgst,
                igst: invIgst,
                total: invTotal,
            };
        });

        // Calculate Input Tax Credit
        let inputCgst = 0, inputSgst = 0, inputIgst = 0;
        const purchaseGstDetails = filteredPurchases.map(inv => {
            const supplier = suppliers.find(s => s.id === inv.supplierId);
            const supplierState = supplier?.address?.state?.trim().toLowerCase();
            const isInterState = !supplierState || !companyState || supplierState !== companyState;
            
            let invTaxable = 0, invCgst = 0, invSgst = 0, invIgst = 0, invTotal = 0;

            inv.items.forEach(item => {
                const taxableValue = item.quantity * item.rate;
                const taxAmount = taxableValue * (item.taxRate / 100);
                invTaxable += taxableValue;
                invTotal += taxableValue + taxAmount;
                if (isInterState) {
                    invIgst += taxAmount;
                } else {
                    invCgst += taxAmount / 2;
                    invSgst += taxAmount / 2;
                }
            });
            inputCgst += invCgst;
            inputSgst += invSgst;
            inputIgst += invIgst;
            
             return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                date: inv.purchaseDate,
                contactName: supplier?.name || 'N/A',
                gstin: supplier?.gstin || 'N/A',
                taxableValue: invTaxable,
                cgst: invCgst,
                sgst: invSgst,
                igst: invIgst,
                total: invTotal,
            };
        });

        const netGstPayable = (outputCgst + outputSgst + outputIgst) - (inputCgst + inputSgst + inputIgst);
        
        return {
            outputCgst, outputSgst, outputIgst,
            inputCgst, inputSgst, inputIgst,
            netGstPayable,
            salesGstDetails,
            purchaseGstDetails,
        };

    }, [filters, salesInvoices, purchaseInvoices, customers, suppliers, companyState]);
    
    const handleExportToExcel = () => {
        // @ts-ignore
        if (typeof XLSX === 'undefined') {
            alert('Excel export library is not loaded.');
            return;
        }

        const {
            outputCgst, outputSgst, outputIgst,
            inputCgst, inputSgst, inputIgst,
            netGstPayable,
            salesGstDetails,
            purchaseGstDetails,
        } = gstData;

        // 1. Summary Sheet
        const summaryData = [
            ["GST Summary Report"],
            [`Period: ${filters.startDate} to ${filters.endDate}`],
            [],
            ["", "CGST", "SGST", "IGST", "Total"],
            [
                "Output Tax (on Sales)",
                outputCgst,
                outputSgst,
                outputIgst,
                (outputCgst + outputSgst + outputIgst)
            ],
            [
                "Input Tax Credit (on Purchases)",
                inputCgst,
                inputSgst,
                inputIgst,
                (inputCgst + inputSgst + inputIgst)
            ],
            [],
            ["Net GST Payable", "", "", "", netGstPayable]
        ];
        // @ts-ignore
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

        // 2. Sales Sheet
        const salesHeaders = ["Invoice #", "Date", "Contact Name", "GSTIN", "Taxable Value", "CGST", "SGST", "IGST", "Total"];
        const salesData = [
            salesHeaders,
            ...salesGstDetails.map(row => [
                row.invoiceNumber, row.date, row.contactName, row.gstin,
                row.taxableValue, row.cgst, row.sgst, row.igst, row.total
            ])
        ];
        // @ts-ignore
        const wsSales = XLSX.utils.aoa_to_sheet(salesData);

        // 3. Purchase Sheet
        const purchaseHeaders = ["Invoice #", "Date", "Contact Name", "GSTIN", "Taxable Value", "CGST", "SGST", "IGST", "Total"];
        const purchaseData = [
            purchaseHeaders,
            ...purchaseGstDetails.map(row => [
                row.invoiceNumber, row.date, row.contactName, row.gstin,
                row.taxableValue, row.cgst, row.sgst, row.igst, row.total
            ])
        ];
        // @ts-ignore
        const wsPurchases = XLSX.utils.aoa_to_sheet(purchaseData);
        
        // Create workbook and append sheets
        // @ts-ignore
        const wb = XLSX.utils.book_new();
        // @ts-ignore
        XLSX.utils.book_append_sheet(wb, wsSummary, "GST Summary");
        // @ts-ignore
        XLSX.utils.book_append_sheet(wb, wsSales, "GSTR-1 (Sales)");
        // @ts-ignore
        XLSX.utils.book_append_sheet(wb, wsPurchases, "GSTR-2 (Purchases)");

        // Trigger download
        // @ts-ignore
        XLSX.writeFile(wb, `GST_Report_${filters.startDate}_to_${filters.endDate}.xlsx`);
    };

    // FIX: Define a specific type for GST data used in the table.
    type GstRow = {
        id: string;
        invoiceNumber: string;
        date: string;
        contactName: string;
        gstin: string;
        taxableValue: number;
        cgst: number;
        sgst: number;
        igst: number;
        total: number;
    }
    // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
    const gstColumns: Column<GstRow>[] = [
        { header: 'Invoice #', accessor: 'invoiceNumber', isSortable: true },
        { header: 'Date', accessor: 'date', isSortable: true },
        { header: 'Contact Name', accessor: 'contactName', isSortable: true },
        { header: 'GSTIN', accessor: 'gstin', isSortable: false },
        { header: 'Taxable Value', accessor: 'taxableValue', isSortable: true, render: (row: GstRow) => row.taxableValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'CGST', accessor: 'cgst', isSortable: true, render: (row: GstRow) => row.cgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'SGST', accessor: 'sgst', isSortable: true, render: (row: GstRow) => row.sgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'IGST', accessor: 'igst', isSortable: true, render: (row: GstRow) => row.igst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'Total', accessor: 'total', isSortable: true, render: (row: GstRow) => row.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-card p-4 rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label htmlFor="gstStartDate" className="text-sm font-medium text-muted-foreground">Start Date:</label>
                            <input id="gstStartDate" type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="gstEndDate" className="text-sm font-medium text-muted-foreground">End Date:</label>
                            <input id="gstEndDate" type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                        </div>
                    </div>
                     <button onClick={handleExportToExcel} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                        <DownloadIcon className="h-4 w-4" />
                        Export to Excel
                    </button>
                </div>
            </div>

            <div className="bg-card p-6 rounded-lg border space-y-4">
                <h3 className="text-lg font-semibold">GST Summary for Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <p className="font-semibold text-primary">Output Tax (on Sales)</p>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total CGST:</span> <span>{gstData.outputCgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total SGST:</span> <span>{gstData.outputSgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total IGST:</span> <span>{gstData.outputIgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between text-sm font-bold border-t pt-1"><span >Total Output Tax:</span> <span>{(gstData.outputCgst + gstData.outputSgst + gstData.outputIgst).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    </div>
                     <div className="space-y-2">
                        <p className="font-semibold text-primary">Input Tax Credit (on Purchases)</p>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total CGST:</span> <span>{gstData.inputCgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total SGST:</span> <span>{gstData.inputSgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total IGST:</span> <span>{gstData.inputIgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                        <div className="flex justify-between text-sm font-bold border-t pt-1"><span >Total Input Credit:</span> <span>{(gstData.inputCgst + gstData.inputSgst + gstData.inputIgst).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                    </div>
                     <div className="space-y-2 bg-muted p-3 rounded-md">
                        <p className="font-semibold text-lg">Net GST Payable</p>
                         <p className="font-bold text-2xl text-primary">{gstData.netGstPayable.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold mb-4">GSTR-1 Summary (Sales)</h3>
                    <DataTable columns={gstColumns} data={gstData.salesGstDetails} renderActions={() => <></>} />
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-4">GSTR-2 Summary (Purchases - Input Tax Credit)</h3>
                    <DataTable columns={gstColumns} data={gstData.purchaseGstDetails} renderActions={() => <></>} />
                </div>
            </div>
        </div>
    );
};


const Reports: React.FC = () => {
    const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'stock' | 'gst'>('sales');

    const [salesFilters, setSalesFilters] = useState({ customerId: '', startDate: '', endDate: '' });
    const [purchaseFilters, setPurchaseFilters] = useState({ supplierId: '', startDate: '', endDate: '' });
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [sales, purchases, prods, custs, supps, settingsData] = await Promise.all([
                    api.getSalesInvoices(),
                    api.getPurchaseInvoices(),
                    api.getProducts(),
                    api.getCustomers(),
                    api.getSuppliers(),
                    api.getSettings(),
                ]);
                setSalesInvoices(sales.sort((a, b) => b.id.localeCompare(a.id)));
                setPurchaseInvoices(purchases.sort((a, b) => b.id.localeCompare(a.id)));
                setProducts(prods.sort((a, b) => b.id.localeCompare(a.id)));
                setCustomers(custs);
                setSuppliers(supps);
                setSettings(settingsData);
            } catch (error) {
                console.error("Failed to fetch report data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const calculateTotal = (items: InvoiceItem[]) => {
        const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
        const tax = items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0);
        return subtotal + tax;
    }

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown';
    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';
    
    // Memos for filtered data
    const filteredSales = useMemo(() => {
        return salesInvoices.filter(inv => {
            const invDate = safeParseDate(inv.invoiceDate);
            const startDate = safeParseDate(salesFilters.startDate);
            const endDate = safeParseDate(salesFilters.endDate);
            
            if (!invDate) return false;
            if (startDate) startDate.setHours(0,0,0,0);
            if (endDate) endDate.setHours(23,59,59,999);
            
            return (
                (salesFilters.customerId ? inv.customerId === salesFilters.customerId : true) &&
                (startDate ? invDate >= startDate : true) &&
                (endDate ? invDate <= endDate : true)
            )
        })
    }, [salesInvoices, salesFilters]);

    const filteredPurchases = useMemo(() => {
        return purchaseInvoices.filter(inv => {
            const invDate = safeParseDate(inv.purchaseDate);
            const startDate = safeParseDate(purchaseFilters.startDate);
            const endDate = safeParseDate(purchaseFilters.endDate);

            if (!invDate) return false;
            if (startDate) startDate.setHours(0,0,0,0);
            if (endDate) endDate.setHours(23,59,59,999);
            
            return (
                (purchaseFilters.supplierId ? inv.supplierId === purchaseFilters.supplierId : true) &&
                (startDate ? invDate >= startDate : true) &&
                (endDate ? invDate <= endDate : true)
            )
        })
    }, [purchaseInvoices, purchaseFilters]);


    // Columns
    // FIX: Define a specific type for sales invoice data used in the table.
    type SalesInvoiceForTable = SalesInvoice & { total: number };
    // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
    const salesColumns: Column<SalesInvoiceForTable>[] = [
        { header: 'Invoice #', accessor: 'invoiceNumber', isSortable: true, render: (row: SalesInvoiceForTable) => <span className="font-medium">{row.invoiceNumber}</span> },
        { header: 'Customer', accessor: 'customerId', isSortable: true, render: (row: SalesInvoiceForTable) => getCustomerName(row.customerId) },
        { header: 'Date', accessor: 'invoiceDate', isSortable: true },
        { header: 'Amount', accessor: 'total', isSortable: true, render: (row: SalesInvoiceForTable) => calculateTotal(row.items).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'Status', accessor: 'status', isSortable: true },
    ];
    
    // FIX: Define a specific type for product data used in the stock report table.
    type ProductWithStockValue = Product & { stockValue: number };
    // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
    const stockColumns: Column<ProductWithStockValue>[] = [
        { header: 'Product Name', accessor: 'name', isSortable: true },
        { header: 'SKU', accessor: 'sku', isSortable: true },
        { header: 'Stock Qty', accessor: 'stock', isSortable: true, render: (p: ProductWithStockValue) => <span className={`font-bold ${p.stock !== null && p.reorderPoint !== null && p.stock <= p.reorderPoint ? 'text-red-500' : 'text-foreground'}`}>{p.stock}</span> },
        { header: 'Purchase Price', accessor: 'purchasePrice', isSortable: true, render: (p: ProductWithStockValue) => p.purchasePrice.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'Stock Value', accessor: 'stockValue', isSortable: true, render: (p: ProductWithStockValue) => ((p.stock || 0) * p.purchasePrice).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })},
    ];
    
    // FIX: Define a specific type for purchase invoice data used in the table.
    type PurchaseInvoiceForTable = PurchaseInvoice & { total: number };
    // FIX: Strongly type the columns definition to enable correct type inference in DataTable.
    const purchaseColumns: Column<PurchaseInvoiceForTable>[] = [
        { header: 'Invoice #', accessor: 'invoiceNumber', isSortable: true, render: (row: PurchaseInvoiceForTable) => <span className="font-medium">{row.invoiceNumber}</span> },
        { header: 'Supplier', accessor: 'supplierId', isSortable: true, render: (row: PurchaseInvoiceForTable) => getSupplierName(row.supplierId) },
        { header: 'Date', accessor: 'purchaseDate', isSortable: true },
        { header: 'Amount', accessor: 'total', isSortable: true, render: (row: PurchaseInvoiceForTable) => calculateTotal(row.items).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
        { header: 'Status', accessor: 'status', isSortable: true },
    ];
    
    const totalSales = useMemo(() => filteredSales.reduce((acc, inv) => acc + calculateTotal(inv.items), 0), [filteredSales]);
    const totalPurchases = useMemo(() => filteredPurchases.reduce((acc, inv) => acc + calculateTotal(inv.items), 0), [filteredPurchases]);

    if (loading) {
        return <div>Loading reports...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex border-b border-border">
                <button onClick={() => setActiveTab('sales')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'sales' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
                    Sales Report
                </button>
                <button onClick={() => setActiveTab('purchases')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'purchases' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
                    Purchase Report
                </button>
                <button onClick={() => setActiveTab('stock')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'stock' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
                    Stock Report
                </button>
                <button onClick={() => setActiveTab('gst')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'gst' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
                    GST Report
                </button>
            </div>
            
            {activeTab === 'sales' && (
                <div className="space-y-4">
                    <StatCard title="Total Sales" value={totalSales.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} icon={<CreditCardIcon />} description={`For the selected period`} />
                    <DataTable 
                        columns={salesColumns}
                        data={filteredSales.map(i => ({...i, total: calculateTotal(i.items)}))}
                        renderActions={() => <></>}
                        filterConfig={(
                            <div className="flex flex-wrap items-center gap-4">
                                <select name="customerId" value={salesFilters.customerId} onChange={e => setSalesFilters(p => ({...p, customerId: e.target.value}))} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm">
                                    <option value="">All Customers</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="salesStartDate" className="text-sm font-medium text-muted-foreground">Start Date:</label>
                                    <input id="salesStartDate" type="date" name="startDate" value={salesFilters.startDate} onChange={e => setSalesFilters(p => ({...p, startDate: e.target.value}))} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="salesEndDate" className="text-sm font-medium text-muted-foreground">End Date:</label>
                                    <input id="salesEndDate" type="date" name="endDate" value={salesFilters.endDate} onChange={e => setSalesFilters(p => ({...p, endDate: e.target.value}))} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                                </div>
                            </div>
                        )}
                    />
                </div>
            )}
            
            {activeTab === 'purchases' && (
                <div className="space-y-4">
                    <StatCard title="Total Purchases" value={totalPurchases.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} icon={<PackageIcon />} description={`For the selected period`} />
                    <DataTable
                        columns={purchaseColumns}
                        data={filteredPurchases.map(i => ({...i, total: calculateTotal(i.items)}))}
                        renderActions={() => <></>}
                        filterConfig={(
                             <div className="flex flex-wrap items-center gap-4">
                                <select name="supplierId" value={purchaseFilters.supplierId} onChange={e => setPurchaseFilters(p => ({...p, supplierId: e.target.value}))} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm">
                                    <option value="">All Suppliers</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="purchaseStartDate" className="text-sm font-medium text-muted-foreground">Start Date:</label>
                                    <input id="purchaseStartDate" type="date" name="startDate" value={purchaseFilters.startDate} onChange={e => setPurchaseFilters(p => ({...p, startDate: e.target.value}))} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="purchaseEndDate" className="text-sm font-medium text-muted-foreground">End Date:</label>
                                    <input id="purchaseEndDate" type="date" name="endDate" value={purchaseFilters.endDate} onChange={e => setPurchaseFilters(p => ({...p, endDate: e.target.value}))} className="p-2 border rounded w-full md:w-auto bg-background border-input text-sm" />
                                </div>
                            </div>
                        )}
                    />
                </div>
            )}
            
            {activeTab === 'stock' && (
                <DataTable
                    columns={stockColumns}
                    data={products.filter(p => !p.isService).map(p => ({...p, stockValue: (p.stock || 0) * p.purchasePrice}))}
                    renderActions={() => <></>}
                    searchConfig={{ placeholder: 'Search products...', searchKeys: ['name', 'sku'] }}
                />
            )}
            
            {activeTab === 'gst' && settings && (
                <GstReport
                    salesInvoices={salesInvoices}
                    purchaseInvoices={purchaseInvoices}
                    customers={customers}
                    suppliers={suppliers}
                    settings={settings}
                />
            )}
        </div>
    );
};

export default Reports;