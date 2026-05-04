package com.procurement.scoringservice.repository;

import com.procurement.scoringservice.entity.ScoringWeights;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ScoringWeightsRepository extends JpaRepository<ScoringWeights, Long> {
    Optional<ScoringWeights> findByCategory(String category);
}
