package com.procurement.procurementservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "RequisitionItem")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RequisitionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long itemId;
    
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
