package com.pillflow.security

import java.util.UUID
import com.pillflow.common.BusinessException
import com.pillflow.common.ErrorCode
import org.springframework.core.MethodParameter
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer

@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class CurrentUser

fun Jwt.userId(): UUID {
    val value = subject ?: throw BusinessException(ErrorCode.UNAUTHORIZED)
    return try {
        UUID.fromString(value)
    } catch (_: IllegalArgumentException) {
        throw BusinessException(ErrorCode.UNAUTHORIZED)
    }
}

@Component
class CurrentUserArgumentResolver : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter) = parameter.hasParameterAnnotation(CurrentUser::class.java) && parameter.parameterType == UUID::class.java
    override fun resolveArgument(parameter: MethodParameter, mavContainer: ModelAndViewContainer?, webRequest: NativeWebRequest, binderFactory: WebDataBinderFactory?): UUID {
        val authentication = webRequest.userPrincipal as? Authentication
            ?: throw BusinessException(ErrorCode.UNAUTHORIZED)
        val jwt = authentication.principal as? Jwt
            ?: throw BusinessException(ErrorCode.UNAUTHORIZED)
        return jwt.userId()
    }
}
