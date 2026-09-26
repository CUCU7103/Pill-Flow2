package com.pillflow

import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import java.util.concurrent.atomic.AtomicInteger

/**
 * 테스트 전용 ProcessExiter — 실제 exitProcess를 호출하면 테스트 JVM(Gradle worker)이
 * 함께 죽으므로, 대신 종료 코드만 기록하고 정상적으로 리턴한다.
 */
@Configuration
class TestProcessExiterConfig {
    companion object {
        val lastExitCode = AtomicInteger(-1)
    }

    @Bean
    @Primary
    fun processExiter(): ProcessExiter = ProcessExiter { code -> lastExitCode.set(code) }
}

/**
 * 배포 파이프라인이 쓰는 두 프로파일을 검증한다.
 * - migrate: 웹 서버 없이 Flyway만 실행하고 정상 종료(exit code 0)해야 한다.
 * - prod: Flyway를 실행하지 않아야 한다(DDL은 파이프라인의 migrate 단계만 수행).
 */
@Testcontainers
class DeployProfilesTest {

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:17-alpine")
    }

    /** 스텁(V0)을 포함한 Flyway 위치. 운영 위치에는 스텁이 없으므로 테스트에서만 추가한다. */
    private val testLocations = "classpath:db/supabase-stub,classpath:db/migration"

    private fun jdbc() = JdbcTemplate(DriverManagerDataSource(postgres.jdbcUrl, postgres.username, postgres.password))

    private fun resetDatabase() {
        jdbc().execute("DROP SCHEMA IF EXISTS flyway CASCADE")
        jdbc().execute("DROP SCHEMA IF EXISTS public CASCADE")
        jdbc().execute("CREATE SCHEMA public")
        jdbc().execute("DROP SCHEMA IF EXISTS auth CASCADE")
    }

    private fun appliedVersions(): List<String> =
        jdbc().queryForList("SELECT version FROM flyway.flyway_schema_history WHERE success ORDER BY installed_rank", String::class.java)
            .filterNotNull()

    @Test
    fun `migrate 프로파일은 웹 서버 없이 마이그레이션을 끝내고 종료 코드 0을 반환한다`() {
        resetDatabase()
        TestProcessExiterConfig.lastExitCode.set(-1)

        // SUPABASE_URL, CORS_ALLOWED_ORIGINS는 일부러 넘기지 않는다 — migrate 실행에 필요 없어야 한다.
        // TestProcessExiterConfig를 추가 source로 넣어 MigrateExitRunner가 실제 exitProcess 대신
        // 가짜 ProcessExiter(@Primary)를 사용하도록 한다 — 그렇지 않으면 테스트 JVM이 종료된다.
        val context = SpringApplicationBuilder(PillflowApplication::class.java, TestProcessExiterConfig::class.java)
            .profiles("migrate")
            .properties(
                "FLYWAY_URL=${postgres.jdbcUrl}",
                "FLYWAY_USERNAME=${postgres.username}",
                "FLYWAY_PASSWORD=${postgres.password}",
                "spring.flyway.locations=$testLocations",
            )
            .run()

        assertFalse(context is WebServerApplicationContext, "migrate 프로파일은 웹 서버를 띄우면 안 된다")
        // MigrateExitRunner가 이미 SpringApplication.exit(context)를 호출해 컨텍스트를 닫았으므로,
        // 여기서는 러너가 기록한 종료 코드만 확인한다(컨텍스트를 다시 닫으려 하면 안 된다).
        assertEquals(0, TestProcessExiterConfig.lastExitCode.get())
        assertEquals(listOf("0", "1", "2"), appliedVersions())
    }

    @Test
    fun `migrate 프로파일은 Flyway 실패 시 컨텍스트 초기화가 예외로 중단된다`() {
        resetDatabase()

        // FLYWAY_PASSWORD를 일부러 틀리게 넘겨 Flyway가 DB 연결에 실패하게 만든다.
        // 실제 java -jar 프로세스라면 이 예외가 main()까지 전파되어 0이 아닌 종료 코드로 끝난다.
        assertThrows(Exception::class.java) {
            SpringApplicationBuilder(PillflowApplication::class.java, TestProcessExiterConfig::class.java)
                .profiles("migrate")
                .properties(
                    "FLYWAY_URL=${postgres.jdbcUrl}",
                    "FLYWAY_USERNAME=${postgres.username}",
                    "FLYWAY_PASSWORD=wrong-password",
                    "spring.flyway.locations=$testLocations",
                )
                .run()
        }
        // 인증 실패로 Flyway가 스키마 생성 전에 멈추므로 flyway.flyway_schema_history 자체가
        // 없을 수 있다 — appliedVersions() 대신 예외 발생 자체로 실패를 검증한다.
    }

    @Test
    fun `prod 프로파일은 Flyway를 실행하지 않는다`() {
        resetDatabase()
        // V1까지만 적용해 둔다. prod가 Flyway를 실행하면 V2가 추가로 적용되어 테스트가 실패한다.
        Flyway.configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .schemas("flyway").defaultSchema("flyway").createSchemas(true)
            .locations(*testLocations.split(",").toTypedArray())
            .target("1")
            .load()
            .migrate()

        val context = SpringApplicationBuilder(PillflowApplication::class.java)
            .profiles("prod")
            .properties(
                "DB_URL=${postgres.jdbcUrl}",
                "DB_USERNAME=${postgres.username}",
                "DB_PASSWORD=${postgres.password}",
                "SUPABASE_URL=https://example.supabase.co",
                "CORS_ALLOWED_ORIGINS=https://localhost",
                "server.port=0",
            )
            .run()
        context.close()

        assertEquals(listOf("0", "1"), appliedVersions())
    }
}
