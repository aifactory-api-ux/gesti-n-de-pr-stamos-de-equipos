import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ColumnDefinition<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  width?: string;
}

export interface TableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay registros disponibles',
  keyExtractor,
  className = '',
}: TableProps<T>): React.ReactElement {
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F4F7FB] border-b border-[#E2E8F0]">
              {columns.map((col, index) => (
                <th
                  key={index}
                  scope="col"
                  style={{ width: col.width }}
                  className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#58708F] select-none"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-[#58708F]"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2
                      className="w-6 h-6 animate-spin text-[#0B2F6B]"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">Cargando registros...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-sm text-[#58708F]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const rowKey = keyExtractor(row);
                return (
                  <tr
                    key={rowKey}
                    className="transition-colors hover:bg-[#F8FAFC] focus-within:bg-[#F8FAFC]"
                  >
                    {columns.map((col, colIndex) => {
                      let cellContent: React.ReactNode = null;
                      if (col.cell) {
                        cellContent = col.cell(row);
                      } else if (col.accessorKey) {
                        const val = row[col.accessorKey];
                        cellContent = val != null ? String(val) : '-';
                      }

                      return (
                        <td
                          key={colIndex}
                          style={{ width: col.width }}
                          className="px-6 py-4 text-sm text-[#102A56] whitespace-nowrap"
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
