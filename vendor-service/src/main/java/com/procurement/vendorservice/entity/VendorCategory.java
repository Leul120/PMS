package com.procurement.vendorservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "VendorCategory")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorCategory {
    @Id
    private Long categoryId;
    
    private String categoryName;
    
    private String description;
}
