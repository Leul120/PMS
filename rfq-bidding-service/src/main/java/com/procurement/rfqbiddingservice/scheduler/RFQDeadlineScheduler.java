package com.procurement.rfqbiddingservice.scheduler;

import com.procurement.rfqbiddingservice.entity.RFQ;
import com.procurement.rfqbiddingservice.repository.RFQRepository;
import com.procurement.rfqbiddingservice.service.RFQService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class RFQDeadlineScheduler {

    private final RFQService rfqService;
    private final RFQRepository rfqRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    /**
     * Every minute: close RFQs whose deadline has passed.
     */
    @Scheduled(cron = "0 * * * * *")
    public void checkExpiredRFQs() {
        log.debug("Checking for expired RFQs...");
        rfqService.checkAndCloseExpiredRFQs();
    }

    /**
     * Every hour: find RFQs whose deadline is within the next 24 hours
     * and publish a bid.deadline.approaching event so the notification-service
     * can alert vendors who haven't bid yet.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void notifyApproachingDeadlines() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime in24h = now.plusHours(24);

        // Find open RFQs with deadline in the next 24 hours
        List<RFQ> approaching = rfqRepository.findByStatus("Open").stream()
            .filter(rfq -> rfq.getDeadline() != null
                && rfq.getDeadline().isAfter(now)
                && rfq.getDeadline().isBefore(in24h))
            .toList();

        if (approaching.isEmpty()) {
            log.debug("No RFQ deadlines approaching in the next 24 hours.");
            return;
        }

        log.info("Publishing deadline-approaching events for {} RFQ(s)", approaching.size());
        for (RFQ rfq : approaching) {
            Map<String, Object> event = new HashMap<>();
            event.put("rfqId", rfq.getRfqId());
            event.put("title", rfq.getTitle());
            event.put("deadline", rfq.getDeadline().toString());
            event.put("categoryId", rfq.getCategoryId());
            event.put("estimatedValue", rfq.getEstimatedValue());
            kafkaTemplate.send("bid.deadline.approaching", event);
            log.info("Deadline-approaching event sent for RFQ {} (deadline: {})",
                rfq.getRfqId(), rfq.getDeadline());
        }
    }
}
