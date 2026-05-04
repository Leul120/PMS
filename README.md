# Procurement Management and Vendor Scoring System

A comprehensive microservices-based platform for digital procurement with automated vendor scoring using weighted KPIs.

## Architecture Overview

This system implements an 8-microservice architecture with:
- **Synchronous Communication**: REST APIs with JWT authentication
- **Asynchronous Communication**: Apache Kafka for event-driven messaging
- **Database**: PostgreSQL (one per service)
- **API Gateway**: Spring Cloud Gateway for unified access

## Microservices

| Service | Port | Description | Database |
|---------|------|-------------|----------|
| auth-service | 8081 | Authentication, JWT, RBAC, Audit Logs | authdb |
| vendor-service | 8082 | Vendor registration, compliance, categories | vendordb |
| rfq-bidding-service | 8083 | RFQ/RFP management, bid submission, evaluation | rfqdb |
| procurement-service | 8084 | Purchase orders, approval routing | procurementdb |
| delivery-invoice-service | 8085 | Delivery tracking, 3-way matching, disputes | deliverydb |
| scoring-service | 8086 | Weighted score calculation, risk classification | scoringdb |
| analytics-service | 8087 | Spend analysis, reports, dashboards | Read replicas |
| notification-service | 8088 | Email/in-app alerts via Kafka | None |
| api-gateway | 8080 | Unified API access point | - |

## Quick Start

### Prerequisites
- Java 17+
- Maven 3.8+
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Apache Kafka (or use Docker)

### Running with Docker Compose

1. Start all services:
```bash
docker-compose up -d
```

This will start:
- Zookeeper (port 2181)
- Kafka (port 9092)
- 6 PostgreSQL instances (ports 5432-5437)
- All 8 microservices

2. Verify services:
```bash
docker-compose ps
```

### Running Locally (Development)

1. Start infrastructure:
```bash
docker-compose up -d zookeeper kafka postgres-auth postgres-vendor postgres-rfq postgres-procurement postgres-delivery postgres-scoring
```

2. Build all services:
```bash
cd auth-service && mvn clean package -DskipTests
cd ../vendor-service && mvn clean package -DskipTests
cd ../rfq-bidding-service && mvn clean package -DskipTests
cd ../procurement-service && mvn clean package -DskipTests
cd ../delivery-invoice-service && mvn clean package -DskipTests
cd ../scoring-service && mvn clean package -DskipTests
cd ../analytics-service && mvn clean package -DskipTests
cd ../notification-service && mvn clean package -DskipTests
cd ../api-gateway && mvn clean package -DskipTests
```

3. Run services (in separate terminals):
```bash
# Terminal 1
java -jar auth-service/target/auth-service-1.0.0.jar

# Terminal 2
java -jar vendor-service/target/vendor-service-1.0.0.jar

# ... and so on for each service
```

## API Documentation

### Authentication

#### Register User
```bash
POST http://localhost:8080/api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phoneNumber": "+1234567890",
  "roleName": "PROCUREMENT_OFFICER"
}
```

#### Login
```bash
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "admin@procurement.com",
  "password": "admin123"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
  "tokenType": "Bearer",
  "userId": 1,
  "email": "admin@procurement.com",
  "fullName": "System Administrator",
  "role": "ADMIN"
}
```

### Vendor Management

#### Register Vendor
```bash
POST http://localhost:8080/api/vendors/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "companyName": "Tech Supplies Inc",
  "contactPerson": "Jane Smith",
  "email": "vendor@techsupplies.com",
  "categoryId": 1,
  "phoneNumber": "+1234567890",
  "address": "123 Tech Street",
  "taxId": "TAX123456"
}
```

#### Verify Vendor
```bash
POST http://localhost:8080/api/vendors/1/verify
Authorization: Bearer <token>
```

### RFQ & Bidding

#### Create RFQ
```bash
POST http://localhost:8080/api/rfqs
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Laptop Procurement Q1 2024",
  "description": "Procurement of 50 laptops for IT department",
  "deadline": "2024-12-31T23:59:59",
  "estimatedValue": 75000.00,
  "categoryId": 1,
  "expectedQuantity": 50
}
```

#### Submit Bid
```bash
POST http://localhost:8080/api/bids
Content-Type: application/json

{
  "rfqId": 1,
  "vendorId": 1,
  "bidAmount": 70000.00,
  "proposalText": "High-quality laptops with 3-year warranty",
  "deliveryDays": 14
}
```

#### Evaluate Bid
```bash
POST http://localhost:8080/api/bids/1/evaluate
Authorization: Bearer <token>
```

### Purchase Orders

#### Create PO
```bash
POST http://localhost:8080/api/purchase-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "rfqId": 1,
  "vendorId": 1,
  "totalAmount": 70000.00,
  "expectedDeliveryDate": "2024-02-15"
}
```

