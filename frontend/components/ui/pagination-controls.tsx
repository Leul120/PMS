"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;           // 0-indexed current page
  totalPages: number;
  totalElements: number;
  size: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function PaginationControls({
  page,
  totalPages,
  totalElements,
  size,
  onPageChange,
  loading = false,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const from = page * size + 1;
  const to = Math.min((page + 1) * size, totalElements);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-white">
      <p className="text-xs text-gray-500">
        Showing {from}–{to} of {totalElements}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0 || loading}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-gray-600 px-2">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1 || loading}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
