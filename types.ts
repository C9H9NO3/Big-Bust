
export interface ShopifyCsvRow {
  Name: string; // Order Number
  'Shipping Zip': string;
  'Created at': string;
  Id?: string; // Shopify Numeric ID
  [key: string]: string; // Allow other columns
}

export interface TrackingResult {
  orderNumber: string;
  shopifyOrderId?: string; // The numeric ID for API calls
  zip: string;
  orderDate: string;
  trackingNumber: string | null;
  hashId?: string; // The encrypted ID needed to buy the full number
  trackingUrl: string | null;
  expectedDelivery: string | null;
  weight?: string; // API might return this, good to have
  status: 'QUEUED' | 'PROCESSED' | 'SKIPPED' | 'ERROR';
  note?: string; // For warnings like "Delivery too soon"
  is7DaysFuture: boolean;
  processedAt: string;
  debugInfo?: any; // The raw items found from API for debugging
}

export interface QueueItem {
  orderNumber: string;
  trackingUrl: string;
  expectedDelivery: string;
  addedAt: string;
}

export interface PurchasedItem {
  orderNumber: string;
  trackingNumber: string;
  trackingUrl: string;
  expectedDelivery: string | null;
  zip: string;
  purchasedAt: string;
}

export interface FailedItem {
  orderNumber: string;
  reason: string;
  stage: 'PROCESSING' | 'BUYING' | 'FULFILLMENT';
  failedAt: string;
}

export interface ApiResponse {
  data?: {
    data?: Array<{
      status: string;
      expected_delivery: string;
      tracking_number: string;
      weight?: string;
      shipped_date?: string;
      hash_id?: string;
    }>;
  };
  hash_id?: string; // For the buy response logic if needed broadly
}
