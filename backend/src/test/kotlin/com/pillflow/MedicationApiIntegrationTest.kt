package com.pillflow

import java.util.UUID
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer

@Testcontainers
class MedicationApiIntegrationTest : ApiIntegrationTestSupport() {
    @Test
    fun `약 CRUD와 복용 완료 응답이 정상 동작한다`() {
        val body = """
            {"name":"비타민D","dosage":"1","memo":"아침","times":["08:00"],"type":"tablet","color":"#123456","days":["mon","wed","fri"]}
        """.trimIndent()
        val authorization = authorization()

        val created = mockMvc.perform(
            post("/api/v1/medications")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").isString)
            .andExpect(jsonPath("$.name").value("비타민D"))
            .andExpect(jsonPath("$.memo").value("아침"))
            .andExpect(jsonPath("$.times[0]").value("08:00"))
            .andExpect(jsonPath("$.type").value("tablet"))
            .andExpect(jsonPath("$.days[2]").value("fri"))
            .andExpect(jsonPath("$.completed").value(false))
            .andReturn()
        val id = UUID.fromString(Regex("\\\"id\\\":\\\"([^\\\"]+)\\\"").find(created.response.contentAsString)!!.groupValues[1])

        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-25").header("Authorization", authorization))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].id").value(id.toString()))
            .andExpect(jsonPath("$[0].completed").value(false))

        mockMvc.perform(
            put("/api/v1/medications/$id/intakes/2026-09-25")
                .header("Authorization", authorization),
        ).andExpect(status().isNoContent)

        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-25").header("Authorization", authorization))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].completed").value(true))

        mockMvc.perform(delete("/api/v1/medications/$id").header("Authorization", authorization))
            .andExpect(status().isNoContent)
        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-25").header("Authorization", authorization))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isEmpty)
    }

    @Test
    fun `intake PUT은 중복 호출해도 로그 하나만 만들고 없는 DELETE도 성공한다`() {
        val userId = UUID.randomUUID()
        addUser(userId)
        val medication = medications.saveAndFlush(
            com.pillflow.medication.Medication(
                userId = userId,
                name = "멱등 약",
                dosage = "1",
                type = com.pillflow.medication.MedicationType.tablet,
                times = arrayOf("08:00"),
                days = arrayOf("fri"),
            ),
        )
        val authorization = authorization(userId)
        repeat(2) {
            mockMvc.perform(
                put("/api/v1/medications/${medication.id}/intakes/2026-09-25").header("Authorization", authorization),
            ).andExpect(status().isNoContent)
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM public.medication_logs WHERE medication_id=?", Int::class.java, medication.id))
        mockMvc.perform(
            delete("/api/v1/medications/${medication.id}/intakes/2026-09-24").header("Authorization", authorization),
        ).andExpect(status().isNoContent)
    }

    @Test
    fun `다른 사용자의 약은 목록에서 숨기고 삭제와 intake를 404로 거부한다`() {
        val owner = UUID.randomUUID()
        val other = UUID.randomUUID()
        addUser(owner)
        addUser(other)
        val medication = medications.saveAndFlush(
            com.pillflow.medication.Medication(
                userId = owner,
                name = "소유자 약",
                dosage = "1",
                type = com.pillflow.medication.MedicationType.syrup,
                times = arrayOf("09:00"),
                days = arrayOf("fri"),
            ),
        )
        val authorization = authorization(other)
        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-25").header("Authorization", authorization))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isEmpty)
        mockMvc.perform(delete("/api/v1/medications/${medication.id}").header("Authorization", authorization))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("MEDICATION_NOT_FOUND"))
        mockMvc.perform(put("/api/v1/medications/${medication.id}/intakes/2026-09-25").header("Authorization", authorization))
            .andExpect(status().isNotFound)
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.medication_logs WHERE medication_id=?", Int::class.java, medication.id))
    }

    @Test
    fun `전체 삭제는 현재 사용자의 약과 기록만 삭제한다`() {
        val owner = UUID.randomUUID()
        val other = UUID.randomUUID()
        addUser(owner)
        addUser(other)
        val own = medications.saveAndFlush(
            com.pillflow.medication.Medication(
                userId = owner,
                name = "내 약",
                dosage = "1",
                type = com.pillflow.medication.MedicationType.tablet,
                times = arrayOf("08:00"),
                days = arrayOf("fri"),
            ),
        )
        val otherMedication = medications.saveAndFlush(
            com.pillflow.medication.Medication(
                userId = other,
                name = "다른 약",
                dosage = "1",
                type = com.pillflow.medication.MedicationType.tablet,
                times = arrayOf("08:00"),
                days = arrayOf("fri"),
            ),
        )
        logs.saveAndFlush(com.pillflow.intake.MedicationLog(medicationId = own.id!!, userId = owner, takenOn = java.time.LocalDate.parse("2026-09-25")))
        logs.saveAndFlush(com.pillflow.intake.MedicationLog(medicationId = otherMedication.id!!, userId = other, takenOn = java.time.LocalDate.parse("2026-09-25")))

        mockMvc.perform(delete("/api/v1/medications").header("Authorization", authorization(owner)))
            .andExpect(status().isNoContent)
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.medications WHERE user_id=?", Int::class.java, owner))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM public.medications WHERE user_id=?", Int::class.java, other))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM public.medication_logs WHERE user_id=?", Int::class.java, other))
    }

    @Test
    fun `약 입력 검증과 잘못된 JSON 날짜 UUID는 모두 400 JSON이다`() {
        val authorization = authorization()
        val invalidBodies = listOf(
            """{"name":" ","dosage":"1","times":["08:00"],"type":"tablet","days":["mon"]}""",
            """{"name":"약","dosage":" ","times":["08:00"],"type":"tablet","days":["mon"]}""",
            """{"name":"약","dosage":"1","times":[],"type":"tablet","days":["mon"]}""",
            """{"name":"약","dosage":"1","times":["25:00"],"type":"tablet","days":["mon"]}""",
            """{"name":"약","dosage":"1","times":["08:00"],"type":"tablet","days":[]}""",
            """{"name":"약","dosage":"1","times":["08:00"],"type":"tablet","days":["monday"]}""",
            """{"name":"약","dosage":"1","times":["08:00"],"days":["mon"]}""",
        )
        invalidBodies.forEach { body ->
            mockMvc.perform(
                post("/api/v1/medications")
                    .header("Authorization", authorization)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").isString).andExpect(jsonPath("$.message").isString)
        }
        mockMvc.perform(
            post("/api/v1/medications")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("not-json"),
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").isString).andExpect(jsonPath("$.message").isString)
        mockMvc.perform(
            post("/api/v1/medications")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"약","dosage":"1","times":["08:00"],"type":"unknown","days":["mon"]}"""),
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").isString).andExpect(jsonPath("$.message").isString)
        mockMvc.perform(get("/api/v1/medications").param("date", "2026-9-25").header("Authorization", authorization))
            .andExpect(status().isBadRequest)
        mockMvc.perform(delete("/api/v1/medications/not-a-uuid").header("Authorization", authorization))
            .andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
    }

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:17-alpine")

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("DB_URL") { postgres.jdbcUrl }
            registry.add("DB_USERNAME") { postgres.username }
            registry.add("DB_PASSWORD") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
            registry.add("SUPABASE_URL") { ApiTestJwt.issuer.removeSuffix("/auth/v1") }
            registry.add("CORS_ALLOWED_ORIGINS") { "https://client.test" }
        }
    }
}
