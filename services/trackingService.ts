
import { API_URL } from '../constants';
import { ApiResponse, ShopifyCsvRow, TrackingResult } from '../types';

const BUY_API_URL = "https://api.gettnship.com/v2/tracking/buy";

// Helper to construct proxy URL dynamically based on whether a key is present
const buildProxyUrl = (targetUrl: string, corsKey?: string) => {
    if (corsKey && corsKey.trim().length > 0) {
        // Paid CORS Proxy format: ?key=KEY&url=URL
        return `https://corsproxy.io/?key=${corsKey}&url=${encodeURIComponent(targetUrl)}`;
    }
    // Free CORS Proxy format: ?URL (or ?url=URL depending on implementation, standard is direct append for corsproxy.io usually, but ?url= is safer)
    return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
};

export const getTrackingForOrder = async (
  row: ShopifyCsvRow,
  limit: number = 3000,
  apiKey: string,
  daysForQueue: number,
  daysForWarning: number,
  corsKey?: string
): Promise<TrackingResult> => {
  const orderNum = row['Name'];
  const shopifyOrderId = row['Id']; // Capture the numeric ID
  const rawZip = row['Shipping Zip'];
  const cleanZip = rawZip ? rawZip.replace(/'/g, "").trim() : "";
  const createdAtRaw = row['Created at']; // e.g., "2025-11-24 22:55:16 -0600"
  
  const processedAt = new Date().toISOString();

  // Basic validation
  if (!cleanZip) {
    return {
      orderNumber: orderNum,
      shopifyOrderId,
      zip: "N/A",
      orderDate: "N/A",
      trackingNumber: null,
      trackingUrl: null,
      expectedDelivery: null,
      status: 'SKIPPED',
      note: 'Missing Zip Code',
      is7DaysFuture: false,
      processedAt
    };
  }

  // Parse dates
  const orderDateStr = createdAtRaw.substring(0, 10); // "2025-11-24"
  const orderDate = new Date(orderDateStr);
  
  // Calculate start date (Order Date - 5 Days) to catch labels created early or timezone diffs
  const startDate = new Date(orderDate);
  startDate.setDate(startDate.getDate() - 5);
  const startDateStr = startDate.toISOString().substring(0, 10);

  // Calculate end date for API search (Order + 35 days)
  const endDate = new Date(orderDate);
  endDate.setDate(endDate.getDate() + 35);
  const endDateStr = endDate.toISOString().substring(0, 10);

  // Determine Zips to search (handle "12345-6789" by splitting and searching both)
  const zipsToSearch = cleanZip.includes('-') 
    ? cleanZip.split('-').map(z => z.trim()).filter(z => z.length > 0)
    : [cleanZip];

  const allRawItems: any[] = [];
  const debugPayloads: any[] = [];
  const errors: string[] = [];

  try {
    if (!apiKey) throw new Error("API Key is missing in Settings");

    // Run search for each zip segment
    for (const zipToTry of zipsToSearch) {
        const payload = {
            searchby: "zip_code",
            zip: zipToTry,
            shipped_from: startDateStr,
            shipped_to: endDateStr,
            showPreshipment: 1,
            limit: limit
        };
        debugPayloads.push(payload);

        try {
            const proxyUrl = buildProxyUrl(API_URL, corsKey);
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                errors.push(`Zip ${zipToTry}: ${errorText}`);
                continue; 
            }

            const data: ApiResponse = await response.json();
            if (data.data?.data) {
                allRawItems.push(...data.data.data);
            }
        } catch (innerErr) {
            errors.push(`Zip ${zipToTry} Network Error: ${(innerErr as Error).message}`);
        }
    }

    // If we have no items and ALL attempts failed, throw error
    if (allRawItems.length === 0 && errors.length === zipsToSearch.length) {
        throw new Error(errors.join(' | '));
    }

    // Find best match from aggregated items
    const match = findBestTracking({ data: { data: allRawItems } });
    
    // Attach raw items for debugging
    const debugInfo = {
      apiPayloads: debugPayloads,
      rawResponseItems: allRawItems,
      errors: errors.length > 0 ? errors : undefined
    };

    if (match) {
      const trackingUrl = `https://www.ups.com/track?tracknum=${match.tracking_number}`;
      const expDate = new Date(match.expected_delivery);
      const now = new Date();

      // Time Calculations (in days)
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysSinceOrder = (now.getTime() - orderDate.getTime()) / msPerDay;
      const leadTimeDays = (expDate.getTime() - orderDate.getTime()) / msPerDay;

      let status: 'QUEUED' | 'PROCESSED' | 'SKIPPED' = 'PROCESSED';
      let note: string | undefined;

      // --- LOGIC GATES ---

      // 1. Queue Logic: If customer ordered less than X days ago -> Queue it.
      if (daysSinceOrder < daysForQueue) {
        status = 'QUEUED';
        note = `Order < ${daysForQueue} days old`;
      } 
      // 2. Short Delivery Logic: If expected delivery is less than X days from Order Date -> Queue it
      else if (leadTimeDays < daysForQueue) {
        status = 'QUEUED';
        note = `Delivery less than ${daysForQueue} days`;
      }

      // 3. Warning Logic: If processed, check if it meets the Warning target
      const is7DaysFuture = leadTimeDays > daysForWarning;
      
      if (status === 'PROCESSED' && !is7DaysFuture) {
          note = `Delivery less than ${daysForWarning} days`;
      }

      return {
        orderNumber: orderNum,
        shopifyOrderId,
        zip: cleanZip,
        orderDate: orderDateStr,
        trackingNumber: match.tracking_number,
        hashId: match.hash_id,
        trackingUrl: trackingUrl,
        expectedDelivery: match.expected_delivery,
        weight: match.weight || 'N/A',
        status: status,
        is7DaysFuture: is7DaysFuture,
        note: note,
        processedAt,
        debugInfo
      };

    } else {
      const reason = allRawItems.length === 0 
        ? 'No suitable tracking found' 
        : `Found ${allRawItems.length} items but none matched criteria (In Transit/Delivered/On the Way)`;

      return {
        orderNumber: orderNum,
        shopifyOrderId,
        zip: cleanZip,
        orderDate: orderDateStr,
        trackingNumber: null,
        trackingUrl: null,
        expectedDelivery: null,
        status: 'SKIPPED',
        note: reason,
        is7DaysFuture: false,
        processedAt,
        debugInfo
      };
    }

  } catch (error) {
    return {
      orderNumber: orderNum,
      shopifyOrderId,
      zip: cleanZip,
      orderDate: orderDateStr,
      trackingNumber: null,
      trackingUrl: null,
      expectedDelivery: null,
      status: 'ERROR',
      note: (error as Error).message.substring(0, 100),
      is7DaysFuture: false,
      processedAt
    };
  }
};

