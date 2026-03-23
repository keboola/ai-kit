'use client'

import React, { useState, useMemo } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import type { ListItem } from '@/lib/types'
import { COLORS, formatCurrency, formatPercent, formatNumber } from '@/lib/constants'

interface DataTableProps {
  data: ListItem[]
}

// CUSTOMIZE: Define your table columns based on your data shape
const columns: ColumnDef<ListItem>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => (
      <span className="font-semibold text-black">{info.getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: (info) => (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          backgroundColor: 'rgba(9, 124, 247,0.1)',
          color: COLORS.brandPrimary,
          border: '1px solid rgba(9, 124, 247,0.2)',
        }}
      >
        {info.getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: (info) => (
      <span className="stat-num font-semibold text-black">{formatCurrency(info.getValue<number>())}</span>
    ),
  },
  {
    accessorKey: 'change_pct',
    header: 'Change',
    cell: (info) => {
      const v = info.getValue<number>()
      return (
        <span className="stat-num font-medium" style={{ color: v >= 0 ? COLORS.positive : COLORS.negative }}>
          {v >= 0 ? '+' : ''}{formatPercent(v)}
        </span>
      )
    },
  },
  {
    accessorKey: 'count',
    header: 'Count',
    cell: (info) => (
      <span className="stat-num text-black/70">{formatNumber(info.getValue<number>())}</span>
    ),
  },
]

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span style={{ marginLeft: 4, fontSize: '0.65rem', opacity: dir ? 1 : 0.3 }}>
      {dir === 'asc' ? '\u25B2' : dir === 'desc' ? '\u25BC' : '\u25B4'}
    </span>
  )
}

export default function DataTable({ data }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'value', desc: true },
  ])
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(item => {
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ color: 'rgba(0, 33, 81,0.4)' }}
          >
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Filter by name..."
            aria-label="Filter items"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
            style={{
              width: 260,
              borderColor: search ? '#097cf7' : 'rgba(0, 33, 81,0.2)',
              background: 'white',
              color: '#002151',
              boxShadow: search ? '0 0 0 3px rgba(9, 124, 247,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span style={{ fontSize: '0.72rem', color: 'rgba(0, 33, 81,0.4)', letterSpacing: '0.01em' }}>
            {filtered.length} of {data.length} items
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <SortIcon dir={header.column.getIsSorted()} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-xs" style={{ color: 'rgba(0, 33, 81,0.4)' }}>
                  No items match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
