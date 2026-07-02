import type { ListAlertsSeverity } from './listAlertsSeverity';
export type ListAlertsParams = {
  status?: string;
  severity?: ListAlertsSeverity;
  limit?: number;
};
