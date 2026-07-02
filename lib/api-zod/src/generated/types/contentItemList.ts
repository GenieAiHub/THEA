import type { ContentItem } from './contentItem';
import type { ContentItemListPagination } from './contentItemListPagination';
export interface ContentItemList {
  data?: ContentItem[];
  pagination?: ContentItemListPagination;
}
