export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'number' | 'date' | 'currency' | 'boolean' | 'custom' | 'status';
  format?: (value: any, row?: any) => string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  hidden?: boolean;
  sticky?: boolean;
}

export interface DataTableFilter {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dateRange' | 'select' | 'multiselect';
  options?: { value: any; label: string }[];
  placeholder?: string;
  defaultValue?: any;
}

export interface DataTableAction {
  label: string;
  icon?: string;
  color?: 'primary' | 'accent' | 'warn';
  action: (row: any) => void;
  condition?: (row: any) => boolean;
  tooltip?: string;
}

export interface DataTableConfig {
  columns: DataTableColumn[];
  filters?: DataTableFilter[];
  actions?: DataTableAction[];
  pageSize?: number;
  pageSizeOptions?: number[];
  showSearch?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  showColumnToggle?: boolean;
  enableRealtime?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  expandable?: boolean;
  expandableRowTemplate?: (row: any) => any;
  getExpandedData?: (row: any) => any[];
  groupBy?: string | ((row: any) => string);
}

export interface DataTablePagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
  from?: number;
  to?: number;
}

export interface DataTableSort {
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface DataTableParams extends DataTableSort {
  page?: number;
  per_page?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: any; // For custom filters
}

export interface DataTableResponse<T> {
  data: T[];
  pagination: DataTablePagination;
  meta?: any;
}
