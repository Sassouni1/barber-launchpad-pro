import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Receipt, Loader2, Scissors, Download, FolderDown } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { buildReceiptPdf, receiptFileName, extractReceiptData, downloadReceipt } from '@/lib/orderReceipt';
import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;

function dedupeOrders<T extends { id: string; external_order_id: string | null; order_date: string; order_details: any }>(orders: T[]): T[] {
  if (!orders?.length) return orders;
  // Prefer rows with an external_order_id (real order webhook) over form-lead rows
  // that arrived seconds earlier with the same product signature.
  const kept: T[] = [];
  for (const o of orders) {
    const d = (o.order_details || {}) as Record<string, any>;
    const sig = `${d['Lace or Skin'] || ''}|${d['Choose Color'] || ''}|${d['Curl Pattern — only if needed'] || ''}`.toLowerCase();
    const ts = new Date(o.order_date).getTime();
    const dupIdx = kept.findIndex((k) => {
      const kd = (k.order_details || {}) as Record<string, any>;
      const ksig = `${kd['Lace or Skin'] || ''}|${kd['Choose Color'] || ''}|${kd['Curl Pattern — only if needed'] || ''}`.toLowerCase();
      const kts = new Date(k.order_date).getTime();
      return ksig === sig && sig.replace(/\|/g, '').length > 0 && Math.abs(kts - ts) < 15 * 60 * 1000;
    });
    if (dupIdx === -1) {
      kept.push(o);
    } else {
      const existing = kept[dupIdx];
      const existingHasExt = !!existing.external_order_id;
      const currentHasExt = !!o.external_order_id;
      const existingHasItems = Array.isArray(((existing.order_details as any)?.order?.line_items) || (existing.order_details as any)?.line_items);
      const currentHasItems = Array.isArray(((o.order_details as any)?.order?.line_items) || (o.order_details as any)?.line_items);
      const preferCurrent = (currentHasExt && !existingHasExt) || (currentHasExt === existingHasExt && currentHasItems && !existingHasItems);
      if (preferCurrent) kept[dupIdx] = o;
    }
  }
  return kept;
}

export default function Orders() {
  const { data: rawOrders, isLoading } = useUserOrders();
  const orders = rawOrders ? dedupeOrders(rawOrders) : rawOrders;
  const [zipping, setZipping] = useState(false);

  const handleDownloadAll = async () => {
    if (!orders?.length) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const order of orders) {
        let name = receiptFileName(order);
        // Ensure unique filenames inside the zip
        let counter = 2;
        while (usedNames.has(name)) {
          name = name.replace(/\.pdf$/, `-${counter}.pdf`);
          counter++;
        }
        usedNames.add(name);
        const doc = buildReceiptPdf(order);
        zip.file(name, doc.output('arraybuffer'));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-receipts-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${orders.length} receipt${orders.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Failed to download receipts');
    } finally {
      setZipping(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Order Receipts</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Download receipts for your records and taxes
            </p>
          </div>
          {orders && orders.length > 0 && (
            <Button
              onClick={handleDownloadAll}
              disabled={zipping}
              className="gold-gradient text-primary-foreground font-semibold shadow-md hover:opacity-90 transition-opacity shrink-0"
            >
              {zipping ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FolderDown className="w-4 h-4 mr-2" />
              )}
              {zipping ? 'Preparing...' : 'Download All'}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !orders?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: Order) => {
              const receipt = extractReceiptData(order);

              return (
                <Card key={order.id} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Scissors className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-medium">
                            {receipt.items.length > 0
                              ? receipt.items.map((i) => i.title).join(', ')
                              : 'Hair System Order'}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Ordered {format(new Date(order.order_date), 'MMMM d, yyyy')}
                        </p>

                        {receipt.specs.length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                            {receipt.specs.map((item, i) => (
                              <span key={i} className="text-sm">
                                <span className="text-muted-foreground">{item.label}:</span>{' '}
                                <span className="text-foreground font-medium">{item.value}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {receipt.total !== null && (
                          <p className="text-sm font-semibold text-foreground">
                            Total: {receipt.currencySymbol}{receipt.total.toFixed(2)} {receipt.currencyCode}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => downloadReceipt(order)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Receipt
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
