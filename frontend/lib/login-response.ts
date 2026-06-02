import type { User } from "@/lib/auth-store";
import type { OperatingContext } from "@/lib/operating-context";
import type { OrganizationType } from "@/lib/operating-context";

export type LoginPayload = {
  accessToken: string;
  userId: number;
  email: string;
  fullName: string;
  role: string;
  procurementRole?: string;
  supplierRole?: string | null;
  tenantId: number;
  tenantName: string;
  tenantDomain: string;
  organizationType?: OrganizationType | string;
  operatingContext?: OperatingContext | string;
  availableContexts?: string[];
  mustChangePassword?: boolean;
};

export function mapLoginToUser(response: LoginPayload): User {
  const fullName = response.fullName || "";
  const nameParts = fullName.split(" ");
  return {
    id: String(response.userId || ""),
    userId: String(response.userId || ""),
    email: response.email || "",
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" ") || "",
    fullName,
    role: response.role as User["role"],
    roleName: response.role as User["roleName"],
    procurementRole: (response.procurementRole || response.role) as User["role"],
    active: true,
    tenantId: response.tenantId,
    tenantName: response.tenantName,
    tenantDomain: response.tenantDomain,
  };
}

export function sessionMetaFromLogin(response: LoginPayload) {
  return {
    tenant: {
      tenantId: response.tenantId,
      tenantName: response.tenantName,
      tenantDomain: response.tenantDomain,
    },
    organizationType: (response.organizationType as OrganizationType) || undefined,
    operatingContext: (response.operatingContext as OperatingContext) || "PROCUREMENT",
    availableContexts: response.availableContexts || [],
    procurementRole: response.procurementRole,
    supplierRole: response.supplierRole,
  };
}
