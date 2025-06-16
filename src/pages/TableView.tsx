import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../api/supabase';
import type { SeriesRow } from '../types/series';
import '../styles/TableView.css';

// formatter for all dollar‐values
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Aliya name variants
const ALIYA_NAMES = [
  'aliya',
  'aliya capital partners',
  'aliya capital partners llc',
];

type Row = {
  series: string;
  spv: string;
  net: number;
  gross: number;
  diff: number;
  shortfall: number | null;
  aliya: number;
  mgmtFee: number;
  feesWired: number | null;
  diff2: number | null;
  reserve: number;
  notes: string;
};

export default function TableView() {
  const [data, setData] = useState<SeriesRow[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Row; direction: 'asc' | 'desc' }>({
    key: 'series',
    direction: 'asc',
  });

  useEffect(() => {
    supabase
      .from('series_data')
      .select('*')
      .eq('table_type', 'tblSeries')
      .then(({ data: rows, error }) => {
        if (error) console.error(error);
        else setData(rows as SeriesRow[]);
      });
  }, []);

  // 1) build the raw rows
  const rows = useMemo<Row[]>(() => {
    type Agg = { spv: string; net: number; gross: number; mgmtFee: number; reserveFee: number; aliya: number };
    const map: Record<string, Agg> = {};

    data.forEach(r => {
      const series = r.sheet_name;
      if (!series) return;

      if (!map[series]) {
        map[series] = {
          spv: r.spv,
          net: 0,
          gross: 0,
          mgmtFee: 0,
          reserveFee: 0,
          aliya: 0,
        };
      }
      const agg = map[series];
      agg.net        += r.net_subscription    || 0;
      agg.gross      += r.subscription_amount || 0;
      agg.mgmtFee    += r.mgmt_fee            || 0;
      agg.reserveFee += r.reserve_fee         || 0;

      // sum any Aliya variant
      const inv = (r.investor || '').toLowerCase().trim();
      if (ALIYA_NAMES.includes(inv)) {
        agg.aliya += r.subscription_amount || 0;
      }
    });

    return Object.entries(map).map(([series, v]) => ({
      series,
      spv:        v.spv,
      net:        v.net,
      gross:      v.gross,
      diff:       v.gross - v.net,
      shortfall:  null,
      aliya:      v.aliya,
      mgmtFee:    v.mgmtFee,
      feesWired:  null,
      diff2:      null,
      reserve:    v.reserveFee,
      notes:      '',
    }));
  }, [data]);

  // 2) sort whenever rows or config changes
  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const { key, direction } = sortConfig;
      const aVal = a[key], bVal = b[key];
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortConfig]);

  // 3) handle header clicks
  function handleSort(key: keyof Row) {
    setSortConfig(curr => ({
      key,
      direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  // renders ▲ or ▼
  const arrow = (key: keyof Row) =>
    sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="tv-container">
      <h2>Portfolio Overview</h2>
      <table className="tv-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('series')}>Series/Class{arrow('series')}</th>
            <th onClick={() => handleSort('spv')}>Direct/SPV Name{arrow('spv')}</th>
            <th onClick={() => handleSort('net')}>Invested Amount{arrow('net')}</th>
            <th onClick={() => handleSort('gross')}>Amount Raised{arrow('gross')}</th>
            <th onClick={() => handleSort('diff')}>Difference{arrow('diff')}</th>
            <th>Shortfall</th>
            <th onClick={() => handleSort('aliya')}>Aliya Invested{arrow('aliya')}</th>
            <th onClick={() => handleSort('mgmtFee')}>Mgmt Fees{arrow('mgmtFee')}</th>
            <th>Fees Wired</th>
            <th>Difference</th>
            <th onClick={() => handleSort('reserve')}>Reserve Raised{arrow('reserve')}</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(row => (
            <tr key={row.series}>
              <td>{row.series}</td>
              <td>{row.spv}</td>
              <td>{currencyFormatter.format(row.net)}</td>
              <td>{currencyFormatter.format(row.gross)}</td>
              <td>{currencyFormatter.format(row.diff)}</td>
              <td>{row.shortfall != null ? currencyFormatter.format(row.shortfall) : ''}</td>
              <td>{row.aliya > 0 ? currencyFormatter.format(row.aliya) : ''}</td>
              <td>{currencyFormatter.format(row.mgmtFee)}</td>
              <td>{row.feesWired != null ? currencyFormatter.format(row.feesWired) : ''}</td>
              <td>{row.diff2 != null ? currencyFormatter.format(row.diff2) : ''}</td>
              <td>{currencyFormatter.format(row.reserve)}</td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
