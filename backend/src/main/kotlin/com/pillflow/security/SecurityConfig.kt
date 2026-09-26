package com.pillflow.security

import tools.jackson.databind.ObjectMapper
import com.pillflow.common.ErrorCode
import com.pillflow.common.ErrorResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.*
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

// migrate 프로파일은 웹 서버가 없으므로 HttpSecurity 기반 보안 설정을 로드하지 않는다.
@Configuration
@EnableMethodSecurity
@Profile("!migrate")
class SecurityConfig(
    @Value("\${CORS_ALLOWED_ORIGINS}") private val origins: String,
    @Value("\${spring.security.oauth2.resourceserver.jwt.issuer-uri}") private val issuer: String,
    @Value("\${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") private val jwkSetUri: String,
    @Value("\${spring.security.oauth2.resourceserver.jwt.audiences}") private val audience: String,
    private val objectMapper: ObjectMapper,
) {
    @Bean fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .csrf { it.disable() }.cors { it.configurationSource(corsConfigurationSource()) }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests { it.requestMatchers("/actuator/health").permitAll().anyRequest().authenticated() }
        .exceptionHandling { it.authenticationEntryPoint(jsonEntryPoint()); it.accessDeniedHandler(jsonDeniedHandler()) }
        .oauth2ResourceServer {
            it.authenticationEntryPoint(jsonEntryPoint())
            it.jwt { jwt -> jwt.jwtAuthenticationConverter(JwtAuthenticationConverter()) }
        }
        .build()

    @Bean fun jwtDecoder(): JwtDecoder {
        val decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
            .jwsAlgorithm(SignatureAlgorithm.ES256)
            .build()
        decoder.setJwtValidator(supabaseJwtValidator(issuer, audience))
        return decoder
    }
    @Bean fun corsConfigurationSource(): CorsConfigurationSource = UrlBasedCorsConfigurationSource().also {
        val c = CorsConfiguration().apply { allowedOrigins = origins.split(',').map(String::trim); allowedMethods = listOf("GET","POST","PUT","PATCH","DELETE","OPTIONS"); allowedHeaders = listOf("*"); allowCredentials = true }
        it.registerCorsConfiguration("/**", c)
    }
    private fun jsonEntryPoint() = AuthenticationEntryPoint { _, response, _ -> response.status = 401; response.contentType = "application/json"; response.writer.write(objectMapper.writeValueAsString(ErrorResponse(ErrorCode.UNAUTHORIZED.name, ErrorCode.UNAUTHORIZED.message))) }
    private fun jsonDeniedHandler() = AccessDeniedHandler { _, response, _ -> response.status = 403; response.contentType = "application/json"; response.writer.write(objectMapper.writeValueAsString(ErrorResponse(ErrorCode.FORBIDDEN.name, ErrorCode.FORBIDDEN.message))) }
}

internal fun supabaseJwtValidator(issuer: String, audience: String): OAuth2TokenValidator<Jwt> =
    DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(issuer),
        AudienceValidator(audience),
    )

class AudienceValidator(private val audience: String) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult = if (token.audience.contains(audience)) OAuth2TokenValidatorResult.success() else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "audience가 올바르지 않습니다.", null))
}