function findBestTracking(apiResponse: ApiResponse) {
  const items = apiResponse.data?.data || [];
  
  // Filter for items that are considered "Active"
  const validItems = items.filter(item => {
    const s = (item.status || "").toLowerCase();
    
    // 1. Check known status keywords
    const hasStatus = s.includes("transit") || 
                      s.includes("delivered") || 
                      s.includes("on the way") || 
                      s.includes("out for delivery") || 
                      s.includes("picked up") ||
                      s.includes("arrived");

    if (hasStatus) return true;

    // 2. Check Shipped Date
    if (item.shipped_date) return true;

    // 3. Check Future Delivery
    if (item.expected_delivery) {
        const exp = new Date(item.expected_delivery);
        const now = new Date();
        if (exp.getTime() > now.getTime()) return true;
    }

    return false;
  });

  if (validItems.length === 0) return null;

  // Find the package with the FARTHEST expected delivery date
  return validItems.reduce((prev, current) => {
    const prevDate = new Date(prev.expected_delivery || 0);
    const currDate = new Date(current.expected_delivery || 0);
    return (currDate > prevDate) ? current : prev;
  });
}

export const buyTrackingNumber = async (hashId: string, apiKey: string, corsKey?: string): Promise<string> => {
    const payload = { hashid: hashId };
    try {
        if (!apiKey) throw new Error("API Key is missing in Settings");

        const proxyUrl = buildProxyUrl(BUY_API_URL, corsKey);
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
        }

        const data = await response.json();
        
        if (data.success === "true" || data.success === true) {
            return data.message;
        }
        
        throw new Error(data.message || "Unknown error purchasing tracking");
    } catch (error) {
        throw new Error(`Buy API Error: ${(error as Error).message}`);
    }
};

export const fulfillShopifyOrder = async (
    shopifyOrderId: string, 
    trackingNumber: string,
    shopifyDomain: string,
    shopifyToken: string,
    corsKey?: string
): Promise<void> => {
    try {
        if (!shopifyDomain || !shopifyToken) {
            throw new Error("Shopify credentials missing in Settings");
        }

        // Clean domain if user added https://
        const domain = shopifyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

        // Step 1: Get Fulfillment Order ID
        const foUrl = `https://${domain}/admin/api/2023-10/orders/${shopifyOrderId}/fulfillment_orders.json`;
        const foProxyUrl = buildProxyUrl(foUrl, corsKey);
        
        const foResponse = await fetch(foProxyUrl, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': shopifyToken,
                'Content-Type': 'application/json'
            }
        });

        if (!foResponse.ok) {
             const txt = await foResponse.text();
             throw new Error(`Failed to get fulfillment order: ${txt}`);
        }

        const foData = await foResponse.json();
        if (!foData.fulfillment_orders || foData.fulfillment_orders.length === 0) {
            throw new Error('No fulfillment orders found for this order.');
        }

        const fulfillmentOrderId = foData.fulfillment_orders[0].id;

        // Step 2: Create Fulfillment
        const fulfillUrl = `https://${domain}/admin/api/2023-10/fulfillments.json`;
        const fulfillProxyUrl = buildProxyUrl(fulfillUrl, corsKey);

        const payload = {
            fulfillment: {
                line_items_by_fulfillment_order: [
                    {
                        fulfillment_order_id: fulfillmentOrderId,
                    },
                ],
                tracking_info: {
                    number: trackingNumber,
                    company: "UPS",
                },
                notify_customer: true,
            },
        };

        const fulfillResponse = await fetch(fulfillProxyUrl, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': shopifyToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const fulfillResult = await fulfillResponse.json();
        
        if (fulfillResult.errors) {
            throw new Error(JSON.stringify(fulfillResult.errors));
        }

    } catch (error) {
        throw error;
    }
};
