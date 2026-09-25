package com.pillflow.security
import org.springframework.context.annotation.Configuration
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
@Configuration
class WebMvcConfig(private val resolver: CurrentUserArgumentResolver) : WebMvcConfigurer { override fun addArgumentResolvers(r: MutableList<HandlerMethodArgumentResolver>) { r.add(resolver) } }
