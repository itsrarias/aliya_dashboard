import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../api/supabase';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import styles from '../styles/dashboard.module.css';
import type { SeriesRow } from '../types/series';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28EFF'];

export default function MainDashboard() {
  const [data, setData] = useState<SeriesRow[]>([]);
  const [filters, setFilters] = useState({
    timePeriod: 'all',
    fund: '',
    spv: '',
    class: '',
    investor: '',
    rm: '',
    solicitor: '',
  });

  // Fetch data with filters
  useEffect(() => {
    async function fetchData() {
      let query = supabase.from('series_data').select('*');
      if (filters.fund) query = query.eq('fund', filters.fund);
      if (filters.spv) query = query.eq('spv', filters.spv);
      if (filters.class) query = query.eq('class', filters.class);
      if (filters.investor)
        query = query.ilike('investor', `%${filters.investor}%`);
      if (filters.rm) query = query.eq('rm', filters.rm);
      if (filters.solicitor) query = query.eq('solicitor', filters.solicitor);
      if (filters.timePeriod !== 'all') {
        const date = new Date();
        if (filters.timePeriod === 'lastMonth')
          date.setMonth(date.getMonth() - 1);
        if (filters.timePeriod === 'lastYear')
          date.setFullYear(date.getFullYear() - 1);
        query = query.gte('inserted_at', date.toISOString());
      }
      const { data: rows, error } = await query;
      if (error) console.error(error);
      else setData(rows);
    }
    fetchData();
  }, [filters]);

  // --- Capital Summary ---
  const totalCapitalRaised = useMemo(
    () => data.reduce((sum, r) => sum + (r.subscription_amount || 0), 0),
    [data]
  );
const fundsData = useMemo(() => {
  const totals = data.reduce<Record<string, number>>((acc, r) => {
    acc[r.fund] = (acc[r.fund] || 0) + (r.subscription_amount || 0);
    return acc;
  }, {});

  return Object.entries(totals).map(([name, value]) => ({ name, value }));
}, [data]);

const top5Series = useMemo(() => {
  const spvTotals = data.reduce<Record<string, number>>((acc, r) => {
    acc[r.spv] = (acc[r.spv] || 0) + (r.subscription_amount || 0);
    return acc;
  }, {});

  return Object.entries(spvTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));
}, [data]);

const tableTypeData = useMemo(() => {
  const typeTotals = data.reduce<Record<string, number>>((acc, r) => {
    acc[r.table_type] = (acc[r.table_type] || 0) + (r.subscription_amount || 0);
    return acc;
  }, {});

  return Object.entries(typeTotals).map(([name, value]) => ({ name, value }));
}, [data]);


  // --- Investor Table ---
  const columns = useMemo<ColumnDef<SeriesRow>[]>(
    () => [
      { header: 'Investor', accessorKey: 'investor' },
      { header: 'Subscription Amount', accessorKey: 'subscription_amount' },
      { header: '% Ownership', accessorKey: 'percent_ownership' },
      {
        header: 'Side Letter',
        id: 'side_letter',
        accessorFn: (row: SeriesRow) => (row.side_letter ? 'Yes' : 'No'),
      },
    ],
    []
  );
  const table = useReactTable<SeriesRow>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // --- Fees Overview ---
  const totalMgmtFees = useMemo(
    () => data.reduce((sum, r) => sum + (r.mgmt_fee || 0), 0),
    [data]
  );
  const totalBrokerFees = useMemo(
    () => data.reduce((sum, r) => sum + (r.broker_fee || 0), 0),
    [data]
  );
  const avgAcqFee = useMemo(
    () => (data.length ? data.reduce((sum, r) => sum + (r.acq_fee || 0), 0) / data.length : 0),
    [data]
  );
  const loanFeeRevenue = useMemo(
    () => data.reduce((sum, r) => sum + (r.loan_fee || 0), 0),
    [data]
  );

  // --- Share & Ownership Metrics ---
  const totalShares = useMemo(
    () => data.reduce((sum, r) => sum + (r.num_shares || 0), 0),
    [data]
  );
  const avgPPS = useMemo(
    () => (data.length ? data.reduce((sum, r) => sum + (r.pps || 0), 0) / data.length : 0),
    [data]
  );
  const avgOwnership = useMemo(
    () => (data.length ? data.reduce((sum, r) => sum + (r.percent_ownership || 0), 0) / data.length : 0),
    [data]
  );

// --- Red Flags ---
const redFlags = useMemo(() => {
  const negativeSpreads = data.filter(r => (r.spread ?? 0) < 0);
  const highReserves = data.filter(r => (r.percent_spv_reserve ?? 0) > 20);
  const missingFields = data.filter(
    r => r.percent_ownership == null || r.acq_fee == null
  );

  const amounts = data.map(r => r.subscription_amount ?? 0);
  const mean = amounts.reduce((a, b) => a + b, 0) / (amounts.length || 1);
  const std = Math.sqrt(
    amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (amounts.length || 1)
  );
  const outliers = data.filter(
    r => Math.abs((r.subscription_amount ?? 0) - mean) > 2 * std
  );

  return { negativeSpreads, highReserves, missingFields, outliers };
}, [data]);


