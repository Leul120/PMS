"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { poApi, rfqApi } from "@/lib/api";
import { collectRfqIdsWithPo } from "@/lib/bid-scoring";
import { useToast } from "@/hooks/use-toast";

interface PODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-select an awarded RFQ when opening (e.g. from /rfq awarded tab) */
  initialRfqId?: string;
  initialData?: {
    id: string | number;
    rfqId?: string | number;
    rfqTitle?: string;
    vendorId?: string | number;
    vendorName?: string;
    totalAmount?: number;
    deliveryDate?: string;
  } | null;
}

const EMPTY_FORM = {
  rfqId: "",
  vendorId: "",
  totalAmount: "",
  expectedDeliveryDate: "",
  bidId: "",
};

type WinningBidSummary = {
  bidId: string;
  vendorId: string;
  vendorName: string;
  bidAmount: number;
  deliveryDays?: number;
  score?: number;
};

/** Derives an expected delivery date (today + the bid's promised delivery days). */
function deliveryDateFromBid(deliveryDays: unknown): string {
  const days = Number(deliveryDays);
  if (!Number.isFinite(days) || days <= 0) return "";
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}

function normaliseWinningBid(bid: any): WinningBidSummary | null {
  if (!bid?.vendorId) return null;
  return {
    bidId: String(bid.bidId || bid.id),
    vendorId: String(bid.vendorId),
    vendorName: bid.vendorName || `Vendor #${bid.vendorId}`,
    bidAmount: Number(bid.bidAmount),
    deliveryDays: bid.deliveryDays,
    score: bid.score ?? (bid.totalScore != null ? Math.round(Number(bid.totalScore)) : undefined),
  };
}

