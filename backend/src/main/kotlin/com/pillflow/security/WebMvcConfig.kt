package com.pillflow.security
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

// migrate 프로파일은 웹 서버가 없으므로 MVC 설정을 로드하지 않는다.
@Configuration
@Profile("!migrate")
class WebMvcConfig(
    private val resolver: CurrentUserArgumentResolver,
    private val consentInterceptor: SensitiveDataConsentInterceptor,
) : WebMvcConfigurer {
    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(resolver)
    }

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(consentInterceptor)
            .addPathPatterns(
                "/api/v1/medications",
                "/api/v1/medications/**",
                "/api/v1/stats",
                "/api/v1/stats/**",
            )
    }
}
