"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vendorApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Trash2, Download } from "lucide-react";

// Common vendor document types
const DOCUMENT_TYPES = [
  { value: "ISO 9001 Certificate", label: "ISO 9001 Certificate" },
  { value: "ISO 14001 Certificate", label: "ISO 14001 Certificate" },
  { value: "Business License", label: "Business License" },
  { value: "Tax Registration", label: "Tax Registration" },
  { value: "Insurance Certificate", label: "Insurance Certificate" },
  { value: "Safety Certificate", label: "Safety Certificate" },
  { value: "Quality Assurance", label: "Quality Assurance" },
  { value: "Environmental Compliance", label: "Environmental Compliance" },
  { value: "Financial Statement", label: "Financial Statement" },
  { value: "Bank Reference", label: "Bank Reference" },
  { value: "Trade License", label: "Trade License" },
  { value: "Other", label: "Other" },
];

interface Vendor {
  id: string;
  companyName: string;
}

interface Document {
  documentId: string;
  documentType: string;
  documentName: string;
  fileUrl: string;
  issueDate: string;
  expiryDate: string;
  status: string;
}

interface VendorDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor | null;
  onSuccess: () => void;
}

export function VendorDocumentDialog({ open, onOpenChange, vendor, onSuccess }: VendorDocumentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    documentType: "",
    documentName: "",
    fileUrl: "",
    issueDate: "",
    expiryDate: "",
  });

  async function loadDocuments() {
    if (!vendor) return;
    try {
      const data = await vendorApi.getDocuments(vendor.id);
      setDocuments(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load documents",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    if (open && vendor) {
      loadDocuments();
    }
  }, [open, vendor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    try {
      setLoading(true);
      await vendorApi.uploadDocument(vendor.id, {
        documentType: formData.documentType,
        documentName: formData.documentName,
        fileUrl: formData.fileUrl,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate,
      });
      toast({ title: "Success", description: "Document uploaded successfully" });
      setFormData({ documentType: "", documentName: "", fileUrl: "", issueDate: "", expiryDate: "" });
      loadDocuments();
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!vendor) return;
    try {
      await vendorApi.deleteDocument(documentId);
      toast({ title: "Success", description: "Document deleted" });
      loadDocuments();
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete document",
        variant: "destructive",
      });
    }
  }

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded">
        <DialogHeader>
          <DialogTitle>Vendor Documents - {vendor.companyName}</DialogTitle>
          <DialogDescription>Manage compliance documents and certificates</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 border-b pb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="docType">Document Type *</Label>
              <Select
                value={formData.documentType}
                onValueChange={(value) => setFormData({ ...formData, documentType: value })}
              >
                <SelectTrigger id="docType">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docName">Document Name</Label>
              <Input
                id="docName"
                value={formData.documentName}
                onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileUrl">File URL</Label>
            <Input
              id="fileUrl"
              placeholder="https://..."
              value={formData.fileUrl}
              onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Uploading..." : "Upload Document"}
          </Button>
        </form>

        <div className="space-y-4">
          <h3 className="font-semibold">Existing Documents</h3>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No documents uploaded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.documentId}>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell>{doc.documentName}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        doc.status === 'VALID' ? 'bg-green-100 text-green-800' :
                        doc.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {doc.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(doc.expiryDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(doc.fileUrl, '_blank')}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(doc.documentId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
