import { useState } from "react";

export interface SeriesRow {
  id: string;
  sheet_name: string;
  table_type: 'tblSeries' | 'tblDetailSeries';
  spv: string;
  fund: string;
  class: string;
  broker: string;
  investor: string;
  side_letter: boolean;
  sl_notes: string | null;
  rm: string;
  percent_rm: number | null;
  solicitor: string;
  percent_solicitor: number | null;
  model: string;
  num_shares: number | null;
  percent_ownership: number | null;
  pps: number | null;
  basis: string;
  subscription_amount: number | null;
  spread: number | null;
  percent_acq_fee: number | null;
  acq_fee: number | null;
  percent_broker_fee: number | null;
  broker_fee: number | null;
  percent_mgmt_fee: number | null;
  net_for_mgmt_fee: number | null;
  mgmt_fee: number | null;
  percent_reserve_fee: number | null;
  reserve_fee: number | null;
  percent_spv_reserve: number | null;
  spv_reserve: number | null;
  loan_fee_percent: number | null;
  loan_fee: number | null;
  net_subscription: number | null;
  inserted_at: string;
}

const [data, setData] = useState<SeriesRow[]>([]);
