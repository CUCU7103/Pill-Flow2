package com.pillflow

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.SpringApplication
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import kotlin.system.exitProcess

/**
 * 실제 프로세스를 종료시키는 동작을 분리한 인터페이스.
 * 기본 구현(DefaultProcessExiter)은 JVM 프로세스를 종료하는 kotlin.system.exitProcess를 호출하지만,
 * 테스트에서는 이 빈을 가짜 구현으로 교체해 테스트 JVM 자체가 종료되지 않게 한다.
 */
fun interface ProcessExiter {
    fun exit(code: Int)
}

@Component
class DefaultProcessExiter : ProcessExiter {
    override fun exit(code: Int) {
        exitProcess(code)
    }
}

/**
 * migrate 프로파일 전용 러너.
 *
 * Flyway 마이그레이션은 FlywayAutoConfiguration이 컨텍스트 초기화(refresh) 도중에 이미 실행하므로,
 * 이 러너가 호출되는 시점에는 성공적으로 끝난 상태다(실패하면 컨텍스트 초기화 자체가 예외로
 * 중단되어 이 러너는 아예 실행되지 않고, main()에서 던져진 예외로 JVM이 0이 아닌 코드로 종료된다).
 *
 * 문제는 성공 시: HikariCP 등 비-데몬 스레드가 컨텍스트 종료 후에도 남아 있으면 JVM이 자연스럽게
 * 종료되지 않고 배포 파이프라인이 무한정 멈출 수 있다. 그래서 컨텍스트를 명시적으로 닫고
 * (SpringApplication.exit) 프로세스를 확실히 종료시킨다.
 */
@Component
@Profile("migrate")
class MigrateExitRunner(
    private val context: ApplicationContext,
    private val processExiter: ProcessExiter,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val exitCode = SpringApplication.exit(context)
        processExiter.exit(exitCode)
    }
}
