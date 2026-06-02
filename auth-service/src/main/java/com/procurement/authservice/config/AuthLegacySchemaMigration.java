package com.procurement.authservice.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.List;
import java.util.Optional;

/**
 * Backfills {@code organization_type} on existing tenant rows after Hibernate has created/updated the schema.
 * Skips cleanly on empty databases (tables created on first boot).
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class AuthLegacySchemaMigration implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        migrate(new JdbcTemplate(dataSource));
    }

    private void migrate(JdbcTemplate jdbc) {
        Optional<String> tenantTable = resolveTable(jdbc, "tenant");
        if (tenantTable.isEmpty()) {
            log.info("Tenant table not present yet — skipping organization_type backfill");
            return;
        }

        String tenant = quoteTable(tenantTable.get());
        try {
            if (!columnExists(jdbc, tenantTable.get(), "organization_type")) {
                jdbc.execute("ALTER TABLE " + tenant + " ADD COLUMN organization_type VARCHAR(255)");
                log.info("Added {}.organization_type (nullable) for legacy DB upgrade", tenantTable.get());
            }

            jdbc.update("""
                UPDATE %s SET organization_type = 'BOTH'
                WHERE domain = 'default' AND (organization_type IS NULL OR organization_type = '')
                """.formatted(tenant));

            jdbc.update("""
                UPDATE %s SET organization_type = 'BUYER'
                WHERE domain = 'system' AND (organization_type IS NULL OR organization_type = '')
                """.formatted(tenant));

            jdbc.update("""
                UPDATE %s SET organization_type = 'SUPPLIER'
                WHERE organization_type IS NULL OR organization_type = ''
                """.formatted(tenant));

            enforceNotNullIfReady(jdbc, tenant, "organization_type");
        } catch (Exception e) {
            log.error("Auth legacy schema migration failed: {}", e.getMessage(), e);
            throw new IllegalStateException("Database schema migration failed", e);
        }
    }

    private static Optional<String> resolveTable(JdbcTemplate jdbc, String nameLower) {
        List<String> names = jdbc.queryForList(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND lower(table_name) = ?
            """,
            String.class,
            nameLower);
        return names.isEmpty() ? Optional.empty() : Optional.of(names.getFirst());
    }

    private static String quoteTable(String tableName) {
        if (tableName.equals(tableName.toLowerCase())) {
            return tableName;
        }
        return "\"" + tableName.replace("\"", "\"\"") + "\"";
    }

    private static void enforceNotNullIfReady(JdbcTemplate jdbc, String quotedTable, String column) {
        Integer nulls = jdbc.queryForObject(
            "SELECT COUNT(*) FROM " + quotedTable + " WHERE " + column + " IS NULL",
            Integer.class);
        if (nulls != null && nulls == 0) {
            try {
                jdbc.execute("ALTER TABLE " + quotedTable + " ALTER COLUMN " + column + " SET NOT NULL");
                log.info("Set NOT NULL on {}.{}", quotedTable, column);
            } catch (Exception e) {
                log.debug("Could not set NOT NULL on {}.{}: {}", quotedTable, column, e.getMessage());
            }
        }
    }

    private static boolean columnExists(JdbcTemplate jdbc, String table, String column) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
            """,
            Integer.class,
            table,
            column.toLowerCase());
        return count != null && count > 0;
    }
}
