package com.procurement.scoringservice.scoring;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Deterministic quality score (0–100) from structured delivery inspection fields.
 * Free-text remarks are audit-only; used only when structured rating is absent (legacy).
 */
public final class DeliveryQualityScorer {

    private DeliveryQualityScorer() {}

    public static int computeQualityScore(
            String qualityRating,
            String qualityIssueTypes,
            Integer quantityDelivered,
            Integer quantityOrdered,
            String qualityRemarks) {

        if (qualityRating != null && !qualityRating.isBlank()) {
            int score = baseFromRating(qualityRating.trim().toUpperCase(Locale.ROOT));
            score = applyIssuePenalties(score, qualityIssueTypes);
            score = applyQuantityPenalty(score, quantityDelivered, quantityOrdered);
            return Math.max(0, Math.min(100, score));
        }

        return legacyScoreFromRemarks(qualityRemarks);
    }

    private static int baseFromRating(String rating) {
        return switch (rating) {
            case "ACCEPTED" -> 100;
            case "ACCEPTED_WITH_ISSUES" -> 88;
            case "REJECTED" -> 40;
            default -> 100;
        };
    }

    private static int applyIssuePenalties(int score, String qualityIssueTypes) {
        if (qualityIssueTypes == null || qualityIssueTypes.isBlank()) {
            return score;
        }
        Set<String> issues = Arrays.stream(qualityIssueTypes.split(","))
            .map(String::trim)
            .map(s -> s.toUpperCase(Locale.ROOT))
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toSet());

        int floor = score;
        if (issues.contains("DAMAGED") || issues.contains("WRONG_SPEC")) {
            floor = Math.min(floor, 60);
        }
        if (issues.contains("SHORT_SHIP") || issues.contains("WRONG_ITEM")) {
            floor = Math.min(floor, 75);
        }
        if (issues.contains("PACKAGING")) {
            floor = Math.min(floor, 88);
        }
        return floor;
    }

    private static int applyQuantityPenalty(int score, Integer quantityDelivered, Integer quantityOrdered) {
        if (quantityOrdered == null || quantityOrdered <= 0 || quantityDelivered == null) {
            return score;
        }
        double ratio = (double) quantityDelivered / quantityOrdered;
        if (ratio < 0.5) {
            return Math.min(score, 60);
        }
        if (ratio < 0.9) {
            return Math.min(score, 75);
        }
        return score;
    }

    /** Legacy keyword scan when older deliveries lack structured rating. */
    private static int legacyScoreFromRemarks(String remarks) {
        int qualityScore = 100;
        if (remarks == null || remarks.isBlank()) {
            return qualityScore;
        }
        String lower = remarks.toLowerCase(Locale.ROOT);
        if (lower.contains("damaged") || lower.contains("broken") || lower.contains("defective")) {
            qualityScore = 60;
        } else if (lower.contains("partial") || lower.contains("incomplete") || lower.contains("missing")) {
            qualityScore = 75;
        } else if (lower.contains("minor") || lower.contains("slight")) {
            qualityScore = 88;
        }
        return qualityScore;
    }
}
