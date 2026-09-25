package com.pillflow.security

import java.util.UUID
import org.springframework.core.MethodParameter
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer

@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class CurrentUser
@Component
class CurrentUserArgumentResolver : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter) = parameter.hasParameterAnnotation(CurrentUser::class.java) && parameter.parameterType == UUID::class.java
    override fun resolveArgument(parameter: MethodParameter, mavContainer: ModelAndViewContainer?, webRequest: NativeWebRequest, binderFactory: WebDataBinderFactory?) = UUID.fromString((webRequest.userPrincipal as org.springframework.security.core.Authentication).principal.let { (it as Jwt).subject })
}
