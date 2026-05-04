package com.procurement.rfqbiddingservice.scheduler;

import com.procurement.rfqbiddingservice.service.RFQService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RFQDeadlineScheduler {
    
    private final RFQService rfqService;
    
    @Scheduled(cron = "0 * * * * *") // Run every minute
    public void checkExpiredRFQs() {
        log.debug("Checking for expired RFQs...");
        rfqService.checkAndCloseExpiredRFQs();
    }
}
