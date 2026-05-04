package com.procurement.rfqbiddingservice.config;

import com.procurement.rfqbiddingservice.service.RFQService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledTasks {
    
    private final RFQService rfqService;
    
    // Run every 5 minutes to check for expired RFQs
    @Scheduled(fixedRate = 300000)
    public void checkExpiredRFQs() {
        log.info("Checking for expired RFQs...");
        rfqService.checkAndCloseExpiredRFQs();
    }
}
