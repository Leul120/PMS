"use client";

import { useState, useEffect, useRef } from "react";
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
import { FileText, Trash2, Download, Upload, X } from "lucide-react";

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

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ALLOWED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.docx";
const MAX_SIZE_MB = 10;

interface Vendor {
  id: string;
  companyName: string;
}

interface Document {
  documentId: string;
  documentType: string;
  documentName: string;
  originalFilename: string;
  contentType: string;
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

const EMPTY_FORM = {
  documentType: "",
  documentName: "",
  issueDate: "",
  expiryDate: "",
};

export function VendorDocumentDialog({ open, onOpenChange, vendor, onSuccess }: VendorDocumentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    } else {
      setFormData(EMPTY_FORM);
      setSelectedFile(null);
    }
  }, [open, vendor]);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only PDF, PNG, JPG, and DOCX files are allowed";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File size must not exceed ${MAX_SIZE_MB} MB`;
    }
    return null;
  }

  function handleFileSelect(file: File) {
    const error = validateFile(file);
    if (error) {
      toast({ title: "Invalid file", description: error, variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (!formData.documentName) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData((prev) => ({ ...prev, documentName: nameWithoutExt }));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please select a file to upload", variant: "destructive" });
      return;
    }
    if (!formData.documentType) {
      toast({ title: "Missing field", description: "Please select a document type", variant: "destructive" });
      return;
    }
    if (!formData.expiryDate) {
      toast({ title: "Missing field", description: "Expiry date is required", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("documentType", formData.documentType);
      fd.append("documentName", formData.documentName || selectedFile.name);
      if (formData.issueDate) fd.append("issueDate", formData.issueDate);
      fd.append("expiryDate", formData.expiryDate);

      await vendorApi.uploadDocument(vendor.id, fd);
      toast({ title: "Success", description: "Document uploaded successfully" });
      setFormData(EMPTY_FORM);
      setSelectedFile(null);
      loadDocuments();
      onSuccess();
    } catch (err) {
      toast({
        title: "Upload failed",
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

  async function handleDownload(doc: Document) {
    try {
      const url = vendorApi.downloadDocumentUrl(doc.documentId);
      const token = typeof window !== "undefined"
        ? JSON.parse(sessionStorage.getItem("auth-storage") || "{}")?.state?.token
        : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.originalFilename || doc.documentName || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Could not download file",
        variant: "destructive",
      });
    }
  }

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded">
        <DialogHeader>
          <DialogTitle>Vendor Documents — {vendor.companyName}</DialogTitle>
          <DialogDescription>Upload and manage compliance documents and certificates</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 border-b pb-6">
          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, PNG, JPG, DOCX — max {MAX_SIZE_MB} MB</p>
              </div>
            )}
          </div>

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
                placeholder="e.g. ISO Certificate 2024"
                value={formData.documentName}
                onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date *</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading || !selectedFile} className="w-full">
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
                        doc.status === "VALID" ? "bg-green-100 text-green-800" :
                        doc.status === "EXPIRED" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {doc.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(doc.expiryDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleDownload(doc)} title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(doc.documentId)} title="Delete">
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
