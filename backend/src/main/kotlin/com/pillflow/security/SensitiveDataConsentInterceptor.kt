package com.pillflow.security

import com.pillflow.common.BusinessException
import com.pillflow.common.ErrorCode
import com.pillflow.consent.CURRENT_POLICY_VERSION
import com.pillflow.consent.ConsentRepository
import java.util.UUID
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

@Component
class SensitiveDataConsentInterceptor(private val consents: ConsentRepository) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        if (request.method == "OPTIONS") return true
        val path = request.requestURI.removePrefix(request.contextPath)
        if (!isSensitiveDataPath(path)) return true

        val jwt = SecurityContextHolder.getContext().authentication?.principal as? Jwt
            ?: throw BusinessException(ErrorCode.UNAUTHORIZED)
        val userId = UUID.fromString(jwt.subject)
        if (!consents.hasRequiredConsents(userId, CURRENT_POLICY_VERSION)) {
            throw BusinessException(ErrorCode.CONSENT_REQUIRED)
        }
        return true
    }

    private fun isSensitiveDataPath(path: String): Boolean =
        path == "/api/v1/medications" || path.startsWith("/api/v1/medications/") ||
            path == "/api/v1/stats" || path.startsWith("/api/v1/stats/")
}
