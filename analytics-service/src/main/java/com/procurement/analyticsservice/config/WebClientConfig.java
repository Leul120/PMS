package com.procurement.analyticsservice.config;

import com.procurement.analyticsservice.infrastructure.client.ServiceProperties;
import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
@RequiredArgsConstructor
public class WebClientConfig {

    private final ServiceProperties serviceProperties;

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    @Bean
    public WebClient vendorWebClient(WebClient.Builder builder) {
        return builder
                .baseUrl(serviceProperties.getVendor().getUrl())
                .clientConnector(new ReactorClientHttpConnector(
                        createHttpClient("vendor-service")))
                .build();
    }

    @Bean
    public WebClient procurementWebClient(WebClient.Builder builder) {
        return builder
                .baseUrl(serviceProperties.getProcurement().getUrl())
                .clientConnector(new ReactorClientHttpConnector(
                        createHttpClient("procurement-service")))
                .build();
    }

    @Bean
    public WebClient rfqWebClient(WebClient.Builder builder) {
        return builder
                .baseUrl(serviceProperties.getRfq().getUrl())
                .clientConnector(new ReactorClientHttpConnector(
                        createHttpClient("rfq-bidding-service")))
                .build();
    }

    private HttpClient createHttpClient(String serviceName) {
        return HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                .responseTimeout(Duration.ofSeconds(10))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(10, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(10, TimeUnit.SECONDS)));
    }
}
