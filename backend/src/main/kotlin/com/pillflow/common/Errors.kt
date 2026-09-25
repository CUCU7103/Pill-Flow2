package com.pillflow.common

import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

enum class ErrorCode(val status: HttpStatus, val message: String) {
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "잘못된 요청입니다.")
}
class BusinessException(val errorCode: ErrorCode) : RuntimeException(errorCode.message)
data class ErrorResponse(val code: String, val message: String)

// Spring MVC 표준 예외(404·405·400 등)는 ResponseEntityExceptionHandler가 원래 상태 코드로 처리하고,
// 본문만 ErrorResponse 형식으로 통일한다. 그 외 예상하지 못한 예외만 500으로 변환한다.
@RestControllerAdvice
class GlobalExceptionHandler : ResponseEntityExceptionHandler() {
    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(BusinessException::class)
    fun handle(ex: BusinessException) = ResponseEntity.status(ex.errorCode.status).body(ErrorResponse(ex.errorCode.name, ex.errorCode.message))
    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied() = ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse(ErrorCode.FORBIDDEN.name, ErrorCode.FORBIDDEN.message))
    @ExceptionHandler(Exception::class)
    fun handleUnexpected(ex: Exception): ResponseEntity<ErrorResponse> {
        // 원인을 남기지 않으면 장애가 조용히 묻히므로 500 경로에서만 스택 트레이스를 기록한다
        log.error("처리되지 않은 예외", ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorResponse(ErrorCode.INTERNAL_ERROR.name, ErrorCode.INTERNAL_ERROR.message))
    }

    override fun handleExceptionInternal(
        ex: Exception,
        body: Any?,
        headers: HttpHeaders,
        statusCode: HttpStatusCode,
        request: WebRequest,
    ): ResponseEntity<Any>? {
        val code = HttpStatus.resolve(statusCode.value())?.name ?: ErrorCode.INTERNAL_ERROR.name
        val message = if (statusCode.is4xxClientError) ErrorCode.INVALID_REQUEST.message else ErrorCode.INTERNAL_ERROR.message
        return ResponseEntity.status(statusCode).headers(headers).body(ErrorResponse(code, message))
    }
}