#### Approve PO
```bash
POST http://localhost:8080/api/purchase-orders/1/approve
Authorization: Bearer <token>
```

### Delivery & Invoice

#### Log Delivery
```bash
POST http://localhost:8080/api/deliveries?poId=1&vendorId=1&expectedDate=2024-02-15&actualDate=2024-02-14&quantityDelivered=50&qualityRemarks=Acceptable
```

#### Submit Invoice
```bash
POST http://localhost:8080/api/invoices?poId=1&invoiceAmount=70000.00&vendorId=1
```

#### Validate Invoice (3-way matching)
```bash
POST http://localhost:8080/api/invoices/1/validate?expectedAmount=70000.00&expectedQuantity=50
```

### Vendor Scoring

#### Get Vendor Scores
```bash
GET http://localhost:8080/api/scores/vendor/1
```

#### Get Vendor Rankings
```bash
GET http://localhost:8080/api/scores/ranking
```

### Analytics

#### Dashboard Overview
```bash
GET http://localhost:8080/api/dashboard/overview
```

#### Spend Report
```bash
GET http://localhost:8080/api/reports/spend
```

## Kafka Event Topics

| Topic | Event | Producer | Consumers |
|-------|-------|----------|-----------|
| vendor.verified | VendorVerifiedEvent | vendor-service | notification-service |
| rfq.published | RFQPublishedEvent | rfq-bidding-service | notification-service |
| bid.submitted | BidSubmittedEvent | rfq-bidding-service | notification-service, scoring-service |
| po.approved | POApprovedEvent | procurement-service | notification-service, delivery-invoice-service |
| delivery.completed | DeliveryCompletedEvent | delivery-invoice-service | scoring-service, notification-service |
| invoice.discrepancy | InvoiceDiscrepancyEvent | delivery-invoice-service | notification-service |
| score.updated | ScoreUpdatedEvent | scoring-service | notification-service, analytics-service |

## Approval Workflow

The system implements multi-level approval based on PO amount:

| Amount Range | Required Approval |
|--------------|-------------------|
| < $10,000 | Auto-approved |
| $10,000 - $49,999 | Manager approval required |
| ≥ $50,000 | Director/Admin approval required |

## Vendor Scoring Formula

The weighted scoring formula implemented:

```
Overall Score = (Timeliness × 0.35) + (Quality × 0.35) + (Cost × 0.20) + (Responsiveness × 0.10)

Where:
- Timeliness = max(0, (1 - delayDays/expectedDays) × 100)
- Quality = Based on delivery quality remarks (deduct for damaged goods)
- Cost = (lowestBid / vendorBid) × 100
- Responsiveness = (bidsSubmittedOnTime / totalRFQsResponded) × 100
```

Risk Classification:
- Score ≥ 80: Low Risk
- 60-79: Medium Risk
- < 60: High Risk

## 3-Way Matching

The system implements automated 3-way matching for invoice validation:

1. **Purchase Order Match**: Compare invoice amount with PO total amount
2. **Delivery Match**: Compare delivered quantity with expected quantity
3. **Quality Check**: Validate quality remarks from delivery notes

If discrepancies are found:
- Invoice is flagged with `discrepancyFlag = true`
- Status set to "Disputed"
- `InvoiceDiscrepancyEvent` published to Kafka

## Configuration

### Environment Variables

Each service can be configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| SPRING_DATASOURCE_URL | PostgreSQL connection URL | jdbc:postgresql://localhost:5432/... |
| SPRING_DATASOURCE_USERNAME | Database username | postgres |
| SPRING_DATASOURCE_PASSWORD | Database password | secret |
| SPRING_KAFKA_BOOTSTRAP_SERVERS | Kafka brokers | localhost:9092 |
| JWT_SECRET | JWT signing key | mySuperSecretKey123! |
| JWT_EXPIRATION | Token expiration (ms) | 28800000 (8 hours) |

## Database Schema

See individual service `application.yml` files for JPA entity definitions. The system uses `ddl-auto: create-drop` for development.

## Testing

### Unit Tests
```bash
mvn test
```

### Integration Testing with Postman
Import the provided Postman collection (if available) or use the API examples above.

## Security

- JWT-based authentication with HS512 signing
- Role-based access control (RBAC)
- BCrypt password encoding (strength 10)
- CORS configuration for frontend integration

## Monitoring & Observability

- Spring Boot Actuator endpoints available on each service
- Application logs via SLF4J/Logback
- Audit logging to database for compliance

## Future Enhancements

- [ ] ERP system integration
- [ ] Advanced analytics with ML
- [ ] Real-time notifications via WebSocket
- [ ] Mobile app support
- [ ] Multi-tenancy
- [ ] Advanced caching with Redis

## License

This project is created for educational purposes as part of a Final Year Project.

## Support

For issues or questions, please refer to the FYP documentation or contact the development team.
