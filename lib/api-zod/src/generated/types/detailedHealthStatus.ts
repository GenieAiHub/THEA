import type { DetailedHealthStatusServices } from './detailedHealthStatusServices';
import type { DetailedHealthStatusStatus } from './detailedHealthStatusStatus';
export interface DetailedHealthStatus {
  status: DetailedHealthStatusStatus;
  services: DetailedHealthStatusServices;
  version?: string;
  timestamp: Date;
}
