package com.pillflow

import com.pillflow.security.AudienceValidator
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant

class SecurityUnitTest {
    @Test fun `authenticated audience를 요구한다`() {
        val jwt = Jwt.withTokenValue("t").header("alg", "ES256").claim("sub", "00000000-0000-0000-0000-000000000001").audience(listOf("authenticated")).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build()
        assertTrue(AudienceValidator("authenticated").validate(jwt).hasErrors().not())
    }
}
