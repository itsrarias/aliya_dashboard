// src/pages/AliyaGPT.tsx
import React, { useState } from 'react';
import { supabase } from '../api/supabase';
import OpenAI from 'openai';                // ← new import
import '../styles/AliyaGPT.css';          
import { FiPlus, FiTool, FiMic, FiArrowUp } from 'react-icons/fi'

// instantiate the v5 client (warning: this exposes your key in-browser)
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// helper – format any number with ≤ 2 decimals
const numFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function AliyaGPT() {
    //console.log('[📣 AliyaGPT component loaded]');
  const [query, setQuery] = useState('');
  const [table, setTable] = useState<{ cols: string[]; rows: any[][] } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  async function handleSubmit(e: React.FormEvent) {
     //console.log('[🚀 handleSubmit fired]');
    e.preventDefault();
    if (!query.trim()) return;

    setThinking(true);
    setError('');
    setTable(null);

    try {
      // 1) Ask GPT to produce SQL
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  temperature: 0,
  messages: [
    {
      role: 'system',
            content: 
`You are an SQL generator for a Postgres table “series_data”.
Return **exactly one** SQL SELECT (no backticks or commentary).

— When the user’s question asks to *filter* rows (e.g. “Which investors have side letters?”), you **must** select ALL these columns **in this order**:

- spv  
- fund  
- class  
- broker  
- investor  
- side_letter  
- sl_notes  
- rm  
- percent_rm  
- solicitor  
- percent_solicitor  
- model  
- num_shares  
- percent_ownership  
- pps  
- basis  
- subscription_amount  
- spread  
- percent_acq_fee  
- acq_fee  
- percent_broker_fee  
- broker_fee  
- percent_mgmt_fee  
- net_for_mgmt_fee  
- mgmt_fee  
- percent_reserve_fee  
- reserve_fee  
- percent_spv_reserve  
- spv_reserve  
- loan_fee_percent  
- loan_fee  
- net_subscription  

For example:

SELECT spv, fund, class, broker, investor, side_letter, sl_notes, rm, percent_rm,
       solicitor, percent_solicitor, model, num_shares, percent_ownership, pps, basis,
       subscription_amount, spread, percent_acq_fee, acq_fee,
       percent_broker_fee, broker_fee, percent_mgmt_fee, net_for_mgmt_fee, mgmt_fee,
       percent_reserve_fee, reserve_fee, percent_spv_reserve, spv_reserve,
       loan_fee_percent, loan_fee, net_subscription
  FROM series_data
 WHERE side_letter IS NOT NULL;

— **Always** return a single SELECT that includes the **full detail column list above**
  and any needed WHERE filters.  
  • Do **not** use GROUP BY, COUNT, SUM, or other aggregate functions.  
  • The client code will calculate totals or counts.


Table schema (for reference):
sheet_name, table_type, spv, fund, class, broker, investor, side_letter,
sl_notes, rm, percent_rm, solicitor, percent_solicitor, model, num_shares,
percent_ownership, pps, basis, subscription_amount, spread, percent_acq_fee,
acq_fee, percent_broker_fee, broker_fee, percent_mgmt_fee, net_for_mgmt_fee,
mgmt_fee, percent_reserve_fee, reserve_fee, percent_spv_reserve, spv_reserve,
loan_fee_percent, loan_fee, net_subscription, inserted_at
`.trim(),
    },
    { role: 'user', content: query.trim() },
  ],
});
        console.log('[🧪 GPT Completion SQL:]', completion);

      const sql = completion.choices?.[0]?.message?.content?.trim() ?? '';
      console.log('[🔍 GPT SQL]', sql);

      if (!sql.toLowerCase().startsWith('select')) {
        throw new Error('Model did not return a SELECT.');
      }

      // 2) Execute the SQL via our run_sql RPC
        // just after you obtain sql
        let cleanSql = sql.replace(/;\s*$/, '');   // ← removes one trailing ";"
        if (!cleanSql.toLowerCase().startsWith('select')) {
        throw new Error('Model did not return a SELECT.');
        }

        // 2) Execute the SQL
        const { data: rows, error: rpcError } =
        await supabase.rpc('run_sql', { q: cleanSql });

      if (rpcError) throw rpcError;

      if (!rows || rows.length === 0) {
        setError('No rows returned.');
        setThinking(false);
        return;
      }

      // 3) Ask GPT for a 2-3 sentence plain-English summary of the result
        try {
        const summaryCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',                  // use the same model (or gpt-4o-mini to save tokens)
            temperature: 0,
            messages: [
            {
                role: 'system',
                content: `
        You are a financial data analyst.
        Write **2-3 sentences** in plain English that summarise the result
        of the SQL query below.  Mention counts, totals, classes or investors
        only if they’re obvious from the rows provided.
        Do not wrap the answer in code fences or JSON.
            `.trim(),
            },
            { role: 'assistant', content: `User question: ${query}` },
            {
                role: 'assistant',
                // the first 100 rows are usually enough context and keep the prompt small
                content: `Result rows (JSON): ${JSON.stringify(rows.slice(0, 100))}`,
            },
            ],
        });
        console.log('[🧪 GPT Completion Summary:]', summaryCompletion);


        setSummary(summaryCompletion.choices[0]?.message?.content?.trim() ?? '');
        console.log('[📝 GPT Summary]', summaryCompletion.choices[0]?.message?.content?.trim());

        } catch (err) {
        console.error('Summary error:', err);
        setSummary('');          // fail silently – table still shows
        }

      const cols = Object.keys(rows[0]);
      setTable({
        cols,
        rows: rows.map((r: any) => cols.map(c => r[c])),
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error');
    } finally {
      setThinking(false);
    }
  }

    // 1) Define the full detail‐column order & display names:
  const allCols = [
    'spv','fund','class','broker','investor','side_letter','sl_notes','rm',
    'percent_rm','solicitor','percent_solicitor','model','num_shares','percent_ownership',
    'pps','basis','subscription_amount','spread','percent_acq_fee','acq_fee',
    'percent_broker_fee','broker_fee','percent_mgmt_fee','net_for_mgmt_fee','mgmt_fee',
    'percent_reserve_fee','reserve_fee','percent_spv_reserve','spv_reserve',
    'loan_fee_percent','loan_fee','net_subscription'
  ] as const;

  const displayNames: Record<typeof allCols[number], string> = {
    spv:            'SPV',
    fund:           'Fund',
    class:          'Class',
    broker:         'Broker',
    investor:       'Investor',
    side_letter:    'Side Letter',
    sl_notes:       'SL Notes',
    rm:             'RM',
    percent_rm:     '% RM',
    solicitor:      'Solicitor',
    percent_solicitor: '% Solicitor',
    model:          'Model',
    num_shares:     '# Shares',
    percent_ownership: '% Ownership',
    pps:            'PPS',
    basis:          'Basis',
    subscription_amount: 'Subscription Amount',
    spread:         'Spread',
    percent_acq_fee: '% Acq Fee',
    acq_fee:        '$ Acq Fee',
    percent_broker_fee: '% Broker Fee',
    broker_fee:     '$ Broker Fee',
    percent_mgmt_fee: '% Mgmt Fee',
    net_for_mgmt_fee:'Net For Mgmt Fee',
    mgmt_fee:       '$ Mgmt Fee',
    percent_reserve_fee: '% Reserve Fee',
    reserve_fee:    '$ Reserve Fee',
    percent_spv_reserve: '% SPV Reserve',
    spv_reserve:    '$ SPV Reserve',
    loan_fee_percent: 'Loan Fee %',
    loan_fee:       'Loan Fee $',
    net_subscription:'Net Subscription'
  };

  // 2) Which of those columns came back? in the right order:
  const displayCols = table
    ? allCols.filter(col => table.cols.includes(col))
    : [];

    // formatter for dollars
    const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    });

  return (
    <div className="tv-container">
      <h2>AliyaGPT</h2>

   <form onSubmit={handleSubmit} className="tv-search-bar">

      {/* the actual input */}
      <input
        className="tv-search-input"
        placeholder="Ask anything about our Aliya Master—e.g. investors with side letters."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {/* send arrow */}
      <button
        type="submit"
        disabled={thinking}
        className="tv-icon tv-send"
      >
        <FiArrowUp />
      </button>
    </form>


      {error && <p style={{ color: 'red' }}>{error}</p>}
{summary && (
  <div className="tv-summary">
    <div className="qTakeaway">Quick Takeaway:</div>
    <div className="takeawayContent">{summary}</div>
  </div>
)}


      {table && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tv-table">
            <thead>
              <tr>
                {displayCols.map(c => (
                  <th key={c}>{displayNames[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((rowArr, i) => (
                <tr key={i}>
                  {displayCols.map(c => {
                    const idx = table.cols.indexOf(c);
                    const cell = rowArr[idx];
                    // format percentages
                    if (c.startsWith('percent_')) {
                      const pct = Number(cell) * 100;
                      return <td key={c}>{isNaN(pct) ? '' : pct.toFixed(2) + '%'}</td>;
                    }
                    // format currency fields
                    if ([
                      'pps','basis','subscription_amount','spread','acq_fee',
                      'broker_fee','net_for_mgmt_fee','mgmt_fee',
                      'reserve_fee','spv_reserve','loan_fee','net_subscription'
                    ].includes(c)) {
                      return <td key={c}>
                        {cell != null ? currencyFormatter.format(cell) : ''}
                      </td>;
                    }
                    // format plain numbers (# Shares)
                    if (typeof cell === 'number') {
                      return <td key={c}>{numFmt.format(cell)}</td>;
                    }
                    // fallback: text or null
                    return <td key={c}>{cell ?? ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}