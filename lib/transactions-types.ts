/**
 * Account resolution and transaction display types.
 * Used for transactions list and dashboard metrics.
 */

export interface AccountDisplay {
  accountId: number | string;
  accountNumber: string;
  clientName: string;
  caption: string;
  platform: string;
}

export interface TransactionDisplay {
  transactionId: number;
  type: string;
  createTime: string;
  status: string;
  creditDetails: {
    amount: number;
    currency: { alphabeticCode: string };
    account: AccountDisplay;
  };
  debitDetails: {
    amount: number;
    account: AccountDisplay;
  };
  /** Original operation_date for metrics (e.g. 1st of month). */
  operationDate: string;
}

export interface AccountMapEntry {
  account_id: number;
  account_number: string;
  client_name: string;
  platform: string;
}
