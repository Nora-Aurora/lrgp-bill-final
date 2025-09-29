
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatCard from '../components/StatCard';
import { CreditCardIcon, UsersIcon, ActivityIcon, PackageIcon } from '../components/icons';
import type { SalesInvoice, PurchaseInvoice, Product, InvoiceItem } from '../types';
import { api } from '../api';

const calculateInvoiceTotal = (items: InvoiceItem[]): number => {
    const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
    const tax = items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.taxRate / 100)), 0);
    return subtotal + tax;
}

// A timezone-safe way to parse 'YYYY-MM-DD' strings to UTC dates
const safeParseDateUTC = (dateString: string): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(Date.UTC(year, month, day));
    }
  }
  return null;
};

// Processes sales invoices to aggregate daily sales for the last 30 days
const processSalesForLast30Days = (sales: SalesInvoice[]) => {
    const dataMap = new Map<string, number>();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Initialize map with the last 30 days to ensure all days are present
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today.getTime());
        date.setUTCDate(today.getUTCDate() - i);
        const dayKey = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' });
        dataMap.set(dayKey, 0);
    }

    const thirtyDaysAgo = new Date(today.getTime());
    thirtyDaysAgo.setUTCDate(today.getUTCDate() - 30);

    sales.forEach(invoice => {
        const invoiceDate = safeParseDateUTC(invoice.invoiceDate);
        if (invoiceDate && invoiceDate >= thirtyDaysAgo && invoiceDate <= today) {
            const dayKey = invoiceDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' });
            if (dataMap.has(dayKey)) {
                dataMap.set(dayKey, (dataMap.get(dayKey) || 0) + calculateInvoiceTotal(invoice.items));
            }
        }
    });
    
    // Convert map to array format required by recharts, preserving order
    return Array.from(dataMap.entries()).map(([name, salesValue]) => ({
        name,
        sales: salesValue,
    }));
};


const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalSales: '₹0.00',
    totalPurchases: '₹0.00',
    totalReceivables: '₹0.00',
    lowStockItemsCount: '0'
  });
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [recentActivities, setRecentActivities] = useState<(SalesInvoice | PurchaseInvoice)[]>([]);
  const [salesChartData, setSalesChartData] = useState<{ name: string; sales: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sales, purchases, products] = await Promise.all([
          api.getSalesInvoices(),
          api.getPurchaseInvoices(),
          api.getProducts(),
        ]);

        const totalSales = sales.reduce((acc, inv) => acc + calculateInvoiceTotal(inv.items), 0);
        const totalPurchases = purchases.reduce((acc, inv) => acc + calculateInvoiceTotal(inv.items), 0);
        
        const totalReceivables = sales
          .filter(inv => inv.status !== 'Paid')
          .reduce((acc, inv) => {
              const total = calculateInvoiceTotal(inv.items);
              const balance = total - (inv.amountPaid || 0);
              return acc + balance;
          }, 0);

        const lowStock = products.filter(p => !p.isService && p.stock !== null && p.reorderPoint !== null && p.stock <= p.reorderPoint);
        
        setStats({
          totalSales: totalSales.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
          totalPurchases: totalPurchases.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
          totalReceivables: totalReceivables.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
          lowStockItemsCount: lowStock.length.toString()
        });
        
        setSalesChartData(processSalesForLast30Days(sales));
        setLowStockItems(lowStock);

        const combinedActivities = [...sales, ...purchases]
          .sort((a, b) => {
            const dateA = new Date('purchaseDate' in a ? a.purchaseDate : a.invoiceDate).getTime();
            const dateB = new Date('purchaseDate' in b ? b.purchaseDate : b.invoiceDate).getTime();
            return dateB - dateA; // Sort descending
          })
          .slice(0, 5);

        setRecentActivities(combinedActivities);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
      return <div>Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Sales (Month)" value={stats.totalSales} icon={<CreditCardIcon />} description="+20.1% from last month" />
        <StatCard title="Total Purchases (Month)" value={stats.totalPurchases} icon={<PackageIcon />} description="+18.1% from last month" />
        <StatCard title="Total Receivables" value={stats.totalReceivables} icon={<UsersIcon />} description="Outstanding invoices" />
        <StatCard title="Low Stock Items" value={stats.lowStockItemsCount} icon={<ActivityIcon />} description="Items needing reorder" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-12 lg:col-span-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Sales Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value)/1000}k`}/>
              <Tooltip
                contentStyle={{ 
                    backgroundColor: 'hsl(0 0% 100%)', 
                    border: '1px solid hsl(214.3 31.8% 91.4%)', 
                    borderRadius: '0.5rem' 
                }}
                formatter={(value: number) => [value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }), 'Sales']}
                labelFormatter={(label) => <span className="font-semibold">{label}</span>}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{top: -10, right: 0}}/>
              <Line 
                type="monotone" 
                dataKey="sales" 
                name="Sales"
                stroke="hsl(222.2 47.4% 11.2%)" 
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(222.2 47.4% 11.2%)', strokeWidth: 1 }}
                activeDot={{ r: 6, stroke: 'hsl(222.2 47.4% 11.2%)', fill: '#fff', strokeWidth: 2 }} 
               />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="col-span-12 lg:col-span-3 bg-card p-4 rounded-lg border border-border shadow-sm">
           <h3 className="text-lg font-semibold mb-4">Low Stock Alerts</h3>
           <div className="space-y-4 max-h-[280px] overflow-y-auto">
             {lowStockItems.length > 0 ? lowStockItems.map(item => (
                <div key={item.id} className="flex items-center">
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                            Stock: <span className="text-red-500 font-bold">{item.stock ?? 'N/A'}</span> | Reorder at: {item.reorderPoint ?? 'N/A'}
                        </p>
                    </div>
                    <div className="ml-auto font-medium">
                        <button className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-2 py-1 rounded-md">Reorder</button>
                    </div>
                </div>
             )) : <p className="text-sm text-muted-foreground">All stock levels are healthy.</p>}
           </div>
        </div>
      </div>
      
       <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference No.</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                        {recentActivities.map(activity => {
                            const isSale = 'invoiceDate' in activity;
                            const total = calculateInvoiceTotal(activity.items);
                            return (
                                <tr key={activity.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isSale ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {isSale ? 'Sale' : 'Purchase'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{activity.invoiceNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{isSale ? activity.invoiceDate : activity.purchaseDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default Dashboard;