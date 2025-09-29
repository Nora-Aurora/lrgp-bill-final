import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { AppSettings, CompanyDetails, InvoiceSettings } from '../types';
import { INDIAN_STATES } from '../constants';
import { useSnackbar } from '../hooks/useSnackbar';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'company' | 'invoice' | 'data'>('company');
    const { showSnackbar } = useSnackbar();

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getSettings();
            setSettings(data);
        } catch (error) {
            console.error("Failed to fetch settings:", error);
            showSnackbar('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    }, [showSnackbar]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleCompanyDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!settings) return;
        const { name, value } = e.target;
        
        if (name.startsWith('address.')) {
            const field = name.split('.')[1];
            setSettings(prev => ({
                ...prev!,
                companyDetails: {
                    ...prev!.companyDetails,
                    address: {
                        ...prev!.companyDetails.address,
                        [field]: value,
                    }
                }
            }));
        } else {
            setSettings(prev => ({
                ...prev!,
                companyDetails: {
                    ...prev!.companyDetails,
                    [name]: value,
                }
            }));
        }
    };

    const handleInvoiceSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!settings) return;
        const { name, value } = e.target;
        const valueToSet = e.target.type === 'number' ? parseInt(value, 10) || 0 : value;

        if (name.startsWith('bankDetails.')) {
            const field = name.split('.')[1];
            setSettings(prev => ({
                ...prev!,
                invoiceSettings: {
                    ...prev!.invoiceSettings,
                    bankDetails: {
                        ...(prev!.invoiceSettings.bankDetails || { bankName: '', accountNumber: '', ifscCode: '', branch: '' }),
                        [field]: valueToSet,
                    }
                }
            }));
        } else {
            setSettings(prev => ({
                ...prev!,
                invoiceSettings: {
                    ...prev!.invoiceSettings,
                    [name]: valueToSet,
                }
            }));
        }
    };
    
    const handleSave = async () => {
        if (!settings) return;
        try {
            await api.updateSettings(settings);
            showSnackbar('Settings saved successfully!', 'success');
        } catch(e) {
            showSnackbar('Failed to save settings.', 'error');
        }
    }

    const handleExport = async () => {
        try {
            const data = await api.exportDb();
            const blob = new Blob([data], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zenith-backup-${new Date().toISOString().split('T')[0]}.db`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSnackbar('Database exported successfully!', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showSnackbar('Database export failed.', 'error');
        }
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result;
                if (arrayBuffer instanceof ArrayBuffer) {
                    const u8array = new Uint8Array(arrayBuffer);
                    await api.importDb(u8array);
                    showSnackbar('Database imported! The app will now reload.', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                }
            } catch (error) {
                console.error('Import failed:', error);
                showSnackbar('Import failed. Please use a valid database file.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        // Reset file input value to allow re-uploading the same file
        event.target.value = '';
    };

    if (loading || !settings) {
        return <div>Loading settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('company')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'company' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                >
                    Company Details
                </button>
                <button
                    onClick={() => setActiveTab('invoice')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'invoice' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                >
                    Invoice Customization
                </button>
                 <button
                    onClick={() => setActiveTab('data')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'data' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                >
                    Data Management
                </button>
            </div>
            
            {activeTab === 'company' && (
                <div className="bg-card p-6 rounded-lg border border-border shadow-sm animate-slide-in-right">
                    <h2 className="text-xl font-semibold mb-4">Company Details</h2>
                    <div className="space-y-4">
                         <div>
                            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Company Name</label>
                            <input id="name" name="name" value={settings.companyDetails.name} onChange={handleCompanyDetailsChange} className="p-2 border rounded w-full bg-background border-input" />
                        </div>
                         <div>
                            <label htmlFor="gstin" className="block text-sm font-medium text-muted-foreground mb-1">GSTIN</label>
                            <input id="gstin" name="gstin" value={settings.companyDetails.gstin} onChange={handleCompanyDetailsChange} className="p-2 border rounded w-full bg-background border-input" />
                        </div>
                         <div>
                            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">Email Address</label>
                            <input id="email" type="email" name="email" value={settings.companyDetails.email} onChange={handleCompanyDetailsChange} className="p-2 border rounded w-full bg-background border-input" />
                        </div>
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">Phone Number</label>
                            <input id="phone" name="phone" value={settings.companyDetails.phone} onChange={handleCompanyDetailsChange} className="p-2 border rounded w-full bg-background border-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Address</label>
                            <div className="space-y-2 border p-3 rounded-md bg-background/50">
                                <input name="address.line1" value={settings.companyDetails.address.line1} onChange={handleCompanyDetailsChange} placeholder="Address Line 1" className="p-2 border rounded w-full bg-background border-input" />
                                <input name="address.line2" value={settings.companyDetails.address.line2} onChange={handleCompanyDetailsChange} placeholder="Address Line 2" className="p-2 border rounded w-full bg-background border-input" />
                                <div className="grid grid-cols-2 gap-2">
                                    <input name="address.district" value={settings.companyDetails.address.district} onChange={handleCompanyDetailsChange} placeholder="District" className="p-2 border rounded w-full bg-background border-input" />
                                     <select name="address.state" value={settings.companyDetails.address.state} onChange={handleCompanyDetailsChange} className="p-2 border rounded w-full bg-background border-input">
                                        <option value="">Select State</option>
                                        {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input name="address.pincode" value={settings.companyDetails.address.pincode} onChange={handleCompanyDetailsChange} placeholder="Pincode" className="p-2 border rounded w-full bg-background border-input" />
                                    <input name="address.country" value={settings.companyDetails.address.country} onChange={handleCompanyDetailsChange} placeholder="Country" className="p-2 border rounded w-full bg-background border-input" disabled />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'invoice' && (
                 <div className="bg-card p-6 rounded-lg border border-border shadow-sm animate-slide-in-right">
                    <h2 className="text-xl font-semibold mb-4">Invoice Customization</h2>
                     <div className="space-y-4">
                        <div>
                            <label htmlFor="logoUrl" className="block text-sm font-medium text-muted-foreground mb-1">Logo URL</label>
                            <input id="logoUrl" name="logoUrl" value={settings.companyDetails.logoUrl} onChange={handleCompanyDetailsChange} className="p-2 border rounded w-full bg-background border-input" placeholder="https://your-domain.com/logo.png"/>
                        </div>
                         <div>
                            <label htmlFor="accentColor" className="block text-sm font-medium text-muted-foreground mb-1">Invoice Accent Color</label>
                            <input id="accentColor" type="color" name="accentColor" value={settings.invoiceSettings.accentColor} onChange={handleInvoiceSettingsChange} className="p-1 h-10 w-full block border border-input rounded-md"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="invoiceNumberPrefix" className="block text-sm font-medium text-muted-foreground mb-1">Invoice Number Prefix</label>
                                <input id="invoiceNumberPrefix" name="invoiceNumberPrefix" value={settings.invoiceSettings.invoiceNumberPrefix} onChange={handleInvoiceSettingsChange} className="p-2 border rounded w-full bg-background border-input" placeholder="e.g., INV-"/>
                            </div>
                            <div>
                                <label htmlFor="nextInvoiceNumber" className="block text-sm font-medium text-muted-foreground mb-1">Next Invoice Number</label>
                                <input id="nextInvoiceNumber" type="number" name="nextInvoiceNumber" value={settings.invoiceSettings.nextInvoiceNumber} onChange={handleInvoiceSettingsChange} className="p-2 border rounded w-full bg-background border-input" />
                            </div>
                        </div>
                         <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground mb-1">Default Notes</label>
                            <textarea id="notes" name="notes" value={settings.invoiceSettings.notes} onChange={handleInvoiceSettingsChange} rows={3} className="p-2 border rounded w-full bg-background border-input" placeholder="e.g., Thank you for your business!"/>
                        </div>
                         <div>
                            <label htmlFor="terms" className="block text-sm font-medium text-muted-foreground mb-1">Terms & Conditions</label>
                            <textarea id="terms" name="terms" value={settings.invoiceSettings.terms} onChange={handleInvoiceSettingsChange} rows={4} className="p-2 border rounded w-full bg-background border-input" placeholder="e.g., Payment due within 30 days."/>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2 mt-4 text-muted-foreground">Bank Details for Payment</h3>
                            <div className="space-y-2 border p-3 rounded-md bg-background/50">
                                <input name="bankDetails.bankName" value={settings.invoiceSettings.bankDetails?.bankName || ''} onChange={handleInvoiceSettingsChange} placeholder="Bank Name" className="p-2 border rounded w-full bg-background border-input" />
                                <input name="bankDetails.accountNumber" value={settings.invoiceSettings.bankDetails?.accountNumber || ''} onChange={handleInvoiceSettingsChange} placeholder="Account Number" className="p-2 border rounded w-full bg-background border-input" />
                                <input name="bankDetails.ifscCode" value={settings.invoiceSettings.bankDetails?.ifscCode || ''} onChange={handleInvoiceSettingsChange} placeholder="IFSC Code" className="p-2 border rounded w-full bg-background border-input" />
                                <input name="bankDetails.branch" value={settings.invoiceSettings.bankDetails?.branch || ''} onChange={handleInvoiceSettingsChange} placeholder="Branch" className="p-2 border rounded w-full bg-background border-input" />
                            </div>
                        </div>
                     </div>
                </div>
            )}
            
            {activeTab === 'data' && (
                 <div className="bg-card p-6 rounded-lg border border-border shadow-sm animate-slide-in-right">
                    <h2 className="text-xl font-semibold mb-4">Database Management</h2>
                    <div className="space-y-4">
                        <div className="p-4 border rounded-md flex justify-between items-center">
                            <div>
                                <h3 className="font-medium">Export Data</h3>
                                <p className="text-sm text-muted-foreground">Download a backup of your entire database as a .db file.</p>
                            </div>
                            <button onClick={handleExport} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-sm font-medium">
                                Export Database
                            </button>
                        </div>
                        <div className="p-4 border rounded-md flex justify-between items-center">
                            <div>
                                <h3 className="font-medium">Import Data</h3>
                                <p className="text-sm text-muted-foreground">Restore your data from a .db backup file. This will overwrite all current data.</p>
                            </div>
                            <label htmlFor="import-db" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                                Import Database
                            </label>
                            <input type="file" id="import-db" className="hidden" onChange={handleImport} accept=".db,application/x-sqlite3" />
                        </div>
                    </div>
                </div>
            )}


            <div className="flex justify-end">
                <button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-lg text-sm font-semibold">
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default Settings;
