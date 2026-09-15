import React from 'react';
import { Link } from 'react-router-dom';

/**
 * The three "Recent ..." tables share one shell. `columns` describe the header
 * and how to render each cell; `empty` is shown when the collection genuinely
 * has nothing in it, which is the honest state for several of these today.
 */
export default function RecentTable({ title, viewAllTo, columns, rows, loading = false, empty, onRowClick }) {
    return (
        <div className="flex flex-col overflow-hidden border rounded-xl bg-surface border-line lift">
            <div className="flex items-center justify-between px-3 py-3">
                <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
                {viewAllTo && (
                    <Link to={viewAllTo} className="text-[12px] font-medium text-link hover:underline">View All</Link>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                    <thead>
                        <tr className="border-y border-line bg-raised">
                            {columns.map((c) => (
                                <th
                                    key={c.key}
                                    className={`px-3 py-2 font-medium text-left text-fg-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}
                                >
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}><td colSpan={columns.length} className="px-3 py-2.5"><div className="h-4 skeleton" /></td></tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-3 py-10 text-center">
                                    <p className="text-[13px] text-fg-3">{empty}</p>
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, i) => (
                                <tr
                                    key={row.id ?? i}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={`border-b border-line/50 last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-raised transition-colors' : ''}`}
                                >
                                    {columns.map((c) => (
                                        <td
                                            key={c.key}
                                            className={`px-3 py-2.5 text-fg-2 ${c.align === 'right' ? 'text-right' : ''} ${c.nowrap ? 'whitespace-nowrap' : ''}`}
                                        >
                                            {c.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
