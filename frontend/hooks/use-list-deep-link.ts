import { useEffect, useRef } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

type ItemMatcher<T> = (item: T, value: string, paramName: string) => boolean;

const DEFAULT_PARAM_NAMES = ["id", "poId", "vendorId", "disputeId"];

const defaultMatcher = <T,>(item: T, value: string, paramName: string): boolean => {
  const record = item as Record<string, unknown>;
  if (paramName === "poId") {
    return String(record.poId ?? record.purchaseOrderId ?? "") === value;
  }
  if (paramName === "vendorId") {
    return String(record.vendorId ?? record.id ?? "") === value;
  }
  if (paramName === "disputeId") {
    return String(record.disputeId ?? record.id ?? "") === value;
  }
  return (
    String(record.id ?? "") === value ||
    String(record.rfqId ?? "") === value ||
    String(record.requisitionId ?? "") === value ||
    String(record.poId ?? "") === value ||
    String(record.itemId ?? "") === value
  );
};

/**
 * Opens a list detail when the page loads with notification deep-link query params.
 * Strips those params after opening so closing the detail dialog does not re-trigger it.
 */
export function useListDeepLink<T>(
  items: T[],
  loading: boolean,
  onOpen: (item: T) => void,
  options?: {
    paramNames?: string[];
    match?: ItemMatcher<T>;
  },
) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handledKeyRef = useRef<string | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const paramNames = options?.paramNames ?? DEFAULT_PARAM_NAMES;
  const match = options?.match ?? defaultMatcher;

  useEffect(() => {
    if (loading || items.length === 0) return;

    let deepLinkKey: string | null = null;
    let matchedItem: T | undefined;

    for (const paramName of paramNames) {
      const value = searchParams.get(paramName);
      if (!value) continue;
      const found = items.find((item) => match(item, value, paramName));
      if (found) {
        deepLinkKey = `${paramName}=${value}`;
        matchedItem = found;
        break;
      }
    }

    if (!deepLinkKey || !matchedItem) {
      handledKeyRef.current = null;
      return;
    }

    if (handledKeyRef.current === deepLinkKey) {
      return;
    }

    handledKeyRef.current = deepLinkKey;
    onOpenRef.current(matchedItem);
    router.replace(pathname, { scroll: false });
  }, [loading, items, searchParams, pathname, router, paramNames, match]);
}