export function PODialog({ open, onOpenChange, onSuccess, initialRfqId, initialData }: PODialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingWinningBid, setLoadingWinningBid] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [winningBidError, setWinningBidError] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [winningBid, setWinningBid] = useState<WinningBidSummary | null>(null);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [linkedRfqTitle, setLinkedRfqTitle] = useState("");
  const [linkedVendorName, setLinkedVendorName] = useState("");

  const isEditing = !!initialData?.id;

  const selectedRfq = rfqs.find((r) => String(r.rfqId || r.id) === formData.rfqId);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setFormData({
        rfqId: String(initialData.rfqId || ""),
        vendorId: String(initialData.vendorId || ""),
        totalAmount: String(initialData.totalAmount || ""),
        expectedDeliveryDate: initialData.deliveryDate
          ? new Date(initialData.deliveryDate).toISOString().split("T")[0]
          : "",
        bidId: "",
      });
      setLinkedRfqTitle(initialData.rfqTitle || "");
      setLinkedVendorName(initialData.vendorName || "");
      setWinningBid(null);
    } else {
      setFormData(EMPTY_FORM);
      setLinkedRfqTitle("");
      setLinkedVendorName("");
      setWinningBid(null);
      setWinningBidError("");
    }
    loadDropdownData();
  }, [open]);

  useEffect(() => {
    if (!open || isEditing || !initialRfqId) return;
    handleRfqChange(initialRfqId);
  }, [open, initialRfqId, isEditing]);

  async function loadDropdownData() {
    setLoadingData(true);
    setLoadError(false);
    try {
      const [rfqData, poData] = await Promise.all([
        rfqApi.getAllList(),
        isEditing ? Promise.resolve([]) : poApi.getAllList().catch(() => []),
      ]);
      const rfqIdsWithPo = collectRfqIdsWithPo(poData as any[]);
      setRfqs(
        isEditing
          ? rfqData
          : rfqData.filter(
              (r: any) =>
                r.status?.toUpperCase() === "AWARDED" &&
                !rfqIdsWithPo[String(r.rfqId || r.id)],
            ),
      );
      if (initialData?.rfqId) {
        const rfqId = String(initialData.rfqId);
        const match = (rfqData as any[]).find((r: any) => String(r.rfqId || r.id) === rfqId);
        if (match?.title) {
          setLinkedRfqTitle(match.title);
        } else if (!initialData.rfqTitle) {
          const rfq = await rfqApi.getById(rfqId).catch(() => null);
          if (rfq?.title) setLinkedRfqTitle(rfq.title);
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleRfqChange(rfqId: string) {
    setFormData((prev) => ({
      ...prev,
      rfqId,
      bidId: "",
      vendorId: "",
      totalAmount: "",
      expectedDeliveryDate: "",
    }));
    setWinningBid(null);
    setWinningBidError("");
    setRfqOpen(false);
    if (!rfqId) return;

    setLoadingWinningBid(true);
    try {
      const bid = await rfqApi.getWinningBid(rfqId);
      const summary = normaliseWinningBid(bid);
      if (!summary) {
        setWinningBidError("No winning bid found for this RFQ. Award a contract on the RFQ page first.");
        return;
      }
      setWinningBid(summary);
      setFormData((prev) => ({
        ...prev,
        rfqId,
        bidId: summary.bidId,
        vendorId: summary.vendorId,
        totalAmount: String(summary.bidAmount),
        expectedDeliveryDate: deliveryDateFromBid(summary.deliveryDays),
      }));
    } catch (err) {
      setWinningBidError(
        err instanceof Error
          ? err.message
          : "Could not load the winning bid. Ensure the RFQ is Awarded and a contract was granted."
      );
    } finally {
      setLoadingWinningBid(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rfqId || !formData.vendorId || !formData.totalAmount) {
      toast({
        title: "Missing required fields",
        description: isEditing
          ? "Please complete all required fields."
          : "Select an awarded RFQ — the winning vendor and amount are filled in automatically.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        rfqId: parseInt(formData.rfqId),
        vendorId: parseInt(formData.vendorId),
        totalAmount: parseFloat(formData.totalAmount),
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        ...(!isEditing && formData.bidId ? { bidId: parseInt(formData.bidId) } : {}),
      };
      if (isEditing) {
        await poApi.update(initialData!.id, payload);
        toast({ title: "Purchase Order updated", description: "The purchase order has been updated." });
      } else {
        await poApi.create(payload);
        toast({ title: "Purchase Order created", description: "The purchase order has been created successfully." });
      }
      onSuccess();
      onOpenChange(false);
      setFormData(EMPTY_FORM);
      setWinningBid(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} purchase order`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  function formatDate(date: string) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {isEditing ? "Edit Purchase Order" : "Create Purchase Order"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update the details of this purchase order."
              : "Only awarded RFQs appear here. The winning vendor, amount, and delivery date are locked to the awarded bid."}
          </DialogDescription>
        </DialogHeader>

        {loadError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Could not load awarded RFQs.</span>
            <button
              type="button"
              onClick={loadDropdownData}
              className="ml-auto font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* ── RFQ ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Awarded RFQ *</Label>
            {isEditing ? (
              <Input
                value={selectedRfq?.title || linkedRfqTitle || "Linked RFQ"}
                disabled
                className="bg-muted h-8 text-xs"
              />
            ) : (
              <Popover open={rfqOpen} onOpenChange={setRfqOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    disabled={loadingData}
                    className="w-full h-8 text-xs justify-between font-normal"
                  >
                    {loadingData ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading RFQs…
                      </span>
                    ) : selectedRfq ? (
                      <span className="truncate">{selectedRfq.title}</span>
                    ) : (
                      <span className="text-muted-foreground">Select an awarded RFQ…</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search RFQs…" className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                        No awarded RFQs awaiting a PO. Check the Awarded tab on RFQ &amp; Bidding.
                      </CommandEmpty>
                      <CommandGroup>
                        {rfqs.map((rfq: any) => {
                          const id = String(rfq.rfqId || rfq.id);
                          return (
                            <CommandItem
                              key={id}
                              value={`${rfq.title} ${id}`}
                              onSelect={() => handleRfqChange(id)}
                              className="text-xs cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-3.5 w-3.5 shrink-0",
                                  formData.rfqId === id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{rfq.title}</span>
                                <span className="text-muted-foreground">
                                  Deadline: {formatDate(rfq.deadline)}
                                  {rfq.estimatedValue
                                    ? ` · Est. $${Number(rfq.estimatedValue).toLocaleString()}`
                                    : ""}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* ── Winning bid summary (create only) ── */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Winning bid</Label>
              {loadingWinningBid ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground py-2 pl-0.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading winning bid…
                </p>
              ) : winningBidError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {winningBidError}
                </div>
              ) : !formData.rfqId ? (
                <p className="text-xs text-muted-foreground py-1 pl-0.5">
                  Select an awarded RFQ above to load the winning vendor and amount.
                </p>
              ) : winningBid ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-900">
                    <Trophy className="h-3.5 w-3.5" />
                    {winningBid.vendorName}
                    {winningBid.score != null && winningBid.score > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                        Score {winningBid.score}
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between text-emerald-800/80">
                    <span>Contract amount</span>
                    <span className="font-semibold">${winningBid.bidAmount.toLocaleString()}</span>
                  </div>
                  {winningBid.deliveryDays ? (
                    <div className="flex justify-between text-emerald-800/80">
                      <span>Promised delivery</span>
                      <span>{winningBid.deliveryDays} days</span>
                    </div>
                  ) : null}
                  <p className="text-[10px] text-emerald-700/80 pt-0.5">
                    Vendor and amount are fixed to the awarded bid — the backend rejects mismatches.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* ── Vendor (edit only — create uses winning bid above) ── */}
          {isEditing && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vendor</Label>
              <Input
                value={linkedVendorName || `Vendor #${formData.vendorId}`}
                disabled
                className="bg-muted h-8 text-xs"
              />
            </div>
          )}

          {/* ── Amount + Date ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount" className="text-xs font-medium">
                Total Amount ($) *
              </Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                placeholder="0.00"
                required
                disabled={!isEditing && !!winningBid}
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedDeliveryDate" className="text-xs font-medium">
                Expected Delivery Date
              </Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) =>
                  setFormData({ ...formData, expectedDeliveryDate: e.target.value })
                }
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={isSubmitting || loadingData || loadingWinningBid || (!isEditing && !winningBid)}
            >
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
