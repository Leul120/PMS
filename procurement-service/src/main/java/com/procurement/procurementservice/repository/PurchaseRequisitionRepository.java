package com.procurement.procurementservice.repository;

import com.procurement.procurementservice.entity.PurchaseRequisition;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseRequisitionRepository extends JpaRepository<PurchaseRequisition, Long>, JpaSpecificationExecutor<PurchaseRequisition> {
    List<PurchaseRequisition> findByRequesterId(Long requesterId);
    List<PurchaseRequisition> findByStatus(String status);
    List<PurchaseRequisition> findByDepartment(String department);
    Optional<PurchaseRequisition> findByRequisitionNumber(String requisitionNumber);
    Page<PurchaseRequisition> findAll(Pageable pageable);
}
