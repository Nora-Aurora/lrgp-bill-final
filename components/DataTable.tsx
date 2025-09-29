import React, { useState, useMemo } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

// FIX: Export the Column interface to allow for strong typing of column definitions in parent components.
export interface Column<T> {
  header: string;
  accessor: keyof T;
  isSortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  renderActions: (row: T) => React.ReactNode;
  filterConfig?: React.ReactNode;
  searchConfig?: {
    placeholder: string;
    searchKeys: (keyof T)[];
  };
}

export const DataTable = <T extends { id: string }>({
  columns,
  data,
  renderActions,
  filterConfig,
  searchConfig,
}: DataTableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
           return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const stringA = String(aValue).toLowerCase();
        const stringB = String(bValue).toLowerCase();

        if (stringA < stringB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (stringA > stringB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const filteredData = useMemo(() => {
    if (!searchTerm || !searchConfig) return sortedData;
    return sortedData.filter(item =>
      searchConfig.searchKeys.some(key =>
        String(item[key]).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [sortedData, searchTerm, searchConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const requestSort = (key: keyof T) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const SortIndicator = ({ columnKey }: { columnKey: keyof T }) => {
    if (!sortConfig || sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-3 w-3 ml-1" /> : <ArrowDownIcon className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="p-4 flex flex-wrap gap-4 items-center justify-between">
             {filterConfig}
             {searchConfig && (
                <input
                    type="text"
                    placeholder={searchConfig.placeholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2 border rounded w-full md:w-auto bg-background border-input"
                />
            )}
        </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.accessor)}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {col.isSortable ? (
                    <button onClick={() => requestSort(col.accessor)} className="flex items-center">
                      {col.header} <SortIndicator columnKey={col.accessor} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {paginatedData.map(row => (
              <tr key={row.id}>
                {columns.map(col => (
                  <td key={String(col.accessor)} className="px-6 py-4 whitespace-nowrap text-sm">
                    {col.render ? col.render(row) : <span className="text-foreground">{String(row[col.accessor])}</span>}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {renderActions(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 flex items-center justify-between border-t">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="p-2 border rounded bg-background border-input text-sm">
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">
            Previous
          </button>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
