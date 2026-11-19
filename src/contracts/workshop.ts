export interface ProductionQueueItem {
  orderNumber: string;
  status: string;
  items: { name: string; quantity: number; material?: string; color?: string }[];
}
