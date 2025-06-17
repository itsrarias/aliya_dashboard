// SeriesView.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../api/supabase';
import type { SeriesRow } from '../types/series';
import { useSearchParams } from 'react-router-dom';
import '../styles/SeriesView.css';

// formatter for dollar values
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// formatter for generic numbers (commas, up to 2 decimals)
const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function SeriesView() {
  const [data, setData] = useState<SeriesRow[]>([]);
  // ← new: read & write “sheet” from the URL
  const [searchParams, setSearchParams] = useSearchParams();
  const qsSeries  = searchParams.get('sheet') ?? '';
  const stored    = localStorage.getItem('lastSeries') ?? '';
  const initial   = qsSeries || stored;               // ← new
  const [input,    setInput]    = useState(initial);
  const [selected, setSelected] = useState(initial);

  const [showSug, setShowSug] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load all series_data rows once
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

  useEffect(() => {
  if (selected) {
    setSearchParams({ sheet: selected });
    localStorage.setItem('lastSeries', selected);   // ← new
  } else {
    setSearchParams({});
    localStorage.removeItem('lastSeries');          // ← new
  }
}, [selected, setSearchParams]);


  // Unique, trimmed sheet_name list
  const seriesList = useMemo(() => {
    const s = new Set<string>();
    data.forEach(r => {
      if (r.sheet_name) s.add(r.sheet_name.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [data]);

  // Suggestions filtered by substring
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return seriesList.filter(name =>
      name.toLowerCase().includes(q)
    );
  }, [input, seriesList]);

  // Close suggestions on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSug(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Rows for selected series
  const filteredRows = useMemo(() => {
    const sel = selected.trim().toLowerCase();
    if (!sel) return [];
    return data.filter(
      r => r.sheet_name?.trim().toLowerCase() === sel
    );
  }, [data, selected]);

    // Whenever user picks a series, update the URL:
//   useEffect(() => {
//     if (selected) setSearchParams({ sheet: selected });
//     else setSearchParams({});
//   }, [selected, setSearchParams]);

  return (
    <div className="sv-container">
      <h2>Series Detail</h2>

      {/* Autocomplete search */}
      <div ref={wrapperRef} className="sv-search">
        <input
          type="text"
          placeholder="Search series..."
          value={input}
          onChange={e => {
            setInput(e.target.value);
            setShowSug(true);
          }}
          onFocus={() => setShowSug(true)}
        />
        {showSug && suggestions.length > 0 && (
          <ul className="sv-suggestions">
            {suggestions.map(name => (
              <li key={name} onClick={() => {
                setSelected(name);
                setInput(name);
                setShowSug(false);
              }}>
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Display table once selected */}
      {selected && (
        <div className="sv-table-wrap">
          <h3>Showing: {selected.trim()}</h3>
          <table className="sv-table">
            <thead>
              <tr>
                {[
                  'Class','Broker','Investor','Side Letter',
                  'SL Notes','RM','% RM','Solicitor','% Solicitor',
                  'Model','# Shares','% Ownership','PPS','Basis',
                  'Subscription Amount','Spread','% Acq Fee',
                  '$ Acq Fee','% Broker Fee','$ Broker Fee',
                  '% Mgmt Fee','Net For Mgmt Fee','$ Mgmt Fee',
                  '% Reserve Fee','$ Reserve Fee','% SPV Reserve',
                  '$ SPV Reserve','Loan Fee %','Loan Fee $',
                  'Net Subscription'
                ].map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
<tbody>
  {filteredRows.map(r => (
    <tr key={`${r.sheet_name ?? ''}-${r.investor ?? ''}-${r.class ?? ''}`}>
      {/* Class */}
      <td>{r.class ?? ''}</td>

      {/* Broker */}
      <td>{r.broker ?? ''}</td>

      {/* Investor */}
      <td>{r.investor?.trim() ?? ''}</td>

      {/* Side Letter */}
      <td>{r.side_letter ?? ''}</td>

      {/* SL Notes */}
      <td>{r.sl_notes ?? ''}</td>

      {/* RM */}
      <td>{r.rm ?? ''}</td>

      {/* % RM */}
      <td>
        {r.percent_rm != null
          ? `${(r.percent_rm * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* Solicitor */}
      <td>{r.solicitor ?? ''}</td>

      {/* % Solicitor */}
      <td>
        {r.percent_solicitor != null
          ? `${(r.percent_solicitor * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* Model */}
      <td>{r.model ?? ''}</td>

      {/* # Shares */}
      <td>
        {r.num_shares != null
          ? numberFormatter.format(r.num_shares)
          : ''}
      </td>

      {/* % Ownership */}
      <td>
        {r.percent_ownership != null
          ? `${(r.percent_ownership * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* PPS */}
            <td>
        {r.pps != null
          ? currencyFormatter.format(r.pps)
          : ''}
      </td>

      {/* Basis */}
            <td>
        {r.basis
          ? (() => {
              const v = parseFloat(r.basis.trim());
              return !isNaN(v)
                ? currencyFormatter.format(v)
                : r.basis;
            })()
          : ''}
      </td>

      {/* Subscription Amount */}
      <td>
        {r.subscription_amount != null
          ? currencyFormatter.format(r.subscription_amount)
          : ''}
      </td>

      {/* Spread */}
      <td>
        {r.spread != null
          ? currencyFormatter.format(r.spread)
          : ''}
      </td>

      {/* % Acq Fee */}
      <td>
        {r.percent_acq_fee != null
          ? `${(r.percent_acq_fee * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* $ Acq Fee */}
      <td>
        {r.acq_fee != null
          ? currencyFormatter.format(r.acq_fee)
          : ''}
      </td>

      {/* % Broker Fee */}
      <td>
        {r.percent_broker_fee != null
          ? `${(r.percent_broker_fee * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* $ Broker Fee */}
      <td>
        {r.broker_fee != null
          ? currencyFormatter.format(r.broker_fee)
          : ''}
      </td>

      {/* % Mgmt Fee */}
      <td>
        {r.percent_mgmt_fee != null
          ? `${(r.percent_mgmt_fee * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* Net For Mgmt Fee */}
      <td>
        {r.net_for_mgmt_fee != null
          ? currencyFormatter.format(r.net_for_mgmt_fee)
          : ''}
      </td>

      {/* $ Mgmt Fee */}
      <td>
        {r.mgmt_fee != null
          ? currencyFormatter.format(r.mgmt_fee)
          : ''}
      </td>

      {/* % Reserve Fee */}
      <td>
        {r.percent_reserve_fee != null
          ? `${(r.percent_reserve_fee * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* $ Reserve Fee */}
      <td>
        {r.reserve_fee != null
          ? currencyFormatter.format(r.reserve_fee)
          : ''}
      </td>

      {/* % SPV Reserve */}
      <td>
        {r.percent_spv_reserve != null
          ? `${(r.percent_spv_reserve * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* $ SPV Reserve */}
      <td>
        {r.spv_reserve != null
          ? currencyFormatter.format(r.spv_reserve)
          : ''}
      </td>

      {/* Loan Fee % */}
      <td>
        {r.loan_fee_percent != null
          ? `${(r.loan_fee_percent * 100).toFixed(2)}%`
          : ''}
      </td>

      {/* Loan Fee $ */}
      <td>
        {r.loan_fee != null
          ? currencyFormatter.format(r.loan_fee)
          : ''}
      </td>

      {/* Net Subscription */}
      <td>
        {r.net_subscription != null
          ? currencyFormatter.format(r.net_subscription)
          : ''}
      </td>
    </tr>
  ))}
</tbody>

          </table>
        </div>
      )}
    </div>
  );
}

