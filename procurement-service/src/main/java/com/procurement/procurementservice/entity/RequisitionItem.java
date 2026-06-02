package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;

@Entity
@Table(name = "RequisitionItem", indexes = {
    @Index(name = "idx_req_item_tenant_id", columnList = "tenantId")
})
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RequisitionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long itemId;

    @Column(nullable = false)
    private Long tenantId;

    @ManyToOne
    @JoinColumn(name = "requisitionId")
    private PurchaseRequisition requisition;
    
    private String itemName;
    
    private String description;
    
    private Integer quantity;
    
    private String unit;
    
    private BigDecimal estimatedUnitPrice;
    
    private String category; // IT, Construction, Stationery, etc.
}
