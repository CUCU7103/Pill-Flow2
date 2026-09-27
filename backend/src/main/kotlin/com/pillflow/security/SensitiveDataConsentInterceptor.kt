package com.pillflow.security

import com.pillflow.common.BusinessException
import com.pillflow.common.ErrorCode
import com.pillflow.consent.CURRENT_POLICY_VERSION
import com.pillflow.consent.ConsentRepository
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

@Component
class SensitiveDataConsentInterceptor(private val consents: ConsentRepository) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        // 브라우저의 CORS 사전 요청은 실제 복약 데이터 요청이 아니므로 동의 조회 없이 통과시킨다.
        if (request.method == "OPTIONS") return true

        val jwt = SecurityContextHolder.getContext().authentication?.principal as? Jwt
            ?: throw BusinessException(ErrorCode.UNAUTHORIZED)
        val userId = jwt.userId()
        if (!consents.hasRequiredConsents(userId, CURRENT_POLICY_VERSION)) {
            throw BusinessException(ErrorCode.CONSENT_REQUIRED)
        }
        return true
    }
}
