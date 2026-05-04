package com.procurement.procurementservice.repository;

import com.procurement.procurementservice.entity.PurchaseRequisition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseRequisitionRepository extends JpaRepository<PurchaseRequisition, Long> {
    List<PurchaseRequisition> findByRequesterId(Long requesterId);
    List<PurchaseRequisition> findByStatus(String status);
    List<PurchaseRequisition> findByDepartment(String department);
    Optional<PurchaseRequisition> findByRequisitionNumber(String requisitionNumber);
}
