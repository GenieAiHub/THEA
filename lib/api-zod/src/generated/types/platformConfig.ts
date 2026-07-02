export interface PlatformConfig {
  id?: string;
  key?: string;
  category?: string;
  label?: string;
  description?: string | null;
  isSecret?: boolean;
  isActive?: boolean;
  hasValue?: boolean;
  value?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