// --- Team Contributions ---
const topRMs = useMemo(() => {
  const byRm = data.reduce<Record<string, number>>((acc, r) => {
    // coalesce null subscription_amount to 0
    acc[r.rm] = (acc[r.rm] || 0) + (r.subscription_amount ?? 0);
    return acc;
  }, {});

  return Object.entries(byRm)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));
}, [data]);

const rmVsSolicitor = useMemo(() => {
  const rmTotal = topRMs.reduce((sum, r) => sum + r.value, 0);
  const solTotal =
    data.reduce((sum, r) => sum + (r.subscription_amount ?? 0), 0) - rmTotal;
  return [
    { name: 'RM', value: rmTotal },
    { name: 'Solicitor', value: solTotal },
  ];
}, [data, topRMs]);

  return (
    <div className={styles.dashboard}>
      {/* Filters */}
      <div className={styles.filters}>
        <select
          value={filters.timePeriod}
          onChange={e => setFilters({ ...filters, timePeriod: e.target.value })}
          className={styles.select}
        >
          <option value="all">All Time</option>
          <option value="lastMonth">Last Month</option>
          <option value="lastYear">Last Year</option>
        </select>
        <input
          type="text"
          placeholder="Fund"
          value={filters.fund}
          onChange={e => setFilters({ ...filters, fund: e.target.value })}
          className={styles.input}
        />
        <input
          type="text"
          placeholder="SPV"
          value={filters.spv}
          onChange={e => setFilters({ ...filters, spv: e.target.value })}
          className={styles.input}
        />
        {/* add other filter inputs similarly */}
      </div>

      {/* Capital Summary */}
      <section className={styles.section}>
        <h2 className={styles.heading}>Capital Summary</h2>
        <div className={styles.kpiBox}>
          <span>Total Raised</span>
          <strong>${totalCapitalRaised.toLocaleString()}</strong>
        </div>
        <div className={styles.chartsRow}>
          <BarChart width={300} height={200} data={fundsData}>
            <Bar dataKey="value" fill={COLORS[0]} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
          </BarChart>
          <BarChart width={300} height={200} data={top5Series}>
            <Bar dataKey="value" fill={COLORS[1]} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
          </BarChart>
          <PieChart width={300} height={200}>
            <Pie data={tableTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {tableTypeData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </div>
      </section>

      {/* Investor Breakdown */}
      <section className={styles.section}>
        <h2 className={styles.heading}>Investor Breakdown</h2>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className={styles.th}
              >
                {!header.isPlaceholder &&
                  flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                {/* sort icon */}
                {(() => {
                  const sort = header.column.getIsSorted();
                  if (sort === 'asc') return ' 🔼';
                  if (sort === 'desc') return ' 🔽';
                  return '';
                })()}
      </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={styles.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Fees Overview */}
      <section className={styles.section}>
        <h2 className={styles.heading}>Fees Overview</h2>
        <div className={styles.grid4}>
          <div className={styles.kpiBox}>
            <span>Total Mgmt Fees</span>
            <strong>${totalMgmtFees.toLocaleString()}</strong>
          </div>
          <div className={styles.kpiBox}>
            <span>Total Broker Fees</span>
            <strong>${totalBrokerFees.toLocaleString()}</strong>
          </div>
          <div className={styles.kpiBox}>
            <span>Avg Acquisition Fee</span>
            <strong>${avgAcqFee.toFixed(2)}</strong>
          </div>
          <div className={styles.kpiBox}>
            <span>Loan Fee Revenue</span>
            <strong>${loanFeeRevenue.toLocaleString()}</strong>
          </div>
        </div>
      </section>

      {/* Share & Ownership Metrics */}
      <section className={styles.section}>
        <h2 className={styles.heading}>Share & Ownership Metrics</h2>
        <div className={styles.grid3}>
          <div className={styles.kpiBox}>
            <span>Total Shares Issued</span>
            <strong>{totalShares.toLocaleString()}</strong>
          </div>
          <div className={styles.kpiBox}>
            <span>Avg Price per Share</span>
            <strong>${avgPPS.toFixed(2)}</strong>
          </div>
          <div className={styles.kpiBox}>
            <span>Avg Ownership %</span>
            <strong>{(avgOwnership * 100).toFixed(2)}%</strong>
          </div>
        </div>
      </section>

      {/* Red Flags */}
      <section className={styles.section}>
        <h2 className={styles.heading}>Red Flags</h2>
        <ul className={styles.redFlagsList}>
          <li>⚠️ Negative Spreads: {redFlags.negativeSpreads.length}</li>
          <li>⚠️ High Reserves (&gt;20%): {redFlags.highReserves.length}</li>
          <li>⚠️ Missing Fields: {redFlags.missingFields.length}</li>
          <li>⚠️ Subscription Outliers: {redFlags.outliers.length}</li>
        </ul>
      </section>

      {/* Team Contributions */}
      <section className={styles.section}>
        <h2 className={styles.heading}>Team Contributions</h2>
        <div className={styles.chartsRow}>
          <div>
            <h3>Top RMs</h3>
            <BarChart width={300} height={200} data={topRMs}>
              <Bar dataKey="value" fill={COLORS[2]} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
            </BarChart>
          </div>
          <div>
            <h3>RM vs Solicitor</h3>
            <PieChart width={300} height={200}>
              <Pie
                data={rmVsSolicitor}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {rmVsSolicitor.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </div>
        </div>
      </section>
    </div>
  );
}
