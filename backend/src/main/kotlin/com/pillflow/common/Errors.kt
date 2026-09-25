package com.pillflow.common

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

enum class ErrorCode(val status: HttpStatus, val message: String) {
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "잘못된 요청입니다.")
}
class BusinessException(val errorCode: ErrorCode) : RuntimeException(errorCode.message)
data class ErrorResponse(val code: String, val message: String)
@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(BusinessException::class)
    fun handle(ex: BusinessException) = ResponseEntity.status(ex.errorCode.status).body(ErrorResponse(ex.errorCode.name, ex.errorCode.message))
    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied() = ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse(ErrorCode.FORBIDDEN.name, ErrorCode.FORBIDDEN.message))
    @ExceptionHandler(Exception::class)
    fun handleUnexpected() = ResponseEntity.status(500).body(ErrorResponse(ErrorCode.INTERNAL_ERROR.name, ErrorCode.INTERNAL_ERROR.message))
}
