// src/pages/InvestorView.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../api/supabase';
import type { SeriesRow } from '../types/series';
import { useSearchParams } from 'react-router-dom';
import '../styles/InvestorView.css';

// formatter for dollars
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

export default function InvestorView() {
  const [data, setData] = useState<SeriesRow[]>([]);

  // read & write “investor” from URL + localStorage
  const [searchParams, setSearchParams] = useSearchParams();
  const qsInv   = searchParams.get('investor') ?? '';
  const stored  = localStorage.getItem('lastInvestor') ?? '';
  const initial = qsInv || stored;

  const [input,    setInput]    = useState(initial);
  const [selected, setSelected] = useState(initial);

  const [showSug, setShowSug] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1) load all series rows once
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

  // 2) unique, **trimmed** investor list for suggestions
  const investorList = useMemo(() => {
    const s = new Set<string>();
    data.forEach(r => {
      if (r.investor) {
        s.add(r.investor.trim());
      }
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [data]);

  // 3) filtered suggestions by substring of trimmed names
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return investorList.filter(inv =>
      inv.toLowerCase().includes(q)
    );
  }, [input, investorList]);

  // 4) close suggestions when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSug(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // 5) rows for selected investor (trim + case-insensitive match)
  const filtered = useMemo(() => {
    const sel = selected.trim().toLowerCase();
    if (!sel) return [];
    return data.filter(r =>
      r.investor?.trim().toLowerCase().includes(sel)
    );
  }, [data, selected]);

  // whenever selected changes, sync URL + localStorage
  useEffect(() => {
    if (selected) {
      setSearchParams({ investor: selected });
      localStorage.setItem('lastInvestor', selected);
    } else {
      setSearchParams({});
      localStorage.removeItem('lastInvestor');
    }
  }, [selected, setSearchParams]);

  // if someone navigates back/forward or edits URL manually
  useEffect(() => {
    const inv = searchParams.get('investor') ?? '';
    if (inv && inv !== selected) {
      setSelected(inv);
      setInput(inv);
    }
  }, [searchParams]);

  // 6) aggregate **one row per class** (grouped by r.class)
  const rows = useMemo(() => {
    type Agg = Record<keyof Omit<SeriesRow, 'investor' | 'class' | 'sheet_name' | 'table_type' | 'id'>, number | string>;
    // we only pick the fields we need; numeric fields start at 0
    interface Bucket {
      spv: string;
      fund: string;
      broker: string;
      side_letter: string;
      sl_notes: string;
      rm: string;
      percent_rm: number;
      solicitor: string;
      percent_solicitor: number;
      model: string;
      num_shares: number;
      percent_ownership: number;
      pps: number;
      basis: string;
      subscription_amount: number;
      spread: number;
      percent_acq_fee: number;
      acq_fee: number;
      percent_broker_fee: number;
      broker_fee: number;
      percent_mgmt_fee: number;
      net_for_mgmt_fee: number;
      mgmt_fee: number;
      percent_reserve_fee: number;
      reserve_fee: number;
      percent_spv_reserve: number;
      spv_reserve: number;
      loan_fee_percent: number;
      loan_fee: number;
      net_subscription: number;
    }

    const map: Record<string, Bucket> = {};
    filtered.forEach(r => {
      const cls = r.class;
      if (!cls) return;
      if (!map[cls]) {
        map[cls] = {
          spv: r.spv || '',
          fund: r.fund || '',
          broker: r.broker || '',
          side_letter: r.side_letter || '',
          sl_notes:    r.sl_notes    || '',
          rm:          r.rm          || '',
          percent_rm:        r.percent_rm        || 0,
          solicitor:   r.solicitor   || '',
          percent_solicitor: r.percent_solicitor || 0,
          model:       r.model       || '',
          num_shares:  r.num_shares  || 0,
          percent_ownership: r.percent_ownership || 0,
          pps:         r.pps         || 0,
          basis:       r.basis       || '',
          subscription_amount: 0,
          spread:             0,
          percent_acq_fee:    0,
          acq_fee:            0,
          percent_broker_fee: 0,
          broker_fee:         0,
          percent_mgmt_fee:   0,
          net_for_mgmt_fee:   0,
          mgmt_fee:           0,
          percent_reserve_fee:0,
          reserve_fee:        0,
          percent_spv_reserve:0,
          spv_reserve:        0,
          loan_fee_percent:   0,
          loan_fee:           0,
          net_subscription:   0,
        };
      }
      const agg = map[cls];

      // sum numerics
      agg.subscription_amount  += r.subscription_amount  || 0;
      agg.spread               += r.spread               || 0;
      agg.percent_acq_fee      += r.percent_acq_fee      || 0;
      agg.acq_fee              += r.acq_fee              || 0;
      agg.percent_broker_fee   += r.percent_broker_fee   || 0;
      agg.broker_fee           += r.broker_fee           || 0;
      agg.percent_mgmt_fee     += r.percent_mgmt_fee     || 0;
      agg.net_for_mgmt_fee     += r.net_for_mgmt_fee     || 0;
      agg.mgmt_fee             += r.mgmt_fee             || 0;
      agg.percent_reserve_fee  += r.percent_reserve_fee  || 0;
      agg.reserve_fee          += r.reserve_fee          || 0;
      agg.percent_spv_reserve  += r.percent_spv_reserve  || 0;
      agg.spv_reserve          += r.spv_reserve          || 0;
      agg.loan_fee_percent     += r.loan_fee_percent     || 0;
      agg.loan_fee             += r.loan_fee             || 0;
      agg.net_subscription     += r.net_subscription     || 0;
    });

    // produce one row per class, averaging any % fields
    return Object.entries(map).map(([cls, v]) => ({
      class: cls.trim(),
      spv: v.spv,
      fund: v.fund,
      broker: v.broker,
      side_letter: v.side_letter,
      sl_notes: v.sl_notes,
      rm: v.rm,
      percent_rm: v.percent_rm / filtered.length,
      solicitor: v.solicitor,
      percent_solicitor: v.percent_solicitor / filtered.length,
      model: v.model,
      num_shares: v.num_shares,
      percent_ownership: v.percent_ownership,
      pps: v.pps,
      basis: v.basis,
      subscription_amount: v.subscription_amount,
      spread: v.spread,
      percent_acq_fee: v.percent_acq_fee / filtered.length,
      acq_fee: v.acq_fee,
      percent_broker_fee: v.percent_broker_fee / filtered.length,
      broker_fee: v.broker_fee,
      percent_mgmt_fee: v.percent_mgmt_fee / filtered.length,
      net_for_mgmt_fee: v.net_for_mgmt_fee,
      mgmt_fee: v.mgmt_fee,
      percent_reserve_fee: v.percent_reserve_fee / filtered.length,
      reserve_fee: v.reserve_fee,
      percent_spv_reserve: v.percent_spv_reserve / filtered.length,
      spv_reserve: v.spv_reserve,
      loan_fee_percent: v.loan_fee_percent / filtered.length,
      loan_fee: v.loan_fee,
      net_subscription: v.net_subscription,
    }));
  }, [filtered]);

  return (
    <div className="iv-container">
      <h2>Investor Detail</h2>
      
      {/* Search box */}
      <div ref={wrapperRef} className="iv-search">
        <input
          type="text"
          placeholder="Search investor..."
          value={input}
          onChange={e => { setInput(e.target.value); setShowSug(true); }}
          onFocus={() => setShowSug(true)}
        />
        {showSug && suggestions.length > 0 && (
          <ul className="iv-suggestions">
            {suggestions.map(inv => (
              <li key={inv} onClick={() => {
                setSelected(inv);     // trimmed inv
                setInput(inv);
                setShowSug(false);
              }}>
                {inv}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Results */}
      {selected && (
        <div className="iv-table-wrap">
          <h3>Showing: {selected.trim()}</h3>
          <table className="iv-table">
            <thead>
              <tr>
                {[
                  'SPV','Fund','Class','Broker','Investor','Side Letter','SL Notes','RM','% RM',
                  'Solicitor','% Solicitor','Model','# Shares','% Ownership','PPS','Basis',
                  'Subscription Amount','Spread','% Acq Fee','$ Acq Fee','% Broker Fee',
                  '$ Broker Fee','% Mgmt Fee','Net For Mgmt Fee','$ Mgmt Fee',
                  '% Reserve Fee','$ Reserve Fee','% SPV Reserve','$ SPV Reserve',
                  'Loan Fee %','Loan Fee $','Net Subscription'
                ].map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${selected}-${r.class}`}>
                  <td>{r.spv}</td>
                  <td>{r.fund}</td>
                  <td>{r.class}</td>
                  <td>{r.broker}</td>
                  <td>{selected.trim()}</td>
                  <td>{r.side_letter}</td>
                  <td>{r.sl_notes}</td>
                  <td>{r.rm}</td>
                  <td>{(r.percent_rm * 100).toFixed(2)}%</td>
                  <td>{r.solicitor}</td>
                  <td>{(r.percent_solicitor * 100).toFixed(2)}%</td>
                  <td>{r.model}</td>
                  <td>{r.num_shares}</td>
                  <td>{(r.percent_ownership * 100).toFixed(2)}%</td>
                  <td>{r.pps}</td>
                  <td>{r.basis}</td>
                  <td>{currencyFormatter.format(r.subscription_amount)}</td>
                  <td>{currencyFormatter.format(r.spread)}</td>
                  <td>{(r.percent_acq_fee * 100).toFixed(2)}%</td>
                  <td>{currencyFormatter.format(r.acq_fee)}</td>
                  <td>{(r.percent_broker_fee * 100).toFixed(2)}%</td>
                  <td>{currencyFormatter.format(r.broker_fee)}</td>
                  <td>{(r.percent_mgmt_fee * 100).toFixed(2)}%</td>
                  <td>{currencyFormatter.format(r.net_for_mgmt_fee)}</td>
                  <td>{currencyFormatter.format(r.mgmt_fee)}</td>
                  <td>{(r.percent_reserve_fee * 100).toFixed(2)}%</td>
                  <td>{currencyFormatter.format(r.reserve_fee)}</td>
                  <td>{(r.percent_spv_reserve * 100).toFixed(2)}%</td>
                  <td>{currencyFormatter.format(r.spv_reserve)}</td>
                  <td>{(r.loan_fee_percent * 100).toFixed(2)}%</td>
                  <td>{currencyFormatter.format(r.loan_fee)}</td>
                  <td>{currencyFormatter.format(r.net_subscription)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
